import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

const root = resolve(import.meta.dirname, '../..');
const cli = resolve(root, 'node_modules/.bin/vercel');
const target = process.argv[2];
if (!['production', 'preview'].includes(target)) throw new Error('Choose production or preview');
const local = dotenv.parse(await readFile(resolve(root, 'server/.env')));
const database = target === 'preview'
  ? dotenv.parse(await readFile(resolve(root, 'server/.env.neon-test.local')))
  : dotenv.parse(await readFile(resolve(root, 'server/.env.neon.local')));
const variables = {
  DATABASE_URL: database.DATABASE_URL,
  JWT_SECRET: target === 'preview' ? database.JWT_SECRET : local.JWT_SECRET,
  SUBSCRIPTION_AMOUNT_MINOR: '2000',
  SUBSCRIPTION_CURRENCY: 'USD',
  COMPANY_NAME: 'CareerScope',
  COMPANY_ADDRESS: 'Sinkor, Monrovia, Liberia',
  VITE_API_URL: '/api',
  ...(local.RESEND_API_KEY ? { RESEND_API_KEY: local.RESEND_API_KEY, EMAIL_FROM: local.EMAIL_FROM } : {}),
  ...(local.PAYMENT_INSTRUCTIONS ? { PAYMENT_INSTRUCTIONS: local.PAYMENT_INSTRUCTIONS } : {}),
};
for (const [key, value] of Object.entries(variables)) {
  if (!value) throw new Error(`Missing ${key}`);
  // Values go over stdin, never shell arguments or log output. Existing values
  // are not overwritten silently; the CLI will report that manual action is needed.
  const result = spawnSync(cli, ['env', 'add', key, target], { cwd: root, input: value, encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(`Unable to configure ${key}. Authenticate/link the Vercel project and check for an existing variable.`);
    process.exit(1);
  }
  console.log(`Configured ${key} (${target})`);
}
