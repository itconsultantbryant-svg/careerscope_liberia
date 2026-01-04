import { db } from '../db/init.js';

// Update quiz questions to be more comprehensive and career-focused
function updateQuizQuestions() {
  console.log('Updating quiz questions to be career-focused...');
  
  // Get all career categories from database
  const categories = db.prepare('SELECT DISTINCT category FROM careers WHERE category IS NOT NULL').all();
  const categoryList = categories.map(c => c.category);
  
  console.log('Found categories:', categoryList);
  
  // Delete existing questions
  db.prepare('DELETE FROM quiz_questions').run();
  console.log('Cleared existing questions');
  
  // Create comprehensive questions based on actual careers
  const questions = [
    {
      question: 'What type of work environment appeals to you most?',
      options: JSON.stringify([
        'Hospital, clinic, or healthcare facility',
        'Office, corporate, or business setting',
        'School, classroom, or educational institution',
        'Outdoor, field, or agricultural environment',
        'Technology company or IT department',
        'Courtroom, law firm, or legal office',
        'Construction site or engineering project',
        'Media studio or creative workspace'
      ]),
      career_category: 'environment',
      points: 1
    },
    {
      question: 'Which subject area interests you the most?',
      options: JSON.stringify([
        'Biology, Chemistry, and Medical Sciences',
        'Mathematics, Physics, and Engineering',
        'Business, Economics, and Management',
        'Education, Psychology, and Social Sciences',
        'Agriculture, Environmental Science, and Biology',
        'Law, Government, and Public Policy',
        'Computer Science, Technology, and Programming',
        'Arts, Media, and Communication'
      ]),
      career_category: 'academic',
      points: 1
    },
    {
      question: 'What is your primary career motivation?',
      options: JSON.stringify([
        'Helping and caring for people directly',
        'Building, creating, or designing things',
        'Solving complex problems and challenges',
        'Teaching, mentoring, or sharing knowledge',
        'Managing businesses and leading teams',
        'Protecting rights and ensuring justice',
        'Innovating with technology',
        'Expressing creativity and artistic vision'
      ]),
      career_category: 'motivation',
      points: 1
    },
    {
      question: 'How do you prefer to work?',
      options: JSON.stringify([
        'Independently with minimal supervision',
        'In a collaborative team environment',
        'With guidance and mentorship',
        'Leading and managing others',
        'In a structured, routine setting',
        'In a dynamic, changing environment',
        'With clear procedures and protocols',
        'With creative freedom and flexibility'
      ]),
      career_category: 'workstyle',
      points: 1
    },
    {
      question: 'Which skills do you want to develop most?',
      options: JSON.stringify([
        'Medical knowledge and patient care',
        'Technical and engineering skills',
        'Business and management skills',
        'Teaching and communication skills',
        'Agricultural and environmental knowledge',
        'Legal analysis and advocacy',
        'Programming and software development',
        'Creative and artistic abilities'
      ]),
      career_category: 'skills',
      points: 1
    },
    {
      question: 'What type of challenges do you enjoy?',
      options: JSON.stringify([
        'Medical emergencies and saving lives',
        'Designing and building solutions',
        'Managing projects and teams',
        'Explaining complex concepts to others',
        'Growing crops and managing resources',
        'Legal research and case preparation',
        'Debugging and solving technical problems',
        'Creating original content and designs'
      ]),
      career_category: 'challenges',
      points: 1
    },
    {
      question: 'What is your ideal work schedule?',
      options: JSON.stringify([
        'Regular daytime hours with some flexibility',
        'Shift work including nights and weekends',
        'Standard 9-to-5 business hours',
        'Flexible schedule with remote options',
        'Seasonal or project-based work',
        'Court hours with case preparation time',
        'Flexible tech hours with deadlines',
        'Variable schedule based on projects'
      ]),
      career_category: 'workstyle',
      points: 1
    },
    {
      question: 'Where do you see yourself in 10 years?',
      options: JSON.stringify([
        'As a healthcare professional (doctor, nurse, etc.)',
        'As an engineer or technical expert',
        'As a business owner or manager',
        'As an educator or counselor',
        'As an agricultural specialist or farmer',
        'As a lawyer or legal professional',
        'As a software developer or IT specialist',
        'As an artist, designer, or media professional'
      ]),
      career_category: 'future',
      points: 1
    },
    {
      question: 'What level of education are you willing to pursue?',
      options: JSON.stringify([
        'Professional degree (MD, JD, etc.)',
        'Bachelor\'s or Master\'s degree',
        'Diploma or certification program',
        'On-the-job training',
        'Vocational or technical training',
        'Continuing education and certifications',
        'Self-taught with certifications',
        'Any level that fits my goals'
      ]),
      career_category: 'academic',
      points: 1
    },
    {
      question: 'What impact do you want to make?',
      options: JSON.stringify([
        'Improve people\'s health and wellbeing',
        'Build infrastructure and technology',
        'Create jobs and economic opportunities',
        'Educate and shape future generations',
        'Ensure food security and sustainability',
        'Uphold justice and protect rights',
        'Innovate and advance technology',
        'Inspire through art and creativity'
      ]),
      career_category: 'motivation',
      points: 1
    }
  ];

  const insertQuestion = db.prepare(`
    INSERT INTO quiz_questions (question, options, career_category, points)
    VALUES (?, ?, ?, ?)
  `);

  const insertMany = db.transaction((questions) => {
    for (const q of questions) {
      insertQuestion.run(q.question, q.options, q.career_category, q.points);
    }
  });

  insertMany(questions);
  console.log(`✅ Inserted ${questions.length} updated quiz questions`);
  console.log(`📊 Total questions in database: ${db.prepare('SELECT COUNT(*) as count FROM quiz_questions').get().count}`);
}

// Run the update
updateQuizQuestions();

