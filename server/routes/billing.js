import express from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db/init.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { renderBillingPdf } from '../services/billing-pdf.js';

const router = express.Router();
router.use(authenticate);
const ref = (prefix) => `${prefix}-${randomUUID().toUpperCase()}`;
const currencies = ['USD', 'LRD'];
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const company = () => ({ name: process.env.COMPANY_NAME || 'CareerScope', address: process.env.COMPANY_ADDRESS || 'Sinkor, Monrovia, Liberia', logo: process.env.COMPANY_LOGO_URL || '/assets/careerscope_logo.jpeg' });
const planAmount = () => Number(process.env.SUBSCRIPTION_AMOUNT_MINOR || 2000);
const planCurrency = () => process.env.SUBSCRIPTION_CURRENCY || 'USD';
const term = 'Academic year (12 months from approval)';

function allocations(input) {
  if (!Array.isArray(input) || input.length === 0 || input.length > 500) throw new Error('Choose between 1 and 500 students');
  const seen = new Set();
  return input.map((item) => {
    const studentId = Number(item.studentId);
    const amountMinor = Number(item.amountMinor);
    if (!Number.isSafeInteger(studentId) || seen.has(studentId)) throw new Error('Invalid or duplicate student');
    seen.add(studentId);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > 100000000) throw new Error('Amounts must be positive integer minor units (cents)');
    if (!db.prepare("SELECT id FROM users WHERE id = ? AND role = 'student' AND is_disabled = 0").get(studentId)) throw new Error('Student not found or disabled');
    return { studentId, amountMinor };
  });
}

router.get('/plan', (req, res) => {
  const amountMinor = planAmount();
  const currency = planCurrency();
  const configured = Number.isSafeInteger(amountMinor) && amountMinor > 0 && currencies.includes(currency);
  const subscription = db.prepare('SELECT subscription_expires_at FROM users WHERE id = ?').get(req.user.id);
  res.json({ configured, term, subscriptionExpiresAt: subscription?.subscription_expires_at, amountMinor: configured ? amountMinor : null, currency: configured ? currency : null, instructions: process.env.PAYMENT_INSTRUCTIONS || 'Pay externally via Mobile Money, Orange Money, bank, or a merchant VISA checkout. Contact CareerScope for the destination account. Submit only the transaction reference, never card details, PINs or OTPs.' });
});

router.get('/', (req, res) => {
  const admin = req.user.role === 'admin';
  if (!admin && req.user.role !== 'student') return res.status(403).json({ error: 'Forbidden' });
  const payments = db.prepare(`
    SELECT p.*, a.student_id, a.amount_minor, u.first_name || ' ' || u.last_name AS student_name,
      r.reference AS receipt_reference, r.id AS receipt_id
    FROM billing_payments p JOIN billing_allocations a ON a.payment_id = p.id
    JOIN users u ON u.id = a.student_id LEFT JOIN billing_receipts r ON r.allocation_id = a.id
    ${admin ? '' : 'WHERE a.student_id = ? OR p.submitted_by = ?'}
    ORDER BY p.id DESC, a.id
  `).all(...(admin ? [] : [req.user.id, req.user.id]));
  const invoices = admin ? db.prepare('SELECT * FROM billing_invoices ORDER BY id DESC').all() : [];
  res.json({ payments, invoices });
});

router.post('/', requireRole('student', 'admin'), (req, res) => {
  try {
    const { invoiceId, method, providerReference } = req.body;
    if (typeof providerReference !== 'string' || !providerReference.trim() || providerReference.length > 200) throw new Error('Payment reference is required (maximum 200 characters)');
    if (!['mobile_money', 'orange_money', 'bank_transfer', 'visa', 'cash'].includes(method)) throw new Error('Invalid payment method');
    let items;
    let currency;
    if (req.user.role === 'student') {
      if (invoiceId) throw new Error('School invoices must be recorded by an administrator');
      if (method === 'cash') throw new Error('Cash payments must be recorded by an administrator');
      currency = planCurrency();
      items = allocations([{ studentId: req.user.id, amountMinor: planAmount() }]);
    } else if (invoiceId) {
      const invoice = db.prepare('SELECT * FROM billing_invoices WHERE id = ?').get(invoiceId);
      if (!invoice || invoice.status !== 'issued') throw new Error('Invoice not found or already paid');
      currency = invoice.currency;
      items = allocations(db.prepare('SELECT student_id AS "studentId", amount_minor AS "amountMinor" FROM billing_invoice_items WHERE invoice_id = ?').all(invoice.id));
    } else {
      currency = req.body.currency;
      items = allocations(req.body.allocations);
    }
    if (!currencies.includes(currency)) throw new Error('Subscription currency is not configured or supported');
    const total = items.reduce((sum, item) => sum + item.amountMinor, 0);
    const id = db.transaction(() => {
      if (invoiceId && db.prepare("SELECT id FROM billing_payments WHERE invoice_id = ? AND status IN ('pending', 'approved')").get(invoiceId)) throw new Error('An active payment already exists for this invoice');
      const payment = db.prepare('INSERT INTO billing_payments (reference, invoice_id, submitted_by, currency, total_minor, method, provider_reference, academic_year, company_snapshot) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(ref('PAY'), invoiceId || null, req.user.id, currency, total, method, providerReference.trim(), term, JSON.stringify(company()));
      for (const item of items) db.prepare('INSERT INTO billing_allocations (payment_id, student_id, amount_minor) VALUES (?, ?, ?)').run(payment.lastInsertRowid, item.studentId, item.amountMinor);
      return payment.lastInsertRowid;
    })();
    res.status(201).json({ id, message: 'Payment recorded, pending approval. No charge was processed by this website.' });
  } catch (error) {
    res.status(400).json({ error: error.code?.startsWith('SQLITE_CONSTRAINT') ? 'This payment reference is already recorded or the record is invalid' : error.message });
  }
});

router.post('/invoices', requireRole('admin'), (req, res) => {
  try {
    const { schoolName, contactEmail, currency } = req.body;
    if (typeof schoolName !== 'string' || !schoolName.trim() || schoolName.length > 200) throw new Error('School name is required (maximum 200 characters)');
    if (!currencies.includes(currency)) throw new Error('Choose USD or LRD');
    if (contactEmail && (typeof contactEmail !== 'string' || !/^\S+@\S+\.\S+$/.test(contactEmail))) throw new Error('Invalid contact email');
    const items = allocations(req.body.allocations);
    const id = db.transaction(() => {
      const result = db.prepare('INSERT INTO billing_invoices (reference, school_name, contact_email, currency, total_minor, created_by, academic_year, company_snapshot) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(ref('INV'), schoolName.trim(), contactEmail || null, currency, items.reduce((sum, item) => sum + item.amountMinor, 0), req.user.id, term, JSON.stringify(company()));
      for (const item of items) db.prepare('INSERT INTO billing_invoice_items (invoice_id, student_id, amount_minor) VALUES (?, ?, ?)').run(result.lastInsertRowid, item.studentId, item.amountMinor);
      return result.lastInsertRowid;
    })();
    res.status(201).json({ id });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.patch('/:id/review', requireRole('admin'), (req, res) => {
  try {
    const { status, note } = req.body;
    if (!['approved', 'rejected'].includes(status)) throw new Error('Choose approved or rejected');
    if (typeof note !== 'string' || !note.trim() || note.length > 1000) throw new Error('A review note is required (maximum 1000 characters)');
    db.transaction(() => {
      const payment = db.prepare(`SELECT * FROM billing_payments WHERE id = ? ${db.dialect === 'postgres' ? 'FOR UPDATE' : ''}`).get(req.params.id);
      if (!payment || payment.status !== 'pending') throw new Error('Payment is missing or already reviewed');
      db.prepare('UPDATE billing_payments SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = ?').run(status, note.trim(), req.user.id, payment.id, 'pending');
      if (status === 'approved') {
        const items = db.prepare('SELECT * FROM billing_allocations WHERE payment_id = ?').all(payment.id);
        for (const item of items) {
          db.prepare('INSERT INTO billing_receipts (reference, allocation_id) VALUES (?, ?)').run(ref('RCT'), item.id);
          db.prepare(db.dialect === 'postgres'
            ? "UPDATE users SET is_premium = 1, subscription_expires_at = GREATEST(COALESCE(subscription_expires_at, now()), now()) + interval '1 year' WHERE id = ?"
            : "UPDATE users SET is_premium = 1, subscription_expires_at = datetime(MAX(COALESCE(subscription_expires_at, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP), '+1 year') WHERE id = ?").run(item.student_id);
        }
        if (payment.invoice_id) db.prepare("UPDATE billing_invoices SET status = 'paid' WHERE id = ?").run(payment.invoice_id);
      }
    })();
    res.json({ message: `Payment ${status}` });
  } catch (error) {
    res.status(409).json({ error: error.message });
  }
});

router.get('/verify/:reference', (req, res) => {
  const receipt = db.prepare(`SELECT r.reference, r.issued_at, p.status FROM billing_receipts r JOIN billing_allocations a ON a.id = r.allocation_id JOIN billing_payments p ON p.id = a.payment_id WHERE r.reference = ?`).get(req.params.reference);
  const invoice = db.prepare('SELECT reference, created_at, status FROM billing_invoices WHERE reference = ?').get(req.params.reference);
  const document = receipt || invoice;
  if (!document) return res.status(404).json({ error: 'Reference not found' });
  res.json({ document });
});

function documentHtml(title, reference, status, currency, rows, date) {
  const business = company();
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)} ${escape(reference)}</title><style>body{font:16px system-ui;max-width:900px;margin:24px auto;padding:20px;color:#172d27}header{border-bottom:3px solid #16834a;padding-bottom:24px}img{width:80px}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:12px;border-bottom:1px solid #ddd;overflow-wrap:anywhere}small{overflow-wrap:anywhere}@media print{button{display:none}}</style></head><body><header><img src="${escape(business.logo)}" alt="Company logo"><h1>${escape(business.name)}</h1><p>${escape(business.address)}</p></header><h2>${escape(title)}</h2><p><strong>REF #</strong> <small>${escape(reference)}</small></p><p>Status: ${escape(status)} · Issued: ${escape(date)}</p><table><thead><tr><th>Student</th><th>Amount (${escape(currency)})</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escape(row.student_name)}</td><td>${(row.amount_minor / 100).toFixed(2)}</td></tr>`).join('')}</tbody><tfoot><tr><th>Total</th><th>${(rows.reduce((sum, row) => sum + row.amount_minor, 0) / 100).toFixed(2)} ${escape(currency)}</th></tr></tfoot></table><p>Verify this REF # using the signed-in Payments page.</p><p>Manual payment records are confirmed only after administrator approval.</p></body></html>`;
}

router.get('/receipts/:id/download', async (req, res) => {
  const receipt = await db.prepare(`SELECT r.*, a.student_id, a.amount_minor, p.submitted_by, p.currency, p.status, p.company_snapshot, p.academic_year, u.first_name || ' ' || u.last_name AS student_name FROM billing_receipts r JOIN billing_allocations a ON a.id = r.allocation_id JOIN billing_payments p ON p.id = a.payment_id JOIN users u ON u.id = a.student_id WHERE r.id = ?`).get(req.params.id);
  if (!receipt) return res.status(404).json({ error: 'Receipt not found' });
  if (req.user.role !== 'admin' && receipt.student_id !== req.user.id && receipt.submitted_by !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  res.setHeader('Content-Disposition', `attachment; filename="${receipt.reference}.pdf"`);
  res.type('pdf').send(await renderBillingPdf({ title: 'Payment Receipt', reference: receipt.reference, status: receipt.status, currency: receipt.currency, rows: [receipt], date: receipt.issued_at, term: receipt.academic_year, company: receipt.company_snapshot ? JSON.parse(receipt.company_snapshot) : company() }));
});

router.get('/invoices/:id/download', requireRole('admin'), async (req, res) => {
  const invoice = await db.prepare('SELECT * FROM billing_invoices WHERE id = ?').get(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  const items = await db.prepare("SELECT i.amount_minor, u.first_name || ' ' || u.last_name AS student_name FROM billing_invoice_items i JOIN users u ON u.id = i.student_id WHERE i.invoice_id = ?").all(invoice.id);
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.reference}.pdf"`);
  res.type('pdf').send(await renderBillingPdf({ title: `Invoice - ${invoice.school_name}`, reference: invoice.reference, status: invoice.status, currency: invoice.currency, rows: items, date: invoice.created_at, term: invoice.academic_year, company: invoice.company_snapshot ? JSON.parse(invoice.company_snapshot) : company() }));
});

router.post('/invoices/:id/send', requireRole('admin'), async (req, res) => {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return res.status(503).json({ error: 'Invoice email delivery requires a verified EMAIL_FROM and RESEND_API_KEY. Download the PDF and send it manually meanwhile.' });
  const invoice = await db.prepare('SELECT * FROM billing_invoices WHERE id = ?').get(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  if (!invoice.contact_email) return res.status(400).json({ error: 'The invoice needs a school contact email' });
  const rows = await db.prepare("SELECT i.amount_minor, u.first_name || ' ' || u.last_name AS student_name FROM billing_invoice_items i JOIN users u ON u.id = i.student_id WHERE i.invoice_id = ?").all(invoice.id);
  const business = invoice.company_snapshot ? JSON.parse(invoice.company_snapshot) : company();
  const pdf = await renderBillingPdf({ title: `Invoice - ${invoice.school_name}`, reference: invoice.reference, status: invoice.status, currency: invoice.currency, rows, date: invoice.created_at, term: invoice.academic_year, company: business });
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': invoice.reference }, body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [invoice.contact_email], subject: `${business.name} school invoice ${invoice.reference}`, text: `Dear ${invoice.school_name},\nPlease find your student subscription invoice attached.\nReference: ${invoice.reference}\nTotal: ${(invoice.total_minor / 100).toFixed(2)} ${invoice.currency}\n${business.address}`, attachments: [{ filename: `${invoice.reference}.pdf`, content: pdf.toString('base64') }] }) });
  if (!response.ok) return res.status(502).json({ error: 'Email provider did not accept the invoice. Check the verified sender configuration.' });
  res.json({ message: 'Invoice accepted by the email provider' });
});

export default router;
