import express from 'express';
import { randomUUID } from 'node:crypto';
import { db, query } from '../db/postgres.js';
import { authenticate, requireRole } from '../middleware/pg-auth.js';
import { admins, fail, notify, numericId } from '../services/notifications.js';
import { publish } from '../routes/realtime.js';

const router=express.Router();
router.use(authenticate);
const ref=(prefix)=>`${prefix}-${randomUUID().toUpperCase()}`;
const term='Academic year (12 months from approval)';
const company=()=>JSON.stringify({name:process.env.COMPANY_NAME||'CareerScope',address:process.env.COMPANY_ADDRESS||'Sinkor, Monrovia, Liberia',logo:process.env.COMPANY_LOGO_URL||'/assets/careerscope_logo.jpeg'});
const amount=()=>Number(process.env.SUBSCRIPTION_AMOUNT_MINOR||2000);
const currency=()=>process.env.SUBSCRIPTION_CURRENCY||'USD';
function items(input) {
  if(!Array.isArray(input)||!input.length||input.length>500) throw fail(400,'Choose between 1 and 500 students');
  const result=input.map(i=>({studentId:numericId(i.studentId),amountMinor:Number(i.amountMinor)})).sort((a,b)=>a.studentId-b.studentId);
  if(new Set(result.map(i=>i.studentId)).size!==result.length||result.some(i=>!Number.isSafeInteger(i.amountMinor)||i.amountMinor<=0||i.amountMinor>100000000)) throw fail(400,'Invalid or duplicate student allocation');
  return result;
}
async function coverageLock(allocations,{invoiceId=null,paymentId=null}={}) {
  for(const item of allocations) {
    const student=(await query("SELECT * FROM users WHERE id=$1 AND role='student' AND is_disabled=0 AND deleted_at IS NULL FOR UPDATE",[item.studentId])).rows[0];
    if(!student) throw fail(400,'Student not found or disabled');
    if(student.subscription_expires_at&&new Date(student.subscription_expires_at)>new Date()) throw fail(409,`${student.first_name} ${student.last_name} is already covered for this academic year`);
    if((await query("SELECT p.id FROM billing_payments p JOIN billing_allocations a ON a.payment_id=p.id WHERE a.student_id=$1 AND p.status='pending' AND ($2::integer IS NULL OR p.id<>$2)",[item.studentId,paymentId])).rowCount) throw fail(409,'A payment for this student is already awaiting review');
    if((await query("SELECT i.id FROM billing_invoices i JOIN billing_invoice_items a ON a.invoice_id=i.id WHERE a.student_id=$1 AND i.status='issued' AND ($2::integer IS NULL OR i.id<>$2)",[item.studentId,invoiceId])).rowCount) throw fail(409,'An institution invoice already covers this student; record its payment or cancel that invoice first');
  }
}
async function changed(studentIds,title,message) {
  for(const id of studentIds) await notify(id,'payment',title,message,'/student/payments');
  await publish('billing_changed',{},[...studentIds,...await admins()]);
}
router.get('/plan',async(req,res)=>{
  const user=(await query('SELECT subscription_expires_at,counseling_completed_at FROM users WHERE id=$1',[req.user.id])).rows[0];
  const pending=(await query("SELECT p.id FROM billing_payments p JOIN billing_allocations a ON a.payment_id=p.id WHERE a.student_id=$1 AND p.status='pending' LIMIT 1",[req.user.id])).rowCount>0;
  const invoiced=(await query("SELECT i.school_name FROM billing_invoices i JOIN billing_invoice_items a ON a.invoice_id=i.id WHERE a.student_id=$1 AND i.status='issued' LIMIT 1",[req.user.id])).rows[0];
  const sponsor=(await query("SELECT COALESCE(p.payer_institution,i.school_name) AS name,p.payer_details FROM billing_payments p JOIN billing_allocations a ON a.payment_id=p.id LEFT JOIN billing_invoices i ON i.id=p.invoice_id WHERE a.student_id=$1 AND p.status='approved' ORDER BY p.reviewed_at DESC LIMIT 1",[req.user.id])).rows[0];
  const covered=!!user.subscription_expires_at&&new Date(user.subscription_expires_at)>new Date();
  res.json({configured:Number.isSafeInteger(amount())&&amount()>0&&['USD','LRD'].includes(currency()),term,amountMinor:amount(),currency:currency(),subscriptionExpiresAt:user.subscription_expires_at,covered,pending,invoicedBy:invoiced?.school_name,sponsor,canPay:!covered&&!pending&&!invoiced,isAlumni:!!user.counseling_completed_at&&!covered,instructions:process.env.PAYMENT_INSTRUCTIONS||'Pay externally via Mobile Money, Orange Money, bank, or merchant VISA checkout. Submit the transaction reference only, never card details, PINs or OTPs.'});
});
router.post('/',requireRole('student','admin'),async(req,res)=>{
  const {method,providerReference}=req.body;
  if(!['mobile_money','orange_money','bank_transfer','visa','cash'].includes(method)||typeof providerReference!=='string'||!providerReference.trim()||providerReference.length>200) throw fail(400,'Valid payment method and provider transaction reference required');
  if(req.user.role==='student'&&(method==='cash'||req.body.invoiceId)) throw fail(403,'Only administrators can record cash or invoice payments');
  const id=await db.transaction(async()=>{
    const invoiceId=req.body.invoiceId?numericId(req.body.invoiceId):null;
    let allocations,unit,payerInstitution=String(req.body.schoolName||'').trim().slice(0,200)||null;
    if(invoiceId) {
      const invoice=(await query("SELECT * FROM billing_invoices WHERE id=$1 AND status='issued' FOR UPDATE",[invoiceId])).rows[0];
      if(!invoice) throw fail(409,'Invoice missing, cancelled or already paid');
      allocations=items((await query('SELECT student_id AS "studentId",amount_minor AS "amountMinor" FROM billing_invoice_items WHERE invoice_id=$1',[invoiceId])).rows);
      unit=invoice.currency;payerInstitution=invoice.school_name;
      if((await query("SELECT id FROM billing_payments WHERE invoice_id=$1 AND status IN ('pending','approved')",[invoiceId])).rowCount) throw fail(409,'An active payment already exists for this invoice');
    } else { allocations=items(req.user.role==='student'?[{studentId:req.user.id,amountMinor:amount()}]:req.body.allocations);unit=req.user.role==='student'?currency():req.body.currency; }
    if(!['USD','LRD'].includes(unit)) throw fail(400,'Choose USD or LRD');
    await coverageLock(allocations,{invoiceId});
    const payment=(await query('INSERT INTO billing_payments(reference,invoice_id,submitted_by,currency,total_minor,method,provider_reference,academic_year,company_snapshot,payer_institution,payer_details) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id',[ref('PAY'),invoiceId,req.user.id,unit,allocations.reduce((s,i)=>s+i.amountMinor,0),method,providerReference.trim(),term,company(),req.user.role==='admin'?payerInstitution:null,req.user.role==='admin'?String(req.body.payerDetails||'').slice(0,1000):null])).rows[0];
    for(const item of allocations) await query("INSERT INTO billing_allocations(payment_id,student_id,amount_minor,student_name_snapshot) SELECT $1,id,$3,first_name || ' ' || last_name FROM users WHERE id=$2",[payment.id,item.studentId,item.amountMinor]);
    await changed(allocations.map(i=>i.studentId),'Payment awaiting review',payerInstitution?`${payerInstitution} submitted your academic-year payment. Do not pay again while it is under review.`:'Your payment reference is awaiting administrator review.');
    for(const id of await admins()) await notify(id,'payment','Payment submitted','A transaction is ready for review.','/admin/payments',payment.id);
    return payment.id;
  })();
  res.status(201).json({id,message:'Payment recorded for manual review; this website did not charge an account.'});
});
router.post('/invoices',requireRole('admin'),async(req,res)=>{
  const {schoolName,contactEmail,currency:unit}=req.body;
  if(typeof schoolName!=='string'||!schoolName.trim()||schoolName.length>200||!['USD','LRD'].includes(unit)||(contactEmail&&!/^\S+@\S+\.\S+$/.test(contactEmail))) throw fail(400,'Valid school name, currency and contact email required');
  const allocations=items(req.body.allocations);
  const id=await db.transaction(async()=>{
    await coverageLock(allocations);
    const invoice=(await query('INSERT INTO billing_invoices(reference,school_name,contact_email,currency,total_minor,created_by,academic_year,company_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',[ref('INV'),schoolName.trim(),contactEmail||null,unit,allocations.reduce((s,i)=>s+i.amountMinor,0),req.user.id,term,company()])).rows[0];
    for(const item of allocations) await query("INSERT INTO billing_invoice_items(invoice_id,student_id,amount_minor,student_name_snapshot) SELECT $1,id,$3,first_name || ' ' || last_name FROM users WHERE id=$2",[invoice.id,item.studentId,item.amountMinor]);
    await changed(allocations.map(i=>i.studentId),'Institution invoice issued',`${schoolName} has been invoiced for your subscription. Please do not make a separate payment.`);
    return invoice.id;
  })();
  res.status(201).json({id});
});
router.patch('/invoices/:id/cancel',requireRole('admin'),async(req,res)=>{
  await db.transaction(async()=>{
    const invoice=(await query("SELECT * FROM billing_invoices WHERE id=$1 AND status='issued' FOR UPDATE",[numericId(req.params.id)])).rows[0];
    if(!invoice) throw fail(409,'Only issued invoices can be cancelled');
    if((await query("SELECT id FROM billing_payments WHERE invoice_id=$1 AND status IN ('pending','approved')",[invoice.id])).rowCount) throw fail(409,'Review the active invoice payment first');
    await query("UPDATE billing_invoices SET status='cancelled' WHERE id=$1",[invoice.id]);
    const ids=(await query('SELECT student_id FROM billing_invoice_items WHERE invoice_id=$1',[invoice.id])).rows.map(r=>r.student_id);
    await changed(ids,'Institution invoice cancelled','The institution invoice was cancelled. Check your payment page before paying.');
  })();
  res.json({cancelled:true});
});
router.patch('/:id/review',requireRole('admin'),async(req,res)=>{
  const {status,note}=req.body;
  if(!['approved','rejected'].includes(status)||typeof note!=='string'||!note.trim()||note.length>1000) throw fail(400,'Approval/rejection and a review note are required');
  await db.transaction(async()=>{
    const payment=(await query('SELECT * FROM billing_payments WHERE id=$1 FOR UPDATE',[numericId(req.params.id)])).rows[0];
    if(!payment||payment.status!=='pending') throw fail(409,'Payment is missing or already reviewed');
    const allocations=(await query('SELECT id,student_id AS "studentId",amount_minor AS "amountMinor" FROM billing_allocations WHERE payment_id=$1 ORDER BY student_id',[payment.id])).rows;
    if(status==='approved') await coverageLock(allocations,{invoiceId:payment.invoice_id,paymentId:payment.id});
    await query('UPDATE billing_payments SET status=$1,review_note=$2,reviewed_by=$3,reviewed_at=now() WHERE id=$4',[status,note.trim(),req.user.id,payment.id]);
    if(status==='approved') {
      for(const item of allocations) {
        await query('INSERT INTO billing_receipts(reference,allocation_id) VALUES($1,$2)',[ref('RCT'),item.id]);
        await query("UPDATE users SET is_premium=1,subscription_expires_at=now()+interval '1 year' WHERE id=$1",[item.studentId]);
      }
      if(payment.invoice_id) await query("UPDATE billing_invoices SET status='paid' WHERE id=$1",[payment.invoice_id]);
    }
    await changed(allocations.map(i=>i.studentId),`Payment ${status}`,status==='approved'?'Your academic-year subscription is active for 12 months. Your numbered receipt is available.':'Your payment was rejected. Review the administrator note before resubmitting.');
  })();
  res.json({message:`Payment ${status}`});
});
router.get('/verify/:reference',async(req,res)=>{
  const reference=String(req.params.reference).slice(0,100);
  const admin=req.user.role==='admin';
  const document=(await query(`SELECT r.reference,p.status,r.issued_at AS created_at,'receipt' AS kind FROM billing_receipts r JOIN billing_allocations a ON a.id=r.allocation_id JOIN billing_payments p ON p.id=a.payment_id WHERE r.reference=$1 AND ($2 OR a.student_id=$3 OR p.submitted_by=$3)
    UNION ALL SELECT p.reference,p.status,p.created_at,'transaction' FROM billing_payments p WHERE p.reference=$1 AND ($2 OR p.submitted_by=$3 OR EXISTS(SELECT 1 FROM billing_allocations a WHERE a.payment_id=p.id AND a.student_id=$3))
    UNION ALL SELECT reference,status,created_at,'invoice' FROM billing_invoices WHERE reference=$1 AND $2`,[reference,admin,req.user.id])).rows[0];
  if(!document) throw fail(404,'Reference not found or not available to this account');
  res.json({document});
});
export default router;
