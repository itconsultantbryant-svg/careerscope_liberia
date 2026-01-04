import express from 'express';
import { db } from '../db/init.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get student progress
router.get('/student', authenticate, (req, res) => {
  let progress = db.prepare('SELECT * FROM student_progress WHERE student_id = ?').get(req.user.id);

  if (!progress) {
    // Initialize progress
    db.prepare(`
      INSERT INTO student_progress (student_id, enrollment_date, current_level, progress_percentage, total_months)
      VALUES (?, CURRENT_TIMESTAMP, 1, 0, 10)
    `).run(req.user.id);
    progress = db.prepare('SELECT * FROM student_progress WHERE student_id = ?').get(req.user.id);
  }

  // Calculate progress based on activities
  const enrollmentDate = new Date(progress.enrollment_date);
  const now = new Date();
  const monthsElapsed = Math.floor((now - enrollmentDate) / (1000 * 60 * 60 * 24 * 30));
  const totalMonths = 10; // 10-month program
  const timeProgress = Math.min((monthsElapsed / totalMonths) * 100, 100);

  // Get activity-based progress
  const completedAssignments = db.prepare(`
    SELECT COUNT(*) as count FROM grades 
    WHERE student_id = ? AND percentage >= 60
  `).get(req.user.id).count;

  const totalAssignments = db.prepare(`
    SELECT COUNT(*) as count FROM learning_materials lm
    INNER JOIN student_submissions s ON lm.id = s.material_id
    WHERE s.student_id = ?
  `).get(req.user.id).count || 1;

  const activityProgress = (completedAssignments / Math.max(totalAssignments, 1)) * 50;

  // Overall progress (50% time-based, 50% activity-based)
  const overallProgress = Math.min(timeProgress * 0.5 + activityProgress, 100);
  const currentLevel = Math.min(Math.floor(overallProgress / 10) + 1, 10); // 10 levels for 10-month program

  // Update progress
  db.prepare(`
    UPDATE student_progress 
    SET current_level = ?, progress_percentage = ?, total_months = ?, last_activity = CURRENT_TIMESTAMP
    WHERE student_id = ?
  `).run(currentLevel, overallProgress, monthsElapsed, req.user.id);

  const updatedProgress = db.prepare('SELECT * FROM student_progress WHERE student_id = ?').get(req.user.id);

  res.json({ progress: updatedProgress });
});

// Get all students progress (Counselor/Admin)
router.get('/all', authenticate, (req, res) => {
  if (req.user.role !== 'counselor' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const students = db.prepare(`
    SELECT u.id, u.first_name, u.last_name, u.school_name, u.grade_level,
           sp.current_level, sp.progress_percentage, sp.total_months, sp.last_activity
    FROM users u
    LEFT JOIN student_progress sp ON u.id = sp.student_id
    WHERE u.role = 'student'
    ORDER BY sp.progress_percentage DESC
  `).all();

  res.json({ students });
});

export default router;

