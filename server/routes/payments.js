import express from 'express';
import { db } from '../db/init.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Never grant subscriptions based on an unverified mock payment.
router.post('/', authenticate, (req, res) => {
  res.status(410).json({ error: 'Mock payments have been retired. Use /api/billing for manually verified payments.' });
});

// Preserve access to historic mock records without treating them as receipts.
router.get('/history', authenticate, (req, res) => {
  const payments = db.prepare('SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json({ payments, legacy: true });
});

export default router;
