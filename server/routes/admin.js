import express from 'express';
import { db } from '../db/init.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get all users
router.get('/users', authenticate, requireRole('admin'), (req, res) => {
  const users = db.prepare(`
    SELECT id, email, phone, first_name, last_name, role, county, school_name, 
           grade_level, is_approved, is_premium, created_at
    FROM users
    ORDER BY created_at DESC
  `).all();

  res.json({ users });
});

// Approve/Reject counselor
router.patch('/counselors/:id/approve', authenticate, requireRole('admin'), (req, res) => {
  const { isApproved } = req.body;

  db.prepare('UPDATE users SET is_approved = ? WHERE id = ? AND role = ?').run(
    isApproved ? 1 : 0,
    req.params.id,
    'counselor'
  );

  res.json({ message: `Counselor ${isApproved ? 'approved' : 'rejected'}` });
});

// Get analytics
router.get('/analytics', authenticate, requireRole('admin'), (req, res) => {
  const stats = {
    totalUsers: db.prepare('SELECT COUNT(*) as count FROM users').get().count,
    totalStudents: db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'student'").get().count,
    totalCounselors: db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'counselor' AND is_approved = 1").get().count,
    totalAppointments: db.prepare('SELECT COUNT(*) as count FROM appointments').get().count,
    totalPosts: db.prepare('SELECT COUNT(*) as count FROM posts').get().count,
    activeCounties: db.prepare(`
      SELECT COUNT(DISTINCT county) as count FROM users WHERE county IS NOT NULL
    `).get().count,
    popularCareers: db.prepare(`
      SELECT c.title, COUNT(sci.id) as interest_count
      FROM careers c
      LEFT JOIN student_career_interests sci ON c.id = sci.career_id
      GROUP BY c.id
      ORDER BY interest_count DESC
      LIMIT 10
    `).all(),
  };

  res.json({ stats });
});

// Create/Update career
router.post('/careers', authenticate, requireRole('admin'), (req, res) => {
  try {
    const { title, description, jobOutlook, requiredEducation, salaryRange, skillsRequired, universities, category, imageUrl } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title required' });
    }

    const result = db.prepare(`
      INSERT INTO careers (title, description, job_outlook, required_education, salary_range, skills_required, universities, category, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(title, description || null, jobOutlook || null, requiredEducation || null, salaryRange || null, skillsRequired || null, universities || null, category || null, imageUrl || null);

    res.status(201).json({ message: 'Career created', careerId: result.lastInsertRowid });
  } catch (error) {
    console.error('Create career error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/careers/:id', authenticate, requireRole('admin'), (req, res) => {
  try {
    const { title, description, jobOutlook, requiredEducation, salaryRange, skillsRequired, universities, category, imageUrl } = req.body;

    const updates = [];
    const values = [];

    if (title) {
      updates.push('title = ?');
      values.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (jobOutlook !== undefined) {
      updates.push('job_outlook = ?');
      values.push(jobOutlook);
    }
    if (requiredEducation !== undefined) {
      updates.push('required_education = ?');
      values.push(requiredEducation);
    }
    if (salaryRange !== undefined) {
      updates.push('salary_range = ?');
      values.push(salaryRange);
    }
    if (skillsRequired !== undefined) {
      updates.push('skills_required = ?');
      values.push(skillsRequired);
    }
    if (universities !== undefined) {
      updates.push('universities = ?');
      values.push(universities);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      values.push(category);
    }
    if (imageUrl !== undefined) {
      updates.push('image_url = ?');
      values.push(imageUrl);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.params.id);
    db.prepare(`UPDATE careers SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    res.json({ message: 'Career updated' });
  } catch (error) {
    console.error('Update career error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export users to CSV (simplified - returns JSON)
router.get('/export/users', authenticate, requireRole('admin'), (req, res) => {
  const users = db.prepare(`
    SELECT first_name, last_name, email, phone, role, county, school_name, grade_level, created_at
    FROM users
    ORDER BY created_at DESC
  `).all();

  res.json({ users });
});

export default router;

