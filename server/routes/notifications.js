import express from 'express';
import { db } from '../db/init.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get user notifications
router.get('/', authenticate, (req, res) => {
  const notifications = db.prepare(`
    SELECT * FROM notifications 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT 50
  `).all(req.user.id);

  res.json({ notifications });
});

// Get unread count
router.get('/unread-count', authenticate, (req, res) => {
  const count = db.prepare(`
    SELECT COUNT(*) as count FROM notifications 
    WHERE user_id = ? AND is_read = 0
  `).get(req.user.id);

  res.json({ count: count.count });
});

// Mark notification as read
router.patch('/:id/read', authenticate, (req, res) => {
  db.prepare(`
    UPDATE notifications 
    SET is_read = 1 
    WHERE id = ? AND user_id = ?
  `).run(req.params.id, req.user.id);

  res.json({ message: 'Notification marked as read' });
});

// Mark all as read
router.patch('/read-all', authenticate, (req, res) => {
  db.prepare(`
    UPDATE notifications 
    SET is_read = 1 
    WHERE user_id = ? AND is_read = 0
  `).run(req.user.id);

  res.json({ message: 'All notifications marked as read' });
});

export default router;

