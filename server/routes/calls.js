import express from 'express';
import { db } from '../db/init.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Create call history entry
router.post('/history', authenticate, (req, res) => {
  try {
    const { receiverId, callType } = req.body;
    const caller_id = req.user.id;
    const receiver_id = Number(receiverId);
    
    if (!Number.isInteger(receiver_id) || receiver_id <= 0 || !['voice', 'video'].includes(callType)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (receiver_id === caller_id) return res.status(400).json({ error: 'You cannot call yourself' });

    const receiver = db.prepare('SELECT id FROM users WHERE id = ? AND is_disabled = 0').get(receiver_id);
    if (!receiver) return res.status(404).json({ error: 'Call recipient not found' });

    const result = db.prepare(`
      INSERT INTO call_history (caller_id, receiver_id, call_type, status)
      VALUES (?, ?, ?, ?)
    `).run(caller_id, receiver_id, callType, 'ongoing');

    res.status(201).json({ 
      message: 'Call history created', 
      callId: result.lastInsertRowid 
    });
  } catch (error) {
    console.error('Create call history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update one specific call. A user may only update a call they participate in.
router.patch('/history/:id', authenticate, (req, res) => {
  try {
    const callId = Number(req.params.id);
    const { status, duration, endedAt } = req.body;
    const validStatuses = ['missed', 'answered', 'rejected', 'cancelled', 'ongoing'];
    if (!Number.isInteger(callId) || callId <= 0) return res.status(400).json({ error: 'Invalid call ID' });
    if (status !== undefined && !validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid call status' });
    if (duration !== undefined && (!Number.isFinite(Number(duration)) || Number(duration) < 0)) {
      return res.status(400).json({ error: 'Invalid call duration' });
    }

    const call = db.prepare('SELECT * FROM call_history WHERE id = ?').get(callId);
    if (!call) return res.status(404).json({ error: 'Call history not found' });
    if (call.caller_id !== req.user.id && call.receiver_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    db.prepare(`
      UPDATE call_history SET status = ?, duration = ?, ended_at = ? WHERE id = ?
    `).run(
      status ?? call.status,
      duration !== undefined ? Number(duration) : call.duration,
      endedAt ?? call.ended_at,
      callId
    );
    res.json({ message: 'Call history updated', updated: true, callId });
  } catch (error) {
    console.error('Update call history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update latest call history entry (must be before /history/:userId to avoid route conflict)
router.patch('/history/latest', authenticate, (req, res) => {
  try {
    const { status, duration, endedAt } = req.body;
    
    // Find the most recent call for this user (as caller or receiver)
    const call = db.prepare(`
      SELECT * FROM call_history
      WHERE (caller_id = ? OR receiver_id = ?)
      ORDER BY created_at DESC
      LIMIT 1
    `).get(req.user.id, req.user.id);

    if (!call) {
      // If no call found, return success but log it (this shouldn't happen in normal flow)
      console.warn('No call history found to update for user:', req.user.id);
      return res.json({ message: 'No call history found', updated: false });
    }

    // Update the call
    const updateResult = db.prepare(`
      UPDATE call_history
      SET status = ?,
          duration = ?,
          ended_at = ?
      WHERE id = ?
    `).run(
      status !== undefined ? status : call.status,
      duration !== undefined ? duration : call.duration,
      endedAt !== undefined ? endedAt : call.ended_at,
      call.id
    );

    res.json({ 
      message: 'Call history updated',
      updated: true,
      callId: call.id
    });
  } catch (error) {
    console.error('Update call history error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get call history with a specific user
router.get('/history/:userId', authenticate, (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    const calls = db.prepare(`
      SELECT 
        ch.*,
        CASE 
          WHEN ch.caller_id = ? THEN 'outgoing'
          ELSE 'incoming'
        END as call_direction,
        CASE 
          WHEN ch.caller_id = ? THEN u2.first_name || ' ' || u2.last_name
          ELSE u1.first_name || ' ' || u1.last_name
        END as other_user_name,
        CASE 
          WHEN ch.caller_id = ? THEN u2.profile_image
          ELSE u1.profile_image
        END as other_user_image
      FROM call_history ch
      LEFT JOIN users u1 ON ch.caller_id = u1.id
      LEFT JOIN users u2 ON ch.receiver_id = u2.id
      WHERE (ch.caller_id = ? AND ch.receiver_id = ?) 
         OR (ch.caller_id = ? AND ch.receiver_id = ?)
      ORDER BY ch.created_at DESC
      LIMIT 50
    `).all(
      req.user.id, req.user.id, req.user.id,
      req.user.id, userId,
      userId, req.user.id
    );

    res.json({ calls });
  } catch (error) {
    console.error('Get call history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
