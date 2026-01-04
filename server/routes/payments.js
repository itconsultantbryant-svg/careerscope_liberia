import express from 'express';
import { db } from '../db/init.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Create payment (mock Mobile Money)
router.post('/', authenticate, (req, res) => {
  try {
    const { amount, paymentMethod } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Mock payment - in production, integrate with Mobile Money API
    const transactionId = 'MM-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

    const result = db.prepare(`
      INSERT INTO payments (user_id, amount, payment_method, status, transaction_id)
      VALUES (?, ?, ?, 'completed', ?)
    `).run(req.user.id, amount, paymentMethod || 'mobile_money', transactionId);

    // Upgrade to premium if payment successful
    if (amount >= 1500) {
      db.prepare('UPDATE users SET is_premium = 1 WHERE id = ?').run(req.user.id);
    }

    res.status(201).json({
      message: 'Payment successful',
      paymentId: result.lastInsertRowid,
      transactionId,
      isPremium: amount >= 1500,
    });
  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's payment history
router.get('/history', authenticate, (req, res) => {
  const payments = db.prepare(`
    SELECT * FROM payments
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(req.user.id);

  res.json({ payments });
});

export default router;

