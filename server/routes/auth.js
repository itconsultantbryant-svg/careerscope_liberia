import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../db/init.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per window (increased for development)
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ 
      error: 'Too many login attempts. Please wait 15 minutes before trying again.' 
    });
  },
});

// Register Student
router.post('/register/student', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      gender,
      dateOfBirth,
      phone,
      email,
      county,
      schoolName,
      gradeLevel,
      dreamCareers,
      password,
    } = req.body;

    // Validation
    if (!firstName || !lastName || !phone || !password || !county || !schoolName || !gradeLevel) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if phone already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
    if (existingUser) {
      return res.status(400).json({ error: 'Phone number already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const result = db.prepare(`
      INSERT INTO users (first_name, last_name, gender, date_of_birth, phone, email, county, school_name, grade_level, password, role, is_approved)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'student', 1)
    `).run(
      firstName,
      lastName,
      gender || null,
      dateOfBirth || null,
      phone,
      email || null,
      county,
      schoolName,
      gradeLevel,
      hashedPassword
    );

    // Insert career interests if provided
    if (dreamCareers && Array.isArray(dreamCareers) && dreamCareers.length > 0) {
      const insertInterest = db.prepare(`
        INSERT INTO student_career_interests (student_id, career_id)
        VALUES (?, ?)
      `);
      
      for (const careerId of dreamCareers) {
        try {
          insertInterest.run(result.lastInsertRowid, careerId);
        } catch (err) {
          // Ignore duplicate entries
        }
      }
    }

    res.status(201).json({ message: 'Student registered successfully', userId: result.lastInsertRowid });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register Counselor
router.post('/register/counselor', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      gender,
      dateOfBirth,
      phone,
      email,
      county,
      qualification,
      yearsOfExperience,
      industrySpecialty,
      organization,
      password,
    } = req.body;

    if (!firstName || !lastName || !phone || !password || !county) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existingUser = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
    if (existingUser) {
      return res.status(400).json({ error: 'Phone number already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = db.prepare(`
      INSERT INTO users (first_name, last_name, gender, date_of_birth, phone, email, county, qualification, years_of_experience, industry_specialty, organization, password, role, is_approved)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'counselor', 0)
    `).run(
      firstName,
      lastName,
      gender || null,
      dateOfBirth || null,
      phone,
      email || null,
      county,
      qualification || null,
      yearsOfExperience || null,
      industrySpecialty || null,
      organization || null,
      hashedPassword
    );

    res.status(201).json({ 
      message: 'Counselor registration submitted. Awaiting admin approval.',
      userId: result.lastInsertRowid 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { phone, email, password, role } = req.body;

    if (!password || (!phone && !email)) {
      return res.status(400).json({ error: 'Phone/Email and password required' });
    }

    // Find user by phone or email
    let user;
    if (phone) {
      user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    } else {
      user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check role if specified
    if (role && user.role !== role) {
      return res.status(401).json({ error: 'Invalid role' });
    }

    // Check if counselor is approved
    if (user.role === 'counselor' && !user.is_approved) {
      return res.status(403).json({ error: 'Your counselor account is pending approval' });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email, phone: user.phone },
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Set httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      user: userWithoutPassword,
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logout successful' });
});

// Get current user (optional auth - returns null if not authenticated)
router.get('/me', optionalAuth, (req, res) => {
  if (!req.user) {
    return res.json({ user: null });
  }

  const user = db.prepare('SELECT id, email, phone, first_name, last_name, gender, date_of_birth, county, school_name, grade_level, role, qualification, years_of_experience, industry_specialty, organization, bio, profile_image, is_approved, is_premium, created_at FROM users WHERE id = ?').get(req.user.id);
  
  if (!user) {
    return res.json({ user: null });
  }

  res.json({ user });
});

export default router;

