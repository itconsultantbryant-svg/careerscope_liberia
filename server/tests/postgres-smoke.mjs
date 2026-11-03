import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

process.env.JWT_SECRET ||= randomBytes(32).toString('hex');
process.env.NODE_ENV = 'test';
const { default: app } = await import('../app.js');
const { pool } = await import('../db/postgres.js');
const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const cookies = {};
let previewAccounts = [];
try { previewAccounts = JSON.parse(await readFile(new URL('../.env.accounts.local', import.meta.url), 'utf8')).preview || []; } catch { /* Fresh test branch uses original test passwords. */ }
let checks = 0;
async function call(path, role, method = 'GET', body, expected = 200) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(cookies[role] ? { Cookie: cookies[role] } : {}), ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) }, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
  const content = response.headers.get('content-type') || '';
  const data = content.includes('application/json') ? await response.json() : Buffer.from(await response.arrayBuffer());
  assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`);
  checks++;
  return { response, data };
}
try {
  await call('/api/health');
  for (const [role, phone, password] of [['student', '0771234567', 'student123'], ['counselor', '0881234567', 'counselor123'], ['admin', '0880000000', 'Liberia2025!']]) {
    const { response } = await call('/api/auth/login', role, 'POST', { role, phone, password: previewAccounts.find((account) => account.role === role)?.password || password });
    cookies[role] = response.headers.get('set-cookie').split(';')[0];
  }
  for (const [role, paths] of [
    ['student', ['/auth/me','/appointments/student','/learning/materials/student','/learning/grades/student','/progress/student','/sessions/student','/schedules/student','/users/counselors/list','/careers/student/interests','/quiz/career-assessment','/quiz/check-completion','/quiz/results','/billing','/billing/plan','/notifications','/messages/conversations','/posts','/groups']],
    ['counselor', ['/auth/me','/appointments/counselor','/learning/materials/counselor','/users/students/list','/schedules/counselor','/progress/all','/reports/counselor','/sessions/counselor']],
    ['admin', ['/admin/users','/admin/analytics','/reports/all','/sessions/all','/careers','/progress/all','/schedules/all','/appointments/all','/admin/export/users','/billing']],
  ]) for (const path of paths) await call(`/api${path}`, role);
  await call('/api/admin/users', 'student', 'GET', undefined, 403);
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  const registered = (await call('/api/auth/register/student', undefined, 'POST', { firstName: 'Migration', lastName: 'Student', phone: `+1555${Date.now().toString().slice(-8)}`, email: `migration-${suffix}@example.test`, country: 'United States', county: 'Virginia', schoolName: 'Test Academy', gradeLevel: 10, password: `Migration#${suffix}` }, 201)).data;
  assert.ok(registered.userId); checks++;
  const material = (await call('/api/learning/materials', 'counselor', 'POST', { studentId: 2, materialType: 'assignment', title: 'Postgres assignment', points: 50 }, 201)).data;
  const submission = (await call('/api/learning/submit', 'student', 'POST', { materialId: material.materialId, submissionContent: 'Completed test' }, 201)).data;
  await call(`/api/learning/submissions/${material.materialId}`, 'counselor');
  await call('/api/learning/grade', 'counselor', 'POST', { submissionId: submission.submissionId, score: 45, maxScore: 50, feedback: 'Verified' });
  await call('/api/learning/materials', 'counselor', 'POST', { studentId: 2, materialType: 'note', title: 'Postgres note', content: 'Test note' }, 201);
  await call('/api/learning/materials', 'counselor', 'POST', { studentId: 2, materialType: 'quiz', title: 'Postgres quiz', questions: [{ question: 'Test?', options: ['A', 'B'], correctAnswer: 'A', points: 1 }] }, 201);
  await call('/api/learning/materials/student', 'student');
  const appointment = (await call('/api/appointments', 'student', 'POST', { counselorId: 3, appointmentDate: '2027-01-15', appointmentTime: '10:00' }, 201)).data;
  await call(`/api/appointments/${appointment.appointmentId}/status`, 'counselor', 'PATCH', { status: 'accepted' });
  await call('/api/sessions', 'counselor', 'POST', { appointmentId: appointment.appointmentId, studentId: 2, counselorId: 3, sessionTitle: 'Postgres session', sessionType: 'counseling' }, 201);
  await call('/api/admin/counselors', 'admin', 'POST', { firstName: 'Migration', lastName: 'Counselor', phone: `+1666${Date.now().toString().slice(-8)}`, password: `Counselor#${suffix}`, careerIds: [1], isApproved: true }, 201);
  await call('/api/admin/users', 'admin');
  const profile = new FormData(); profile.set('city', 'Neon smoke test');
  await call('/api/users/profile', 'student', 'PUT', profile);
  const post = new FormData(); post.set('content', 'PostgreSQL migration smoke test');
  const { data: createdPost } = await call('/api/posts', 'student', 'POST', post, 201);
  await call(`/api/posts/${createdPost.post.id}/like`, 'student', 'POST', {});
  await call(`/api/posts/${createdPost.post.id}/comments`, 'student', 'POST', { content: 'Verified' }, 201);
  await call(`/api/posts/${createdPost.post.id}/comments`, 'student');
  const cursor = (await call('/api/realtime/events', 'counselor')).data.cursor;
  const message = new FormData(); message.set('content', 'Neon realtime test'); message.set('receiverId', '3');
  const { data: savedMessage } = await call('/api/messages', 'student', 'POST', message, 201);
  await call('/api/realtime/publish', 'student', 'POST', { event: 'send_message', data: { id: savedMessage.messageData.id } });
  const received = await call(`/api/realtime/events?after=${cursor}`, 'counselor');
  assert.ok(received.data.events.some((event) => event.event === 'new_message' && event.payload.id === savedMessage.messageData.id)); checks++;
  await call('/api/realtime/publish', 'admin', 'POST', { event: 'send_message', data: { id: savedMessage.messageData.id } }, 403);
  await call('/api/messages/3', 'student');
  await call('/api/messages/conversations', 'student');
  const { data: payment } = await call('/api/billing', 'student', 'POST', { method: 'orange_money', providerReference: `TEST-${randomUUID()}` }, 201);
  const reviews = await Promise.all([
    fetch(`${base}/api/billing/${payment.id}/review`, { method: 'PATCH', headers: { Cookie: cookies.admin, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'approved', note: 'Smoke test approval' }) }),
    fetch(`${base}/api/billing/${payment.id}/review`, { method: 'PATCH', headers: { Cookie: cookies.admin, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'approved', note: 'Concurrent test approval' }) }),
  ]);
  assert.deepEqual(reviews.map((r) => r.status).sort(), [200, 409]); checks++;
  const ledger = (await call('/api/billing', 'student')).data;
  const receipt = ledger.payments.find((row) => row.id === payment.id);
  assert.equal(receipt.amount_minor, 2000); checks++;
  const pdf = await call(`/api/billing/receipts/${receipt.receipt_id}/download`, 'student');
  assert.equal(pdf.data.subarray(0, 4).toString(), '%PDF'); checks++;
  await call(`/api/billing/verify/${receipt.receipt_reference}`, 'admin');
  const invoice = (await call('/api/billing/invoices', 'admin', 'POST', { schoolName: 'Migration Test School', currency: 'USD', allocations: [{ studentId: 2, amountMinor: 2000 }] }, 201)).data;
  const invoicePayment = (await call('/api/billing', 'admin', 'POST', { invoiceId: invoice.id, method: 'bank_transfer', providerReference: `INV-${randomUUID()}` }, 201)).data;
  await call(`/api/billing/${invoicePayment.id}/review`, 'admin', 'PATCH', { status: 'approved', note: 'Verified invoice payment' });
  const invoicePdf = await call(`/api/billing/invoices/${invoice.id}/download`, 'admin');
  assert.equal(invoicePdf.data.subarray(0,4).toString(), '%PDF'); checks++;
  const image = new FormData(); image.set('profileImage', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+k9WsAAAAASUVORK5CYII=', 'base64')], {type: 'image/png'}), 'test.png');
  const uploaded = (await call('/api/users/profile', 'student', 'PUT', image)).data.user.profile_image;
  await call(uploaded, 'student');
  console.log(`PostgreSQL smoke checks passed: ${checks}. Auth, all dashboards, mutations, transactions, PDF billing, uploads and event delivery verified.`);
} finally {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
}
