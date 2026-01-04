import express from 'express';
import { db } from '../db/init.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Book appointment (Student)
router.post('/', authenticate, (req, res) => {
  try {
    const { counselorId, appointmentDate, appointmentTime, notes } = req.body;

    if (!counselorId || !appointmentDate || !appointmentTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if counselor exists and is approved
    const counselor = db.prepare('SELECT id, is_approved FROM users WHERE id = ? AND role = ?').get(counselorId, 'counselor');
    if (!counselor || !counselor.is_approved) {
      return res.status(404).json({ error: 'Counselor not found or not approved' });
    }

    const result = db.prepare(`
      INSERT INTO appointments (student_id, counselor_id, appointment_date, appointment_time, notes, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).run(req.user.id, counselorId, appointmentDate, appointmentTime, notes || null);

    res.status(201).json({ message: 'Appointment requested', appointmentId: result.lastInsertRowid });
  } catch (error) {
    console.error('Book appointment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get student's appointments
router.get('/student', authenticate, (req, res) => {
  const appointments = db.prepare(`
    SELECT a.*, 
           u.first_name || ' ' || u.last_name as counselor_name,
           u.profile_image as counselor_image,
           u.industry_specialty as counselor_specialty
    FROM appointments a
    INNER JOIN users u ON a.counselor_id = u.id
    WHERE a.student_id = ?
    ORDER BY a.appointment_date DESC, a.appointment_time DESC
  `).all(req.user.id);

  res.json({ appointments });
});

// Get counselor's appointments
router.get('/counselor', authenticate, (req, res) => {
  const appointments = db.prepare(`
    SELECT a.*, 
           u.first_name || ' ' || u.last_name as student_name,
           u.profile_image as student_image,
           u.school_name, u.grade_level
    FROM appointments a
    INNER JOIN users u ON a.student_id = u.id
    WHERE a.counselor_id = ?
    ORDER BY a.appointment_date DESC, a.appointment_time DESC
  `).all(req.user.id);

  res.json({ appointments });
});

// Update appointment status (Counselor)
router.patch('/:id/status', authenticate, (req, res) => {
  try {
    const { status, rejectionReason } = req.body;

    if (!['accepted', 'rejected', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (appointment.counselor_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    db.prepare(`
      UPDATE appointments 
      SET status = ?, rejection_reason = ?
      WHERE id = ?
    `).run(status, rejectionReason || null, req.params.id);

    res.json({ message: 'Appointment status updated' });
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all appointments (Admin)
router.get('/all', authenticate, requireRole('admin'), (req, res) => {
  const appointments = db.prepare(`
    SELECT a.*, 
           s.first_name || ' ' || s.last_name as student_name,
           c.first_name || ' ' || c.last_name as counselor_name
    FROM appointments a
    INNER JOIN users s ON a.student_id = s.id
    INNER JOIN users c ON a.counselor_id = c.id
    ORDER BY a.appointment_date DESC, a.appointment_time DESC
  `).all();

  res.json({ appointments });
});

export default router;

