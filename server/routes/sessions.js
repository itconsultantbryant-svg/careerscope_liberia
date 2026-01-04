import express from 'express';
import { db } from '../db/init.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Create live session
router.post('/', authenticate, (req, res) => {
  try {
    const { appointmentId, studentId, counselorId, sessionTitle, sessionType, startTime } = req.body;

    // Verify permissions
    if (req.user.role === 'student' && req.user.id !== parseInt(studentId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (req.user.role === 'counselor' && req.user.id !== parseInt(counselorId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = db.prepare(`
      INSERT INTO live_sessions 
      (appointment_id, student_id, counselor_id, session_title, session_type, start_time, status)
      VALUES (?, ?, ?, ?, ?, ?, 'scheduled')
    `).run(
      appointmentId || null,
      studentId,
      counselorId,
      sessionTitle || 'Counseling Session',
      sessionType || 'counseling',
      startTime || new Date().toISOString()
    );

    // Notify both parties
    db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, related_id)
      VALUES (?, 'session', 'Live session scheduled', ?, ?)
    `).run(studentId, `Live session "${sessionTitle}" scheduled`, result.lastInsertRowid);

    db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, related_id)
      VALUES (?, 'session', 'Live session scheduled', ?, ?)
    `).run(counselorId, `Live session "${sessionTitle}" scheduled`, result.lastInsertRowid);

    res.status(201).json({ message: 'Session created', sessionId: result.lastInsertRowid });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get student sessions
router.get('/student', authenticate, (req, res) => {
  const sessions = db.prepare(`
    SELECT ls.*,
           u.first_name || ' ' || u.last_name as counselor_name,
           u.profile_image as counselor_image,
           u.industry_specialty
    FROM live_sessions ls
    INNER JOIN users u ON ls.counselor_id = u.id
    WHERE ls.student_id = ?
    ORDER BY ls.start_time DESC
  `).all(req.user.id);

  res.json({ sessions });
});

// Get counselor sessions
router.get('/counselor', authenticate, (req, res) => {
  if (req.user.role !== 'counselor') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const sessions = db.prepare(`
    SELECT ls.*,
           u.first_name || ' ' || u.last_name as student_name,
           u.profile_image as student_image,
           u.school_name, u.grade_level
    FROM live_sessions ls
    INNER JOIN users u ON ls.student_id = u.id
    WHERE ls.counselor_id = ?
    ORDER BY ls.start_time DESC
  `).all(req.user.id);

  res.json({ sessions });
});

// Get all sessions (Admin)
router.get('/all', authenticate, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const sessions = db.prepare(`
    SELECT ls.*,
           s.first_name || ' ' || s.last_name as student_name,
           c.first_name || ' ' || c.last_name as counselor_name
    FROM live_sessions ls
    INNER JOIN users s ON ls.student_id = s.id
    INNER JOIN users c ON ls.counselor_id = c.id
    ORDER BY ls.start_time DESC
  `).all();

  res.json({ sessions });
});

// Update session status
router.patch('/:id/status', authenticate, (req, res) => {
  try {
    const { status, sessionNotes, endTime } = req.body;

    const session = db.prepare('SELECT * FROM live_sessions WHERE id = ?').get(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Verify permissions
    if (req.user.role === 'student' && session.student_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (req.user.role === 'counselor' && session.counselor_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    db.prepare(`
      UPDATE live_sessions 
      SET status = ?, session_notes = ?, end_time = ?
      WHERE id = ?
    `).run(status, sessionNotes || null, endTime || null, req.params.id);

    res.json({ message: 'Session updated' });
  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

