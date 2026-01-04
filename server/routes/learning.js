import express from 'express';
import { db } from '../db/init.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Create learning material (Counselor)
router.post('/materials', authenticate, requireRole('counselor'), (req, res) => {
  try {
    const { studentId, materialType, title, content, instructions, dueDate, points, questions } = req.body;

    if (!materialType || !title) {
      return res.status(400).json({ error: 'Material type and title required' });
    }

    const result = db.prepare(`
      INSERT INTO learning_materials 
      (counselor_id, student_id, material_type, title, content, instructions, due_date, points, is_published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      req.user.id,
      studentId || null,
      materialType,
      title,
      content || null,
      instructions || null,
      dueDate || null,
      points || 0
    );

    const materialId = result.lastInsertRowid;

    // Add quiz questions if material type is quiz
    if (materialType === 'quiz' && questions && Array.isArray(questions)) {
      const insertQuestion = db.prepare(`
        INSERT INTO material_quiz_questions 
        (material_id, question, question_type, options, correct_answer, points, order_index)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      questions.forEach((q, index) => {
        insertQuestion.run(
          materialId,
          q.question,
          q.questionType || 'multiple_choice',
          JSON.stringify(q.options || []),
          q.correctAnswer || null,
          q.points || 1,
          index
        );
      });
    }

    // Create notification for student
    if (studentId) {
      db.prepare(`
        INSERT INTO notifications (user_id, type, title, message, related_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        studentId,
        materialType,
        `New ${materialType} from your counselor`,
        `You have a new ${materialType}: ${title}`,
        materialId
      );
    }

    res.status(201).json({ message: 'Material created', materialId });
  } catch (error) {
    console.error('Create material error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get materials for student
router.get('/materials/student', authenticate, (req, res) => {
  const materials = db.prepare(`
    SELECT lm.*, 
           u.first_name || ' ' || u.last_name as counselor_name,
           u.profile_image as counselor_image
    FROM learning_materials lm
    INNER JOIN users u ON lm.counselor_id = u.id
    WHERE (lm.student_id = ? OR lm.student_id IS NULL)
    AND lm.is_published = 1
    ORDER BY lm.created_at DESC
  `).all(req.user.id);

  // Get quiz questions for quiz materials
  const materialsWithQuestions = materials.map(material => {
    if (material.material_type === 'quiz') {
      const questions = db.prepare(`
        SELECT * FROM material_quiz_questions 
        WHERE material_id = ? 
        ORDER BY order_index
      `).all(material.id);
      return { ...material, questions };
    }
    return material;
  });

  res.json({ materials: materialsWithQuestions });
});

// Get materials for counselor
router.get('/materials/counselor', authenticate, requireRole('counselor'), (req, res) => {
  const materials = db.prepare(`
    SELECT lm.*,
           u.first_name || ' ' || u.last_name as student_name
    FROM learning_materials lm
    LEFT JOIN users u ON lm.student_id = u.id
    WHERE lm.counselor_id = ?
    ORDER BY lm.created_at DESC
  `).all(req.user.id);

  res.json({ materials });
});

// Submit assignment/quiz
router.post('/submit', authenticate, (req, res) => {
  try {
    const { materialId, submissionContent, answers } = req.body;

    if (!materialId) {
      return res.status(400).json({ error: 'Material ID required' });
    }

    const material = db.prepare('SELECT * FROM learning_materials WHERE id = ?').get(materialId);
    if (!material) {
      return res.status(404).json({ error: 'Material not found' });
    }

    const submission = db.prepare(`
      INSERT INTO student_submissions 
      (student_id, material_id, submission_content)
      VALUES (?, ?, ?)
    `).run(
      req.user.id,
      materialId,
      submissionContent || JSON.stringify(answers || {})
    );

    // Notify counselor
    db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, related_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      material.counselor_id,
      material.material_type,
      'New submission received',
      `Student submitted ${material.material_type}: ${material.title}`,
      submission.lastInsertRowid
    );

    res.status(201).json({ message: 'Submission successful', submissionId: submission.lastInsertRowid });
  } catch (error) {
    console.error('Submit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get submissions for counselor
router.get('/submissions/:materialId', authenticate, requireRole('counselor'), (req, res) => {
  const submissions = db.prepare(`
    SELECT s.*,
           u.first_name || ' ' || u.last_name as student_name,
           u.profile_image as student_image
    FROM student_submissions s
    INNER JOIN users u ON s.student_id = u.id
    WHERE s.material_id = ?
    ORDER BY s.submitted_at DESC
  `).all(req.params.materialId);

  res.json({ submissions });
});

// Grade submission
router.post('/grade', authenticate, requireRole('counselor'), (req, res) => {
  try {
    const { submissionId, score, maxScore, feedback } = req.body;

    if (!submissionId || score === undefined) {
      return res.status(400).json({ error: 'Submission ID and score required' });
    }

    const submission = db.prepare('SELECT * FROM student_submissions WHERE id = ?').get(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const material = db.prepare('SELECT * FROM learning_materials WHERE id = ?').get(submission.material_id);
    if (material.counselor_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const percentage = (score / (maxScore || material.points || 100)) * 100;

    // Create grade
    const grade = db.prepare(`
      INSERT INTO grades 
      (submission_id, student_id, material_id, counselor_id, score, max_score, percentage, feedback)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      submissionId,
      submission.student_id,
      submission.material_id,
      req.user.id,
      score,
      maxScore || material.points || 100,
      percentage,
      feedback || null
    );

    // Update submission status
    db.prepare('UPDATE student_submissions SET status = ? WHERE id = ?').run('graded', submissionId);

    // Notify student
    db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, related_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      submission.student_id,
      'grade',
      'Grade received',
      `Your ${material.material_type} "${material.title}" has been graded: ${score}/${maxScore || material.points || 100}`,
      grade.lastInsertRowid
    );

    res.json({ message: 'Grade submitted', gradeId: grade.lastInsertRowid });
  } catch (error) {
    console.error('Grade error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get student grades
router.get('/grades/student', authenticate, (req, res) => {
  const grades = db.prepare(`
    SELECT g.*,
           lm.title as material_title,
           lm.material_type,
           u.first_name || ' ' || u.last_name as counselor_name
    FROM grades g
    INNER JOIN learning_materials lm ON g.material_id = lm.id
    INNER JOIN users u ON g.counselor_id = u.id
    WHERE g.student_id = ?
    ORDER BY g.graded_at DESC
  `).all(req.user.id);

  res.json({ grades });
});

export default router;

