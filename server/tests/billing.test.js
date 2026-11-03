import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

let temp;
let db;
let server;
let base;
let student;
let counselor;
let admin;

before(async () => {
  temp = await mkdtemp(join(tmpdir(), 'careerscope-billing-'));
  process.env.DATABASE_PATH = join(temp, 'test.db');
  process.env.JWT_SECRET = 'isolated-test-secret-not-for-production';
  process.env.SUBSCRIPTION_AMOUNT_MINOR = '1500';
  process.env.SUBSCRIPTION_CURRENCY = 'USD';
  const database = await import('../db/init.js');
  db = database.db;
  database.initDatabase();
  const router = (await import('../routes/billing.js')).default;
  const app = express();
  app.use(express.json(), cookieParser());
  app.use('/billing', router);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/billing`;
  for (const role of ['student', 'counselor', 'admin']) {
    const user = db.prepare('SELECT id, role FROM users WHERE role = ?').get(role);
    const auth = { id: user.id, token: jwt.sign(user, process.env.JWT_SECRET) };
    if (role === 'student') student = auth;
    if (role === 'counselor') counselor = auth;
    if (role === 'admin') admin = auth;
  }
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  db?.close();
  if (temp) await rm(temp, { recursive: true, force: true });
});

async function request(path = '', user = student, method = 'GET', body) {
  const response = await fetch(`${base}${path}`, { method, headers: { Cookie: `token=${user.token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : Buffer.from(await response.arrayBuffer());
  return { status: response.status, data };
}

test('student payment uses server pricing, not client-supplied allocations', async () => {
  const response = await request('', student, 'POST', { providerReference: 'TEST-STUDENT-001', method: 'mobile_money', currency: 'LRD', allocations: [{ studentId: admin.id, amountMinor: 1 }] });
  assert.equal(response.status, 201);
  const payment = db.prepare('SELECT * FROM billing_payments WHERE id = ?').get(response.data.id);
  assert.equal(payment.total_minor, 1500);
  assert.equal(payment.currency, 'USD');
  assert.equal(payment.status, 'pending');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM billing_receipts').get().count, 0);
});

test('duplicate external references are rejected', async () => {
  assert.equal((await request('', student, 'POST', { providerReference: 'TEST-STUDENT-001', method: 'mobile_money' })).status, 400);
});

test('only admin can approve; approval creates one verifiable receipt', async () => {
  const payment = db.prepare('SELECT id FROM billing_payments').get();
  assert.equal((await request(`/${payment.id}/review`, student, 'PATCH', { status: 'approved', note: 'Forged' })).status, 403);
  assert.equal((await request(`/${payment.id}/review`, admin, 'PATCH', { status: 'approved', note: 'Confirmed with bank' })).status, 200);
  assert.equal((await request(`/${payment.id}/review`, admin, 'PATCH', { status: 'approved', note: 'Duplicate review' })).status, 409);
  const receipt = db.prepare('SELECT * FROM billing_receipts').get();
  assert.equal((await request(`/verify/${receipt.reference}`)).status, 200);
  const download = await request(`/receipts/${receipt.id}/download`);
  assert.equal(download.status, 200);
  assert.equal(download.data.subarray(0, 4).toString(), '%PDF');
  assert.match(download.data.toString(), /\/Subtype \/Image/);
  assert.equal((await request(`/receipts/${receipt.id}/download`, counselor)).status, 403);
});

test('rejected payment has no receipt', async () => {
  const created = await request('', admin, 'POST', { providerReference: 'TEST-REJECT-002', method: 'bank_transfer', currency: 'USD', allocations: [{ studentId: student.id, amountMinor: 2000 }] });
  assert.equal(created.status, 201);
  assert.equal((await request(`/${created.data.id}/review`, admin, 'PATCH', { status: 'rejected', note: 'Reference cannot be verified' })).status, 200);
  const count = db.prepare('SELECT COUNT(*) AS count FROM billing_receipts r JOIN billing_allocations a ON a.id = r.allocation_id WHERE a.payment_id = ?').get(created.data.id);
  assert.equal(count.count, 0);
});

test('school invoice records allocations, blocks duplicate active payments, and settles atomically', async () => {
  const secondId = db.prepare("INSERT INTO users (phone, password, first_name, last_name, role, is_approved) VALUES ('0770000001', 'not-a-login', 'Second', 'Student', 'student', 1)").run().lastInsertRowid;
  const created = await request('/invoices', admin, 'POST', { schoolName: 'School <Test>', currency: 'USD', allocations: [{ studentId: student.id, amountMinor: 5000 }, { studentId: secondId, amountMinor: 5000 }] });
  assert.equal(created.status, 201);
  const paid = await request('', admin, 'POST', { invoiceId: created.data.id, method: 'bank_transfer', providerReference: 'SCHOOL-001' });
  assert.equal(paid.status, 201);
  assert.equal((await request('', admin, 'POST', { invoiceId: created.data.id, method: 'bank_transfer', providerReference: 'SCHOOL-002' })).status, 400);
  assert.equal((await request(`/${paid.data.id}/review`, admin, 'PATCH', { status: 'approved', note: 'School transfer verified' })).status, 200);
  assert.equal(db.prepare('SELECT status FROM billing_invoices WHERE id = ?').get(created.data.id).status, 'paid');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM billing_receipts r JOIN billing_allocations a ON a.id = r.allocation_id WHERE a.payment_id = ?').get(paid.data.id).count, 2);
  const own = await request('');
  assert.equal(own.data.payments.some((row) => row.student_id === secondId), false);
  const invoice = await request(`/invoices/${created.data.id}/download`, admin);
  assert.equal(invoice.data.subarray(0, 4).toString(), '%PDF');
});

test('disabled users cannot reuse a previously valid session', async () => {
  db.prepare('UPDATE users SET is_disabled = 1 WHERE id = ?').run(student.id);
  assert.equal((await request('')).status, 401);
  db.prepare('UPDATE users SET is_disabled = 0 WHERE id = ?').run(student.id);
});
