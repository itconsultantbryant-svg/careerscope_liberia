import jwt from 'jsonwebtoken';
import { db } from '../db/init.js';

const activeUser = (decoded) => {
  const user = db.prepare('SELECT id, role, is_disabled, is_approved FROM users WHERE id = ?').get(decoded.id);
  return user && !user.is_disabled && (user.role !== 'counselor' || user.is_approved) ? { ...decoded, role: user.role } : null;
};

export const authenticate = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized - No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
    req.user = activeUser(decoded);
    if (!req.user) return res.status(401).json({ error: 'Account unavailable or disabled' });
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized - Invalid token' });
  }
};

// Optional authentication - doesn't fail if no token
export const optionalAuth = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
    req.user = activeUser(decoded);
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
    }

    next();
  };
};
