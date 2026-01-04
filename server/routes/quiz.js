import express from 'express';
import { db } from '../db/init.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Get career assessment quiz questions
router.get('/career-assessment', authenticate, (req, res) => {
  const questions = db.prepare('SELECT * FROM quiz_questions ORDER BY id').all();
  res.json({ questions });
});

// Submit quiz results - Enhanced to be sensitive to careers in database
router.post('/career-assessment/submit', authenticate, (req, res) => {
  try {
    const { answers } = req.body; // Array of { questionId, answer }

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'Answers required' });
    }

    // Get all questions and careers from database
    const questions = db.prepare('SELECT * FROM quiz_questions').all();
    const allCareers = db.prepare('SELECT * FROM careers').all();
    
    // Create a mapping of career categories
    const careerCategories = [...new Set(allCareers.map(c => c.category).filter(Boolean))];
    
    // Calculate category scores based on answers
    const categoryScores = {};
    const answerKeywords = {}; // Track keywords from answers
    
    answers.forEach(({ questionId, answer }) => {
      const question = questions.find(q => q.id === questionId);
      if (question) {
        const category = question.career_category;
        if (!categoryScores[category]) {
          categoryScores[category] = 0;
        }
        categoryScores[category] += 1;
        
        // Extract keywords from answer for better matching
        const answerLower = answer.toLowerCase();
        if (answerLower.includes('health') || answerLower.includes('medical') || answerLower.includes('doctor') || answerLower.includes('nurse')) {
          answerKeywords['healthcare'] = (answerKeywords['healthcare'] || 0) + 1;
        }
        if (answerLower.includes('tech') || answerLower.includes('computer') || answerLower.includes('software') || answerLower.includes('programming')) {
          answerKeywords['technology'] = (answerKeywords['technology'] || 0) + 1;
        }
        if (answerLower.includes('teach') || answerLower.includes('education') || answerLower.includes('school') || answerLower.includes('student')) {
          answerKeywords['education'] = (answerKeywords['education'] || 0) + 1;
        }
        if (answerLower.includes('business') || answerLower.includes('manage') || answerLower.includes('entrepreneur') || answerLower.includes('company')) {
          answerKeywords['business'] = (answerKeywords['business'] || 0) + 1;
        }
        if (answerLower.includes('engineer') || answerLower.includes('build') || answerLower.includes('construction') || answerLower.includes('design')) {
          answerKeywords['engineering'] = (answerKeywords['engineering'] || 0) + 1;
        }
        if (answerLower.includes('law') || answerLower.includes('legal') || answerLower.includes('lawyer') || answerLower.includes('justice')) {
          answerKeywords['law'] = (answerKeywords['law'] || 0) + 1;
        }
        if (answerLower.includes('agriculture') || answerLower.includes('farm') || answerLower.includes('crop') || answerLower.includes('livestock')) {
          answerKeywords['agriculture'] = (answerKeywords['agriculture'] || 0) + 1;
        }
      }
    });

    // Determine top categories from both question categories and answer keywords
    const combinedScores = {};
    
    // Add category scores
    Object.keys(categoryScores).forEach(cat => {
      const mappedCategory = mapCategoryToCareerCategory(cat);
      combinedScores[mappedCategory] = (combinedScores[mappedCategory] || 0) + categoryScores[cat];
    });
    
    // Add keyword scores
    Object.keys(answerKeywords).forEach(keyword => {
      const mappedCategory = keyword.charAt(0).toUpperCase() + keyword.slice(1);
      combinedScores[mappedCategory] = (combinedScores[mappedCategory] || 0) + answerKeywords[keyword] * 1.5; // Weight keywords higher
    });

    // Get top 3 categories
    const topCategories = Object.entries(combinedScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat]) => cat);

    const recommendedCategory = topCategories[0] || 'General';

    // Get recommended careers based on top categories - sensitive to actual careers in database
    let recommendedCareers = [];
    
    for (const category of topCategories) {
      const careersInCategory = allCareers.filter(c => 
        c.category && c.category.toLowerCase() === category.toLowerCase()
      );
      recommendedCareers.push(...careersInCategory);
    }
    
    // If no exact match, try partial matches
    if (recommendedCareers.length === 0) {
      for (const category of topCategories) {
        const careersInCategory = allCareers.filter(c => 
          c.category && c.category.toLowerCase().includes(category.toLowerCase())
        );
        recommendedCareers.push(...careersInCategory);
      }
    }
    
    // Remove duplicates and limit to top 10
    recommendedCareers = [...new Map(recommendedCareers.map(c => [c.id, c])).values()].slice(0, 10);

    // If still no careers, get top careers by category popularity
    if (recommendedCareers.length === 0) {
      const categoryCounts = {};
      allCareers.forEach(c => {
        if (c.category) {
          categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
        }
      });
      const topCategory = Object.keys(categoryCounts).sort((a, b) => categoryCounts[b] - categoryCounts[a])[0];
      if (topCategory) {
        recommendedCareers = allCareers.filter(c => c.category === topCategory).slice(0, 10);
      }
    }
    
    // Final fallback - if still no careers, return first 10 careers
    if (recommendedCareers.length === 0) {
      // Try to get careers from recommended category
      const categoryCareers = allCareers.filter(c => c.category === recommendedCategory);
      if (categoryCareers.length > 0) {
        recommendedCareers = categoryCareers.slice(0, 10);
      } else {
        // Get any 10 careers as last resort
        recommendedCareers = allCareers.slice(0, 10);
      }
    }
    
    console.log('Final recommended careers count:', recommendedCareers.length);
    console.log('Sample career:', recommendedCareers[0]);

    const totalQuestions = questions.length;
    const score = (Object.keys(answers).length / totalQuestions) * 100;

    // Save quiz result
    const result = db.prepare(`
      INSERT INTO student_quiz_results 
      (student_id, total_questions, correct_answers, score, result_category, recommended_careers)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      totalQuestions,
      Object.keys(answers).length,
      score,
      recommendedCategory,
      JSON.stringify(recommendedCareers.map(c => c.id))
    );

    // Initialize or update student progress
    const existingProgress = db.prepare('SELECT id FROM student_progress WHERE student_id = ?').get(req.user.id);
    if (!existingProgress) {
      db.prepare(`
        INSERT INTO student_progress (student_id, enrollment_date, career_path)
        VALUES (?, CURRENT_TIMESTAMP, ?)
      `).run(req.user.id, recommendedCategory);
    } else {
      db.prepare(`
        UPDATE student_progress SET career_path = ?, last_activity = CURRENT_TIMESTAMP
        WHERE student_id = ?
      `).run(recommendedCategory, req.user.id);
    }

    // Get recommended counselors based on matching career categories
    let recommendedCounselors = [];
    if (topCategories.length > 0) {
      // Build dynamic query based on number of categories
      const searchTerms = [];
      const placeholders = [];
      
      // Add category matches
      topCategories.forEach(cat => {
        searchTerms.push(`%${cat}%`);
        placeholders.push('?');
      });
      
      // Add General as fallback
      searchTerms.push('%General%');
      placeholders.push('?');
      
      // Build query with appropriate number of OR conditions
      const conditions = placeholders.map(() => 'industry_specialty LIKE ?').join(' OR ');
      
      recommendedCounselors = db.prepare(`
        SELECT * FROM users 
        WHERE role = 'counselor' 
        AND is_approved = 1 
        AND (${conditions})
        ORDER BY years_of_experience DESC
        LIMIT 10
      `).all(...searchTerms);
    } else {
      recommendedCounselors = db.prepare(`
        SELECT * FROM users 
        WHERE role = 'counselor' 
        AND is_approved = 1 
        AND industry_specialty LIKE ?
        ORDER BY years_of_experience DESC
        LIMIT 10
      `).all('%General%');
    }

    // Ensure recommendedCareers is properly formatted
    const formattedCareers = recommendedCareers.map(c => ({
      id: c.id,
      title: c.title,
      category: c.category,
      description: c.description,
      job_outlook: c.job_outlook,
      required_education: c.required_education,
      salary_range: c.salary_range,
      skills_required: c.skills_required,
      universities: c.universities
    }));

    console.log('Sending quiz result with', formattedCareers.length, 'careers');

    res.json({
      message: 'Quiz completed successfully',
      result: {
        id: result.lastInsertRowid,
        score,
        totalQuestions,
        correctAnswers: Object.keys(answers).length,
        recommendedCategory,
        recommendedCareers: formattedCareers,
        recommendedCounselors: recommendedCounselors || []
      }
    });
  } catch (error) {
    console.error('Submit quiz error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to map question categories to career categories
function mapCategoryToCareerCategory(questionCategory) {
  const mapping = {
    'general': 'Healthcare',
    'academic': 'Education',
    'environment': 'Agriculture',
    'workstyle': 'Business',
    'motivation': 'Business',
    'skills': 'Technology',
    'challenges': 'General',
    'future': 'General'
  };
  
  return mapping[questionCategory] || 'General';
}

// Get student quiz results
router.get('/results', authenticate, (req, res) => {
  const results = db.prepare(`
    SELECT * FROM student_quiz_results 
    WHERE student_id = ? 
    ORDER BY completed_at DESC 
    LIMIT 1
  `).get(req.user.id);

  if (!results) {
    return res.json({ hasCompleted: false });
  }

  const recommendedCareers = results.recommended_careers 
    ? JSON.parse(results.recommended_careers).map(id => {
        const career = db.prepare('SELECT * FROM careers WHERE id = ?').get(id);
        return career;
      }).filter(Boolean)
    : [];

  res.json({ 
    hasCompleted: true,
    result: {
      ...results,
      recommendedCareers
    }
  });
});

// Check if student has completed quiz
router.get('/check-completion', authenticate, (req, res) => {
  const result = db.prepare(`
    SELECT id FROM student_quiz_results 
    WHERE student_id = ? 
    LIMIT 1
  `).get(req.user.id);

  res.json({ hasCompleted: !!result });
});

// Reset student progress and allow retaking assessment
router.post('/reset-progress', authenticate, requireRole('student'), (req, res) => {
  try {
    const studentId = req.user.id;

    // Use a transaction to ensure all deletions succeed or none do
    const resetProgress = db.transaction(() => {
      // Delete quiz results
      db.prepare('DELETE FROM student_quiz_results WHERE student_id = ?').run(studentId);
      
      // Delete student progress
      db.prepare('DELETE FROM student_progress WHERE student_id = ?').run(studentId);
      
      // Delete career interests
      db.prepare('DELETE FROM student_career_interests WHERE student_id = ?').run(studentId);
      
      // Delete appointments
      db.prepare('DELETE FROM appointments WHERE student_id = ?').run(studentId);
      
      // Delete schedules
      db.prepare('DELETE FROM schedules WHERE student_id = ?').run(studentId);
      
      // Delete student submissions (which will cascade to grades)
      const submissions = db.prepare('SELECT id FROM student_submissions WHERE student_id = ?').all(studentId);
      submissions.forEach(sub => {
        // Delete grades for each submission
        db.prepare('DELETE FROM grades WHERE submission_id = ?').run(sub.id);
      });
      db.prepare('DELETE FROM student_submissions WHERE student_id = ?').run(studentId);
      
      // Delete live sessions where student is participant
      db.prepare('DELETE FROM live_sessions WHERE student_id = ?').run(studentId);
      
      // Delete counselor reports related to student
      db.prepare('DELETE FROM counselor_reports WHERE student_id = ?').run(studentId);
    });

    resetProgress();

    res.json({ 
      message: 'Progress reset successfully. You can now retake the assessment.',
      success: true 
    });
  } catch (error) {
    console.error('Reset progress error:', error);
    res.status(500).json({ error: 'Failed to reset progress' });
  }
});

export default router;
