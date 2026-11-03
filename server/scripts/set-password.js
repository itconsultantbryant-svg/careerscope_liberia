import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../db/postgres.js';

const email = process.argv[2];
const password = process.env.NEW_PASSWORD;
if (!email || !password || password.length < 12 || Buffer.byteLength(password) > 72) throw new Error('Provide the account email and NEW_PASSWORD (12-72 bytes) through the environment; never put passwords in command arguments.');
try {
  const hash = await bcrypt.hash(password, 12);
  const result = await pool.query('UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2 RETURNING id', [hash, email.toLowerCase()]);
  if (!result.rowCount) throw new Error('Account not found');
  console.log('Password updated. No credentials printed.');
} finally { await pool.end(); }
