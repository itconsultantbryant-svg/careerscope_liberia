import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../db/postgres.js';

const { ADMIN_EMAIL, ADMIN_PHONE, ADMIN_PASSWORD } = process.env;
if (!ADMIN_EMAIL || !ADMIN_PHONE || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12 || Buffer.byteLength(ADMIN_PASSWORD) > 72) throw new Error('Set ADMIN_EMAIL, ADMIN_PHONE and a 12-72 byte ADMIN_PASSWORD through a secure environment.');
try {
  const result = await pool.query("INSERT INTO users(email, phone, password, first_name, last_name, role, is_approved) SELECT $1,$2,$3,'CareerScope','Administrator','admin',1 WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'admin') RETURNING id", [ADMIN_EMAIL.toLowerCase(), ADMIN_PHONE, await bcrypt.hash(ADMIN_PASSWORD, 12)]);
  console.log(result.rowCount ? 'Administrator created. No password printed.' : 'Administrator already exists; no accounts changed.');
} finally { await pool.end(); }
