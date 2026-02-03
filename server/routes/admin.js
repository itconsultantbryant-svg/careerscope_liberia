import express from 'express';
import bcrypt from 'bcrypt';
import { db } from '../db/init.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get all users
router.get('/users', authenticate, requireRole('admin'), (req, res) => {
  const users = db.prepare(`
    SELECT 
      users.id,
      users.email,
      users.phone,
      users.first_name,
      users.last_name,
      users.gender,
      users.date_of_birth,
      users.county,
      users.school_name,
      users.grade_level,
      users.role,
      users.qualification,
      users.years_of_experience,
      users.industry_specialty,
      users.organization,
      users.bio,
      users.profile_image,
      users.is_approved,
      users.is_premium,
      users.is_disabled,
      users.created_at,
      users.updated_at,
      GROUP_CONCAT(counselor_career_paths.career_id) AS career_ids,
      GROUP_CONCAT(careers.title) AS career_titles
    FROM users
    LEFT JOIN counselor_career_paths 
      ON users.id = counselor_career_paths.counselor_id
    LEFT JOIN careers 
      ON counselor_career_paths.career_id = careers.id
    GROUP BY users.id
    ORDER BY users.created_at DESC
  `).all();

  res.json({ users });
});

// Create counselor (admin only)
router.post('/counselors', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      phone,
      email,
      county,
      qualification,
      yearsOfExperience,
      industrySpecialty,
      organization,
      password,
      isApproved,
      careerIds,
    } = req.body;

    if (!firstName || !lastName || !phone || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existingPhone = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
    if (existingPhone) {
      return res.status(400).json({ error: 'Phone number already registered' });
    }

    if (email) {
      const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existingEmail) {
        return res.status(400).json({ error: 'Email already registered' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const approvedValue = isApproved === undefined ? 1 : (isApproved ? 1 : 0);

    const createCounselor = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO users (first_name, last_name, phone, email, county, qualification, years_of_experience, industry_specialty, organization, password, role, is_approved)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'counselor', ?)
      `).run(
        firstName,
        lastName,
        phone,
        email || null,
        county || null,
        qualification || null,
        yearsOfExperience || null,
        industrySpecialty || null,
        organization || null,
        hashedPassword,
        approvedValue
      );

      const counselorId = result.lastInsertRowid;
      if (Array.isArray(careerIds) && careerIds.length > 0) {
        const insertCareerPath = db.prepare(`
          INSERT OR IGNORE INTO counselor_career_paths (counselor_id, career_id)
          VALUES (?, ?)
        `);
        careerIds.forEach((careerId) => {
          if (careerId) {
            insertCareerPath.run(counselorId, careerId);
          }
        });
      }
      return counselorId;
    });

    const counselorId = createCounselor();

    res.status(201).json({ message: 'Counselor created successfully', userId: counselorId });
  } catch (error) {
    console.error('Create counselor error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
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

// Update user details (admin only)
router.patch('/users/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const targetUser = db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (targetUser.role === 'admin') {
      if (req.body.role && req.body.role !== 'admin') {
        return res.status(400).json({ error: 'Admin role cannot be changed' });
      }
      if (req.body.isDisabled) {
        return res.status(400).json({ error: 'Admin account cannot be disabled' });
      }
    }

    const updates = [];
    const values = [];

    const {
      firstName,
      lastName,
      email,
      phone,
      gender,
      dateOfBirth,
      county,
      schoolName,
      gradeLevel,
      qualification,
      yearsOfExperience,
      industrySpecialty,
      organization,
      bio,
      role,
      isApproved,
      isDisabled,
      password,
      careerIds,
    } = req.body;

    if (phone) {
      const existingPhone = db.prepare('SELECT id FROM users WHERE phone = ? AND id != ?').get(phone, req.params.id);
      if (existingPhone) {
        return res.status(400).json({ error: 'Phone number already registered' });
      }
      updates.push('phone = ?');
      values.push(phone);
    }

    if (email !== undefined) {
      if (email) {
        const existingEmail = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.params.id);
        if (existingEmail) {
          return res.status(400).json({ error: 'Email already registered' });
        }
      }
      updates.push('email = ?');
      values.push(email || null);
    }

    if (firstName) {
      updates.push('first_name = ?');
      values.push(firstName);
    }
    if (lastName) {
      updates.push('last_name = ?');
      values.push(lastName);
    }
    if (gender !== undefined) {
      updates.push('gender = ?');
      values.push(gender || null);
    }
    if (dateOfBirth !== undefined) {
      updates.push('date_of_birth = ?');
      values.push(dateOfBirth || null);
    }
    if (county !== undefined) {
      updates.push('county = ?');
      values.push(county || null);
    }
    if (schoolName !== undefined) {
      updates.push('school_name = ?');
      values.push(schoolName || null);
    }
    if (gradeLevel !== undefined) {
      updates.push('grade_level = ?');
      values.push(gradeLevel || null);
    }
    if (qualification !== undefined) {
      updates.push('qualification = ?');
      values.push(qualification || null);
    }
    if (yearsOfExperience !== undefined) {
      updates.push('years_of_experience = ?');
      values.push(yearsOfExperience || null);
    }
    if (industrySpecialty !== undefined) {
      updates.push('industry_specialty = ?');
      values.push(industrySpecialty || null);
    }
    if (organization !== undefined) {
      updates.push('organization = ?');
      values.push(organization || null);
    }
    if (bio !== undefined) {
      updates.push('bio = ?');
      values.push(bio || null);
    }
    if (role && targetUser.role !== 'admin') {
      updates.push('role = ?');
      values.push(role);
    }
    if (isApproved !== undefined) {
      updates.push('is_approved = ?');
      values.push(isApproved ? 1 : 0);
    }
    if (isDisabled !== undefined) {
      updates.push('is_disabled = ?');
      values.push(isDisabled ? 1 : 0);
    }
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push('password = ?');
      values.push(hashedPassword);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id);

    const nextRole = role || targetUser.role;

    const updateUser = db.transaction(() => {
      db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

      if (nextRole === 'counselor') {
        if (Array.isArray(careerIds)) {
          db.prepare('DELETE FROM counselor_career_paths WHERE counselor_id = ?').run(req.params.id);
          if (careerIds.length > 0) {
            const insertCareerPath = db.prepare(`
              INSERT OR IGNORE INTO counselor_career_paths (counselor_id, career_id)
              VALUES (?, ?)
            `);
            careerIds.forEach((careerId) => {
              if (careerId) {
                insertCareerPath.run(req.params.id, careerId);
              }
            });
          }
        }
      } else {
        db.prepare('DELETE FROM counselor_career_paths WHERE counselor_id = ?').run(req.params.id);
      }
    });

    updateUser();

    const updatedUser = db.prepare(`
      SELECT id, email, phone, first_name, last_name, gender, date_of_birth, county, school_name,
             grade_level, role, qualification, years_of_experience, industry_specialty, organization,
             bio, profile_image, is_approved, is_premium, is_disabled, created_at, updated_at
      FROM users WHERE id = ?
    `).get(req.params.id);

    res.json({ message: 'User updated successfully', user: updatedUser });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user (admin only)
router.delete('/users/:id', authenticate, requireRole('admin'), (req, res) => {
  const targetUser = db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.params.id);
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }
  if (targetUser.role === 'admin') {
    return res.status(400).json({ error: 'Admin account cannot be deleted' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: 'User deleted successfully' });
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

