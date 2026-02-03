import express from 'express';
import { db } from '../db/init.js';
import { authenticate } from '../middleware/auth.js';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + '.' + file.originalname.split('.').pop());
  },
});

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

// Get user profile
router.get('/:id', authenticate, (req, res) => {
  const user = db.prepare(`
    SELECT id, email, phone, first_name, last_name, gender, date_of_birth, county, 
           school_name, grade_level, role, qualification, years_of_experience, 
           industry_specialty, organization, bio, profile_image, is_premium, created_at
    FROM users WHERE id = ?
  `).get(req.params.id);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ user });
});

// Update profile
router.put('/profile', authenticate, upload.single('profileImage'), (req, res) => {
  try {
    const { firstName, lastName, bio, county, schoolName, gradeLevel, qualification, yearsOfExperience, industrySpecialty, organization } = req.body;
    
    const updates = [];
    const values = [];

    if (firstName) {
      updates.push('first_name = ?');
      values.push(firstName);
    }
    if (lastName) {
      updates.push('last_name = ?');
      values.push(lastName);
    }
    if (bio !== undefined) {
      updates.push('bio = ?');
      values.push(bio);
    }
    if (county) {
      updates.push('county = ?');
      values.push(county);
    }
    if (schoolName) {
      updates.push('school_name = ?');
      values.push(schoolName);
    }
    if (gradeLevel) {
      updates.push('grade_level = ?');
      values.push(gradeLevel);
    }
    if (qualification) {
      updates.push('qualification = ?');
      values.push(qualification);
    }
    if (yearsOfExperience !== undefined) {
      updates.push('years_of_experience = ?');
      values.push(yearsOfExperience);
    }
    if (industrySpecialty) {
      updates.push('industry_specialty = ?');
      values.push(industrySpecialty);
    }
    if (organization) {
      updates.push('organization = ?');
      values.push(organization);
    }
    if (req.file) {
      updates.push('profile_image = ?');
      values.push(`/uploads/${req.file.filename}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.user.id);

    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...values);

    const updatedUser = db.prepare(`
      SELECT id, email, phone, first_name, last_name, gender, date_of_birth, county, 
             school_name, grade_level, role, qualification, years_of_experience, 
             industry_specialty, organization, bio, profile_image, is_premium, created_at
      FROM users WHERE id = ?
    `).get(req.user.id);

    res.json({ message: 'Profile updated successfully', user: updatedUser });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all students (for community)
router.get('/students/list', authenticate, (req, res) => {
  const students = db.prepare(`
    SELECT id, first_name, last_name, school_name, grade_level, county, profile_image
    FROM users WHERE role = 'student' AND is_approved = 1 AND is_disabled = 0
    ORDER BY created_at DESC
  `).all();

  res.json({ students });
});

// Get all counselors
router.get('/counselors/list', authenticate, (req, res) => {
  const counselors = db.prepare(`
    SELECT id, first_name, last_name, county, qualification, years_of_experience, 
           industry_specialty, organization, bio, profile_image
    FROM users WHERE role = 'counselor' AND is_approved = 1 AND is_disabled = 0
    ORDER BY created_at DESC
  `).all();

  res.json({ counselors });
});

export default router;

