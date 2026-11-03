import { readFile, writeFile, chmod } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

const target = fileURLToPath(new URL('../.env', import.meta.url));
const credentials = dotenv.parse(await readFile(new URL('../.env.neon.local', import.meta.url)));
let existing = {};
try { existing = dotenv.parse(await readFile(target)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const config = {
  ...existing,
  ...credentials,
  JWT_SECRET: existing.JWT_SECRET?.length >= 32 ? existing.JWT_SECRET : randomBytes(48).toString('hex'),
  CLIENT_URL: existing.CLIENT_URL || 'http://localhost:5173',
  PORT: existing.PORT || '5000',
  SUBSCRIPTION_AMOUNT_MINOR: '2000',
  SUBSCRIPTION_CURRENCY: 'USD',
  COMPANY_NAME: 'CareerScope',
  COMPANY_ADDRESS: 'Sinkor, Monrovia, Liberia',
};
await writeFile(target, Object.entries(config).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n', { mode: 0o600 });
await chmod(target, 0o600);
console.log('Configured ignored server/.env for the Neon API; no secrets printed.');
