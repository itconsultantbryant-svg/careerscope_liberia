import jwt from 'jsonwebtoken';
import { db } from '../db/postgres.js';

export async function activeUser(decoded) {
  const user = await db.prepare('SELECT id, role, is_disabled, is_approved, deleted_at, token_version, counselor_type FROM users WHERE id = ?').get(decoded.id);
  return user && !user.is_disabled && !user.deleted_at && user.counselor_type !== 'ai' && Number(decoded.tokenVersion || 0) === user.token_version && (user.role !== 'counselor' || user.is_approved) ? { ...decoded, role: user.role } : null;
}

export async function authenticate(req, res, next) {
  if (!req.cookies.token) return res.status(401).json({ error: 'Please sign in' });
  let decoded;
  try { decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET); }
  catch { return res.status(401).json({ error: 'Session expired. Please sign in again.' }); }
  req.user = await activeUser(decoded);
  if (!req.user) return res.status(401).json({ error: 'Account unavailable or disabled' });
  next();
}

export async function optionalAuth(req, res, next) {
  req.user = null;
  if (req.cookies.token) {
    let decoded;
    try { decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET); } catch { /* Guest */ }
    if (decoded) req.user = await activeUser(decoded);
  }
  next();
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  next();
};
