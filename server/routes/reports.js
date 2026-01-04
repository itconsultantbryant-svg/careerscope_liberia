import express from 'express';
import { db } from '../db/init.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Create report (Counselor)
router.post('/', authenticate, requireRole('counselor'), (req, res) => {
  try {
    const { studentId, reportType, title, content, studentLevel, studentProgress, recommendations, isUrgent } = req.body;

    if (!studentId || !title || !content) {
      return res.status(400).json({ error: 'Student ID, title, and content required' });
    }

    const result = db.prepare(`
      INSERT INTO counselor_reports 
      (counselor_id, student_id, report_type, title, content, student_level, student_progress, recommendations, is_urgent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      studentId,
      reportType || 'progress',
      title,
      content,
      studentLevel || null,
      studentProgress || null,
      recommendations || null,
      isUrgent ? 1 : 0
    );

    // Notify admin
    const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all();
    admins.forEach(admin => {
      db.prepare(`
        INSERT INTO notifications (user_id, type, title, message, related_id)
        VALUES (?, 'report', ?, ?, ?)
      `).run(
        admin.id,
        isUrgent ? 'URGENT: Counselor Report' : 'Counselor Report',
        `New ${reportType} report from counselor`,
        result.lastInsertRowid
      );
    });

    res.status(201).json({ message: 'Report submitted', reportId: result.lastInsertRowid });
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get reports for counselor
router.get('/counselor', authenticate, requireRole('counselor'), (req, res) => {
  const reports = db.prepare(`
    SELECT cr.*,
           u.first_name || ' ' || u.last_name as student_name,
           u.school_name, u.grade_level
    FROM counselor_reports cr
    INNER JOIN users u ON cr.student_id = u.id
    WHERE cr.counselor_id = ?
    ORDER BY cr.created_at DESC
  `).all(req.user.id);

  res.json({ reports });
});

// Get all reports (Admin)
router.get('/all', authenticate, requireRole('admin'), (req, res) => {
  const reports = db.prepare(`
    SELECT cr.*,
           s.first_name || ' ' || s.last_name as student_name,
           c.first_name || ' ' || c.last_name as counselor_name
    FROM counselor_reports cr
    INNER JOIN users s ON cr.student_id = s.id
    INNER JOIN users c ON cr.counselor_id = c.id
    ORDER BY cr.is_urgent DESC, cr.created_at DESC
  `).all();

  res.json({ reports });
});

// Mark report as viewed (Admin)
router.patch('/:id/viewed', authenticate, requireRole('admin'), (req, res) => {
  db.prepare('UPDATE counselor_reports SET admin_viewed = 1 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Report marked as viewed' });
});

export default router;

