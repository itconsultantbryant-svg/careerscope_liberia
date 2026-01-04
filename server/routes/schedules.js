import express from 'express';
import { db } from '../db/init.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Create schedule (Counselor)
router.post('/counselor/create', authenticate, requireRole('counselor'), (req, res) => {
  try {
    const { studentId, dayOfWeek, startTime, endTime, notes } = req.body;

    if (!studentId || !dayOfWeek || !startTime || !endTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify student exists
    const student = db.prepare('SELECT id FROM users WHERE id = ? AND role = ?').get(studentId, 'student');
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const result = db.prepare(`
      INSERT INTO schedules (student_id, counselor_id, day_of_week, start_time, end_time, schedule_type, status, created_by, notes)
      VALUES (?, ?, ?, ?, ?, 'counselor_created', 'pending', 'counselor', ?)
    `).run(studentId, req.user.id, dayOfWeek, startTime, endTime, notes || null);

    // Create notification for student
    db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, related_id)
      VALUES (?, 'appointment', 'New Schedule Proposed', 'Your counselor has proposed a new counseling schedule', ?)
    `).run(studentId, result.lastInsertRowid);

    res.status(201).json({ 
      message: 'Schedule created successfully', 
      scheduleId: result.lastInsertRowid 
    });
  } catch (error) {
    console.error('Create schedule error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Propose schedule (Student)
router.post('/student/propose', authenticate, requireRole('student'), (req, res) => {
  try {
    const { counselorId, dayOfWeek, startTime, endTime, notes } = req.body;

    if (!counselorId || !dayOfWeek || !startTime || !endTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify counselor exists and is approved
    const counselor = db.prepare('SELECT id, is_approved FROM users WHERE id = ? AND role = ?').get(counselorId, 'counselor');
    if (!counselor || !counselor.is_approved) {
      return res.status(404).json({ error: 'Counselor not found or not approved' });
    }

    const result = db.prepare(`
      INSERT INTO schedules (student_id, counselor_id, day_of_week, start_time, end_time, schedule_type, status, created_by, notes)
      VALUES (?, ?, ?, ?, ?, 'student_proposed', 'pending', 'student', ?)
    `).run(req.user.id, counselorId, dayOfWeek, startTime, endTime, notes || null);

    // Create notification for counselor
    db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, related_id)
      VALUES (?, 'appointment', 'Schedule Proposal', 'A student has proposed a new counseling schedule', ?)
    `).run(counselorId, result.lastInsertRowid);

    res.status(201).json({ 
      message: 'Schedule proposed successfully', 
      scheduleId: result.lastInsertRowid 
    });
  } catch (error) {
    console.error('Propose schedule error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get student schedules
router.get('/student', authenticate, requireRole('student'), (req, res) => {
  try {
    const schedules = db.prepare(`
      SELECT s.*, 
             u.first_name || ' ' || u.last_name as counselor_name,
             u.profile_image as counselor_image,
             u.industry_specialty as counselor_specialty
      FROM schedules s
      INNER JOIN users u ON s.counselor_id = u.id
      WHERE s.student_id = ?
      ORDER BY 
        CASE s.day_of_week
          WHEN 'Monday' THEN 1
          WHEN 'Tuesday' THEN 2
          WHEN 'Wednesday' THEN 3
          WHEN 'Thursday' THEN 4
          WHEN 'Friday' THEN 5
          WHEN 'Saturday' THEN 6
          WHEN 'Sunday' THEN 7
        END,
        s.start_time
    `).all(req.user.id);

    res.json({ schedules });
  } catch (error) {
    console.error('Get student schedules error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get counselor schedules
router.get('/counselor', authenticate, requireRole('counselor'), (req, res) => {
  try {
    const schedules = db.prepare(`
      SELECT s.*, 
             u.first_name || ' ' || u.last_name as student_name,
             u.profile_image as student_image,
             u.school_name, u.grade_level
      FROM schedules s
      INNER JOIN users u ON s.student_id = u.id
      WHERE s.counselor_id = ?
      ORDER BY 
        CASE s.day_of_week
          WHEN 'Monday' THEN 1
          WHEN 'Tuesday' THEN 2
          WHEN 'Wednesday' THEN 3
          WHEN 'Thursday' THEN 4
          WHEN 'Friday' THEN 5
          WHEN 'Saturday' THEN 6
          WHEN 'Sunday' THEN 7
        END,
        s.start_time
    `).all(req.user.id);

    res.json({ schedules });
  } catch (error) {
    console.error('Get counselor schedules error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Accept schedule (Counselor accepts student proposal or auto-accept counselor's own)
router.patch('/:id/accept', authenticate, (req, res) => {
  try {
    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(req.params.id);
    
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    // Check permissions
    if (req.user.role === 'counselor' && schedule.counselor_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    if (req.user.role === 'student' && schedule.student_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Only counselor can accept schedules
    if (req.user.role !== 'counselor') {
      return res.status(403).json({ error: 'Only counselors can accept schedules' });
    }

    db.prepare(`
      UPDATE schedules 
      SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(req.params.id);

    // Create notification for student
    db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, related_id)
      VALUES (?, 'appointment', 'Schedule Accepted', 'Your counselor has accepted your proposed schedule', ?)
    `).run(schedule.student_id, req.params.id);

    res.json({ message: 'Schedule accepted successfully' });
  } catch (error) {
    console.error('Accept schedule error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reject schedule
router.patch('/:id/reject', authenticate, (req, res) => {
  try {
    const { rejectionReason } = req.body;
    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(req.params.id);
    
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    // Check permissions
    if (req.user.role === 'counselor' && schedule.counselor_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    if (req.user.role === 'student' && schedule.student_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    db.prepare(`
      UPDATE schedules 
      SET status = 'rejected', rejection_reason = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(rejectionReason || null, req.params.id);

    // Create notification
    const notifyUserId = req.user.role === 'counselor' ? schedule.student_id : schedule.counselor_id;
    db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, related_id)
      VALUES (?, 'appointment', 'Schedule Rejected', ?, ?)
    `).run(notifyUserId, `Your schedule proposal has been rejected${rejectionReason ? ': ' + rejectionReason : ''}`, req.params.id);

    res.json({ message: 'Schedule rejected' });
  } catch (error) {
    console.error('Reject schedule error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all schedules (Admin)
router.get('/all', authenticate, requireRole('admin'), (req, res) => {
  try {
    const schedules = db.prepare(`
      SELECT s.*, 
             st.first_name || ' ' || st.last_name as student_name,
             st.profile_image as student_image,
             co.first_name || ' ' || co.last_name as counselor_name,
             co.profile_image as counselor_image
      FROM schedules s
      INNER JOIN users st ON s.student_id = st.id
      INNER JOIN users co ON s.counselor_id = co.id
      ORDER BY s.created_at DESC
    `).all();

    res.json({ schedules });
  } catch (error) {
    console.error('Get all schedules error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

