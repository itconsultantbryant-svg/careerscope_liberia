import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const [url, environment] = process.argv.slice(2);
if (!url?.startsWith('https://') || !['production', 'preview'].includes(environment)) throw new Error('Provide deployment HTTPS URL and production or preview');
const root = resolve(import.meta.dirname, '../..');
const accounts = JSON.parse(await readFile(resolve(root, 'server/.env.accounts.local'), 'utf8'))[environment];
const temp = await mkdtemp(join(tmpdir(), 'careerscope-deployment-'));
let checks = 0;
async function request(path, role = 'guest', method = 'GET', body, expected = 200) {
  const file = join(temp, 'response');
  const cookie = join(temp, `${role}.cookies`);
  const args = ['curl', path, '--deployment', url, '--', '--silent', '--show-error', '--cookie-jar', cookie, '--cookie', cookie, '--output', file, '--write-out', '%{http_code}', '--request', method];
  if (body) args.push('--header', 'Content-Type: application/json', '--data-binary', '@-');
  const response = spawnSync(resolve(root, 'node_modules/.bin/vercel'), args, { cwd: root, input: body ? JSON.stringify(body) : undefined, encoding: 'utf8', timeout: 60000 });
  assert.equal(response.status, 0, `CLI request failed for ${path}`);
  const status = Number(response.stdout.trim().match(/\d{3}$/)?.[0]);
  const buffer = await readFile(file);
  assert.equal(status, expected, `${role} ${method} ${path}: HTTP ${status}`);
  checks++;
  return buffer;
}
try {
  const health = JSON.parse(await request('/api/health'));
  assert.equal(health.database, 'postgresql');
  await request('/');
  for (const account of accounts) {
    await request('/api/auth/login', account.role, 'POST', { email: account.email, role: account.role, password: account.password });
    await request('/api/auth/me', account.role);
  }
  for (const [path, role] of [['/api/admin/users','admin'], ['/api/admin/analytics','admin'], ['/api/billing','admin'], ['/api/schedules/all','admin'], ['/api/progress/student','student'], ['/api/learning/materials/student','student'], ['/api/appointments/student','student'], ['/api/sessions/counselor','counselor'], ['/api/users/students/list','counselor'], ['/api/realtime/events','student']]) await request(path, role);
  const plan = JSON.parse(await request('/api/billing/plan', 'student'));
  for (const role of ['student', 'counselor', 'admin']) {
    await request('/api/planner/overview', role);
    await request('/api/archive', role);
  }
  await request('/api/management/users', 'admin');
  await request('/api/management/users', 'student', 'GET', undefined, 403);
  const ai = JSON.parse(await request('/api/ai-counselors', 'student'));
  assert.equal(ai.counselors.length, 50);
  assert.ok(ai.counselors.every((profile) => !profile.is_enabled));
  assert.equal(plan.amountMinor, 2000);
  assert.equal(plan.currency, 'USD');
  await request('/api/admin/users', 'student', 'GET', undefined, 403);
  const ledger = JSON.parse(await request('/api/billing', 'student'));
  const receipt = ledger.payments.find((payment) => payment.receipt_id);
  if (receipt) {
    const pdf = await request(`/api/billing/receipts/${receipt.receipt_id}/download`, 'student');
    assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  }
  console.log(`Live ${environment} deployment passed ${checks} checks. Credentials and session cookies were not logged.`);
} finally { await rm(temp, { recursive: true, force: true }); }
