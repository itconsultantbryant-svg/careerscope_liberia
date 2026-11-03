// Rotate only documented demo passwords before exposing either deployment.
// Existing real passwords are never changed. New credentials stay in an ignored
// owner-readable local file, not in CLI output or Git.
import { readFile, writeFile, rename } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

const root = new URL('../', import.meta.url);
const target = new URL('.env.accounts.local', root);
let accounts = {};
try { accounts = JSON.parse(await readFile(target, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const defaults = { admin: 'Liberia2025!', student: 'student123', counselor: 'counselor123' };
for (const [environment, envFile] of [['production', '.env.neon.local'], ['preview', '.env.neon-test.local']]) {
  const envPath = new URL(envFile, root);
  const env = dotenv.parse(await readFile(envPath));
  if (environment === 'preview' && !env.JWT_SECRET) {
    env.JWT_SECRET = randomBytes(48).toString('hex');
    await writeFile(envPath, Object.entries(env).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n', { mode: 0o600 });
  }
  const client = new pg.Client({ connectionString: env.DATABASE_URL.replace(/sslmode=require\b/, 'sslmode=verify-full') });
  try {
    await client.connect();
    await client.query('BEGIN');
    const users = (await client.query("SELECT id, email, role, password FROM users WHERE email IN ('admin@careerscope.lib', 'student@test.com', 'counselor@test.com') FOR UPDATE")).rows;
    accounts[environment] ||= [];
    let changed = 0;
    for (const user of users) {
      if (!await bcrypt.compare(defaults[user.role], user.password)) continue;
      const password = randomBytes(24).toString('base64url');
      accounts[environment] = accounts[environment].filter((account) => account.email !== user.email);
      accounts[environment].push({ email: user.email, role: user.role, password });
      await client.query('UPDATE users SET password = $1 WHERE id = $2', [await bcrypt.hash(password, 12), user.id]);
      changed++;
    }
    const temporary = new URL('.env.accounts.local.tmp', root);
    await writeFile(temporary, JSON.stringify(accounts, null, 2), { mode: 0o600 });
    await rename(temporary, target);
    await client.query('COMMIT');
    console.log(`${environment}: rotated ${changed} demo passwords; credentials saved in ignored server/.env.accounts.local`);
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { await client.end(); }
}
