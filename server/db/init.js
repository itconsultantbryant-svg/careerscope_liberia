import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import bcrypt from 'bcrypt';
import { careers as careersData } from './careers-data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use server directory for database (more reliable for deployment)
// Prefer server directory, fallback to project root
let dbPath = join(__dirname, '../sqlite.db'); // server/sqlite.db (preferred for deployment)

// Ensure directory exists
const dbDir = dirname(dbPath);
if (!existsSync(dbDir)) {
  try {
    mkdirSync(dbDir, { recursive: true });
  } catch (e) {
    // If server directory doesn't work, try project root
    dbPath = join(__dirname, '../../sqlite.db');
  }
}

export const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

export function initDatabase() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      phone TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      gender TEXT,
      date_of_birth TEXT,
      county TEXT,
      school_name TEXT,
      grade_level INTEGER,
      role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('student', 'counselor', 'admin')),
      qualification TEXT,
      years_of_experience INTEGER,
      industry_specialty TEXT,
      organization TEXT,
      bio TEXT,
      profile_image TEXT,
      is_approved BOOLEAN DEFAULT 0,
      is_premium BOOLEAN DEFAULT 0,
      is_disabled BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add missing columns to users table if needed
  try {
    const userColumns = db.prepare("PRAGMA table_info(users)").all();
    const userColumnNames = userColumns.map(col => col.name);

    if (!userColumnNames.includes('is_disabled')) {
      console.log('Adding is_disabled column to users...');
      db.exec("ALTER TABLE users ADD COLUMN is_disabled BOOLEAN DEFAULT 0");
    }
  } catch (error) {
    console.error('Users migration error:', error.message);
  }

  // Careers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS careers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      job_outlook TEXT,
      required_education TEXT,
      salary_range TEXT,
      skills_required TEXT,
      universities TEXT,
      image_url TEXT,
      category TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Counselor career paths (many-to-many)
  db.exec(`
    CREATE TABLE IF NOT EXISTS counselor_career_paths (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      counselor_id INTEGER NOT NULL,
      career_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (counselor_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (career_id) REFERENCES careers(id) ON DELETE CASCADE,
      UNIQUE(counselor_id, career_id)
    )
  `);

  // Student career interests (many-to-many)
  db.exec(`
    CREATE TABLE IF NOT EXISTS student_career_interests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      career_id INTEGER NOT NULL,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (career_id) REFERENCES careers(id) ON DELETE CASCADE,
      UNIQUE(student_id, career_id)
    )
  `);

  // Schedules table - For recurring counseling schedules
  db.exec(`
    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      counselor_id INTEGER NOT NULL,
      day_of_week TEXT NOT NULL CHECK(day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      schedule_type TEXT DEFAULT 'counselor_created' CHECK(schedule_type IN ('counselor_created', 'student_proposed')),
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected', 'active', 'completed', 'cancelled')),
      rejection_reason TEXT,
      notes TEXT,
      created_by TEXT NOT NULL CHECK(created_by IN ('counselor', 'student')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (counselor_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Appointments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      counselor_id INTEGER NOT NULL,
      schedule_id INTEGER,
      appointment_date TEXT NOT NULL,
      appointment_time TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected', 'completed', 'cancelled')),
      rejection_reason TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (counselor_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE SET NULL
    )
  `);

  // Posts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT,
      images TEXT,
      likes_count INTEGER DEFAULT 0,
      comments_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Post images table for multiple images support
  db.exec(`
    CREATE TABLE IF NOT EXISTS post_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      image_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    )
  `);

  // Post likes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS post_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(post_id, user_id)
    )
  `);

  // Comments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      parent_comment_id INTEGER,
      likes_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_comment_id) REFERENCES comments(id) ON DELETE CASCADE
    )
  `);

  // Comment likes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS comment_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      comment_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(comment_id, user_id)
    )
  `);

  // Messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      content TEXT,
      message_type TEXT DEFAULT 'text' CHECK(message_type IN ('text', 'image', 'document', 'voice', 'call_start', 'call_end')),
      attachment_url TEXT,
      attachment_name TEXT,
      reply_to_message_id INTEGER,
      is_read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reply_to_message_id) REFERENCES messages(id) ON DELETE SET NULL
    )
  `);

  // Message reactions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS message_reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      reaction TEXT NOT NULL CHECK(reaction IN ('like', 'love', 'laugh', 'wow', 'sad', 'angry')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(message_id, user_id)
    )
  `);

  // Call history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS call_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caller_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      call_type TEXT NOT NULL CHECK(call_type IN ('voice', 'video')),
      status TEXT NOT NULL CHECK(status IN ('missed', 'answered', 'rejected', 'cancelled', 'ongoing')),
      duration INTEGER DEFAULT 0,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (caller_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Migrate comments table if needed
  try {
    const commentsColumns = db.prepare("PRAGMA table_info(comments)").all();
    const commentColumnNames = commentsColumns.map(col => col.name);
    
    if (!commentColumnNames.includes('parent_comment_id')) {
      console.log('Adding parent_comment_id column to comments...');
      db.exec("ALTER TABLE comments ADD COLUMN parent_comment_id INTEGER");
    }
    if (!commentColumnNames.includes('likes_count')) {
      console.log('Adding likes_count column to comments...');
      db.exec("ALTER TABLE comments ADD COLUMN likes_count INTEGER DEFAULT 0");
    }
  } catch (error) {
    console.error('Comments migration error:', error.message);
  }

  // Migrate posts table if needed
  try {
    const postsColumns = db.prepare("PRAGMA table_info(posts)").all();
    const postColumnNames = postsColumns.map(col => col.name);
    
    if (!postColumnNames.includes('images')) {
      console.log('Adding images column to posts...');
      db.exec("ALTER TABLE posts ADD COLUMN images TEXT");
    }
  } catch (error) {
    console.error('Posts migration error:', error.message);
  }

  // Migrate messages table if needed (add new columns if they don't exist)
  try {
    const messagesColumns = db.prepare("PRAGMA table_info(messages)").all();
    const columnNames = messagesColumns.map(col => col.name);
    
    console.log('Messages table columns:', columnNames);
    
    if (!columnNames.includes('message_type')) {
      console.log('Adding message_type column...');
      db.exec("ALTER TABLE messages ADD COLUMN message_type TEXT DEFAULT 'text'");
    }
    if (!columnNames.includes('attachment_url')) {
      console.log('Adding attachment_url column...');
      db.exec("ALTER TABLE messages ADD COLUMN attachment_url TEXT");
    }
    if (!columnNames.includes('attachment_name')) {
      console.log('Adding attachment_name column...');
      db.exec("ALTER TABLE messages ADD COLUMN attachment_name TEXT");
    }
    if (!columnNames.includes('reply_to_message_id')) {
      console.log('Adding reply_to_message_id column...');
      db.exec("ALTER TABLE messages ADD COLUMN reply_to_message_id INTEGER");
    }
    
    // Check if content column allows NULL (SQLite doesn't easily support changing NOT NULL, but we can try)
    const contentColumn = messagesColumns.find(col => col.name === 'content');
    if (contentColumn && contentColumn.notnull === 1) {
      console.warn('Warning: content column is NOT NULL. This may cause issues with attachment-only messages.');
    }
  } catch (error) {
    console.error('Migration error:', error.message);
    console.error('Migration error stack:', error.stack);
  }

  // Groups table
  db.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      creator_id INTEGER NOT NULL,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Group members table
  db.exec(`
    CREATE TABLE IF NOT EXISTS group_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT DEFAULT 'member' CHECK(role IN ('admin', 'member')),
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(group_id, user_id)
    )
  `);

  // Group messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS group_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Payments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'failed')),
      transaction_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Career Assessment Quiz Questions
  db.exec(`
    CREATE TABLE IF NOT EXISTS quiz_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      question_type TEXT DEFAULT 'multiple_choice',
      options TEXT,
      correct_answer TEXT,
      career_category TEXT,
      points INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Student Quiz Results
  db.exec(`
    CREATE TABLE IF NOT EXISTS student_quiz_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      quiz_type TEXT DEFAULT 'career_assessment',
      total_questions INTEGER,
      correct_answers INTEGER,
      score REAL,
      result_category TEXT,
      recommended_careers TEXT,
      completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Student Progress Tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS student_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      enrollment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      current_level INTEGER DEFAULT 1,
      progress_percentage REAL DEFAULT 0,
      total_months INTEGER DEFAULT 10,
      career_path TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'paused')),
      last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(student_id)
    )
  `);

  // Learning Materials (Notes, Assignments, Quizzes)
  db.exec(`
    CREATE TABLE IF NOT EXISTS learning_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      counselor_id INTEGER NOT NULL,
      student_id INTEGER,
      material_type TEXT NOT NULL CHECK(material_type IN ('note', 'assignment', 'quiz')),
      title TEXT NOT NULL,
      content TEXT,
      instructions TEXT,
      due_date DATETIME,
      points INTEGER DEFAULT 0,
      is_published BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (counselor_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Quiz Questions for Learning Materials
  db.exec(`
    CREATE TABLE IF NOT EXISTS material_quiz_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_id INTEGER NOT NULL,
      question TEXT NOT NULL,
      question_type TEXT DEFAULT 'multiple_choice',
      options TEXT,
      correct_answer TEXT,
      points INTEGER DEFAULT 1,
      order_index INTEGER DEFAULT 0,
      FOREIGN KEY (material_id) REFERENCES learning_materials(id) ON DELETE CASCADE
    )
  `);

  // Student Submissions
  db.exec(`
    CREATE TABLE IF NOT EXISTS student_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      material_id INTEGER NOT NULL,
      submission_content TEXT,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'submitted' CHECK(status IN ('submitted', 'graded', 'returned')),
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (material_id) REFERENCES learning_materials(id) ON DELETE CASCADE
    )
  `);

  // Grades
  db.exec(`
    CREATE TABLE IF NOT EXISTS grades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      material_id INTEGER NOT NULL,
      counselor_id INTEGER NOT NULL,
      score REAL,
      max_score REAL,
      percentage REAL,
      feedback TEXT,
      graded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (submission_id) REFERENCES student_submissions(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (material_id) REFERENCES learning_materials(id) ON DELETE CASCADE,
      FOREIGN KEY (counselor_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Live Sessions
  db.exec(`
    CREATE TABLE IF NOT EXISTS live_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER,
      student_id INTEGER NOT NULL,
      counselor_id INTEGER NOT NULL,
      session_title TEXT,
      session_type TEXT DEFAULT 'counseling' CHECK(session_type IN ('counseling', 'tutoring', 'assessment')),
      start_time DATETIME,
      end_time DATETIME,
      status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'active', 'completed', 'cancelled')),
      session_notes TEXT,
      recording_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (counselor_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Notifications
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('assignment', 'quiz', 'grade', 'appointment', 'session', 'message', 'report')),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      related_id INTEGER,
      is_read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Counselor Reports to Admin
  db.exec(`
    CREATE TABLE IF NOT EXISTS counselor_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      counselor_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      report_type TEXT DEFAULT 'progress' CHECK(report_type IN ('progress', 'concern', 'achievement')),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      student_level INTEGER,
      student_progress REAL,
      recommendations TEXT,
      is_urgent BOOLEAN DEFAULT 0,
      admin_viewed BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (counselor_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Insert default admin user
  const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@careerscope.lib');
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync('Liberia2025!', 10);
    db.prepare(`
      INSERT INTO users (email, phone, password, first_name, last_name, role, is_approved)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('admin@careerscope.lib', '0880000000', hashedPassword, 'Admin', 'CareerScope', 'admin', 1);
    console.log('✅ Default admin user created');
  }

  // Insert default test student user
  const studentExists = db.prepare('SELECT id FROM users WHERE phone = ?').get('0771234567');
  if (!studentExists) {
    const studentPassword = bcrypt.hashSync('student123', 10);
    db.prepare(`
      INSERT INTO users (email, phone, password, first_name, last_name, county, school_name, grade_level, role, is_approved)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('student@test.com', '0771234567', studentPassword, 'Test', 'Student', 'Montserrado', 'Test High School', 10, 'student', 1);
    console.log('✅ Default test student user created');
  }

  // Insert default test counselor user
  const counselorExists = db.prepare('SELECT id FROM users WHERE phone = ?').get('0881234567');
  if (!counselorExists) {
    const counselorPassword = bcrypt.hashSync('counselor123', 10);
    db.prepare(`
      INSERT INTO users (email, phone, password, first_name, last_name, county, qualification, years_of_experience, industry_specialty, role, is_approved)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('counselor@test.com', '0881234567', counselorPassword, 'Test', 'Counselor', 'Montserrado', 'M.Ed. Counseling', 5, 'Career Guidance', 'counselor', 1);
    console.log('✅ Default test counselor user created');
  }

  // Insert comprehensive careers list (150 careers)
  const careersCount = db.prepare('SELECT COUNT(*) as count FROM careers').get();
  if (careersCount.count === 0) {
    const insertCareer = db.prepare(`
      INSERT INTO careers (title, description, job_outlook, required_education, salary_range, skills_required, universities, category)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((careers) => {
      let added = 0;
      for (const career of careers) {
        try {
          insertCareer.run(
            career.title,
            career.description,
            career.job_outlook || null,
            career.required_education || null,
            career.salary_range || null,
            career.skills_required || null,
            career.universities || null,
            career.category || null
          );
          added++;
        } catch (error) {
          console.error(`Error adding career "${career.title}":`, error.message);
        }
      }
      return added;
    });

    const added = insertMany(careersData);
    console.log(`✅ Successfully inserted ${added} careers into database`);
  } else {
    console.log(`✅ Careers already exist in database (${careersCount.count} careers)`);
  }

  // Insert sample career assessment quiz questions
  const quizCount = db.prepare('SELECT COUNT(*) as count FROM quiz_questions').get();
  if (quizCount.count === 0) {
    const questions = [
      {
        question: 'What interests you most?',
        options: JSON.stringify(['Helping people directly', 'Building and creating things', 'Solving complex problems', 'Teaching and sharing knowledge']),
        career_category: 'general',
        points: 1
      },
      {
        question: 'Which subject do you enjoy most?',
        options: JSON.stringify(['Science and Biology', 'Mathematics and Physics', 'Languages and Literature', 'Social Studies']),
        career_category: 'academic',
        points: 1
      },
      {
        question: 'What type of work environment do you prefer?',
        options: JSON.stringify(['Hospital or clinic', 'Office or corporate', 'Outdoor or field work', 'School or classroom']),
        career_category: 'environment',
        points: 1
      },
      {
        question: 'How do you prefer to work?',
        options: JSON.stringify(['Independently', 'In a team', 'With guidance from others', 'Leading others']),
        career_category: 'workstyle',
        points: 1
      },
      {
        question: 'What is your biggest career goal?',
        options: JSON.stringify(['Make a difference in people\'s lives', 'Build innovative solutions', 'Achieve financial success', 'Share knowledge and educate']),
        career_category: 'motivation',
        points: 1
      },
      {
        question: 'Which skill do you want to develop most?',
        options: JSON.stringify(['Medical knowledge', 'Technical skills', 'Communication skills', 'Leadership skills']),
        career_category: 'skills',
        points: 1
      },
      {
        question: 'What challenges do you enjoy?',
        options: JSON.stringify(['Saving lives and treating patients', 'Solving technical problems', 'Managing projects and teams', 'Explaining complex concepts']),
        career_category: 'challenges',
        points: 1
      },
      {
        question: 'Where do you see yourself in 10 years?',
        options: JSON.stringify(['As a healthcare professional', 'As an engineer or tech expert', 'As a business leader', 'As an educator or counselor']),
        career_category: 'future',
        points: 1
      }
    ];

    const insertQuestion = db.prepare(`
      INSERT INTO quiz_questions (question, options, career_category, points)
      VALUES (?, ?, ?, ?)
    `);

    const insertManyQuestions = db.transaction((questions) => {
      for (const q of questions) {
        insertQuestion.run(q.question, q.options, q.career_category, q.points);
      }
    });

    insertManyQuestions(questions);
    console.log('✅ Sample quiz questions inserted');
  }

  console.log('✅ Database initialized successfully');
}

