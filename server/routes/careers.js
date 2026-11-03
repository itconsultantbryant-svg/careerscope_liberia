import express from 'express';
import { db } from '../db/init.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get all careers (public)
router.get('/', (req, res) => {
  const careers = db.prepare('SELECT * FROM careers ORDER BY title').all();
  res.json({ careers });
});

// Student career-interest routes must be registered before /:id.
router.get('/student/interests', authenticate, requireRole('student'), (req, res) => {
  const interests = db.prepare(`
    SELECT c.* FROM careers c
    INNER JOIN student_career_interests sci ON c.id = sci.career_id
    WHERE sci.student_id = ?
  `).all(req.user.id);

  res.json({ interests });
});

router.post('/student/interests', authenticate, requireRole('student'), (req, res) => {
  try {
    const { careerId } = req.body;
    if (!careerId) return res.status(400).json({ error: 'Career ID required' });
    const career = db.prepare('SELECT id FROM careers WHERE id = ?').get(careerId);
    if (!career) return res.status(404).json({ error: 'Career not found' });
    db.prepare('INSERT OR IGNORE INTO student_career_interests (student_id, career_id) VALUES (?, ?)').run(req.user.id, careerId);
    res.json({ message: 'Career interest added' });
  } catch (error) {
    console.error('Add interest error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/student/interests/:careerId', authenticate, requireRole('student'), (req, res) => {
  db.prepare('DELETE FROM student_career_interests WHERE student_id = ? AND career_id = ?').run(req.user.id, req.params.careerId);
  res.json({ message: 'Career interest removed' });
});

// Get single career (public)
router.get('/:id', (req, res) => {
  const career = db.prepare('SELECT * FROM careers WHERE id = ?').get(req.params.id);

  if (!career) {
    return res.status(404).json({ error: 'Career not found' });
  }

  // Get counselors assigned to this career
  const counselors = db.prepare(`
    SELECT users.id, users.first_name, users.last_name, users.county,
           users.qualification, users.years_of_experience, users.industry_specialty,
           users.organization, users.bio, users.profile_image
    FROM users
    INNER JOIN counselor_career_paths
      ON users.id = counselor_career_paths.counselor_id
    WHERE users.role = 'counselor'
    AND users.is_approved = 1
    AND users.is_disabled = 0
    AND counselor_career_paths.career_id = ?
    ORDER BY users.years_of_experience DESC
    LIMIT 20
  `).all(career.id);

  res.json({ career, counselors });
});

export default router;
