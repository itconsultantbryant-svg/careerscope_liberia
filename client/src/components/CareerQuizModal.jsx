import { useState, useEffect } from 'react';
import { X, CheckCircle, Calendar, Clock, User, BookOpen, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function CareerQuizModal({ isOpen, onClose, onComplete }) {
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedCareer, setSelectedCareer] = useState(null);
  const [careerCounselors, setCareerCounselors] = useState([]);
  const [loadingCounselors, setLoadingCounselors] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedCounselor, setSelectedCounselor] = useState(null);
  const [bookingType, setBookingType] = useState('immediate'); // 'immediate' or 'later'
  const navigate = useNavigate();

  // Handle modal state - separate effects to avoid conflicts
  useEffect(() => {
    if (!isOpen) {
      // Reset everything when modal closes
      setResult(null);
      setSelectedCareer(null);
      setCareerCounselors([]);
      setCurrentQuestion(0);
      setAnswers({});
      setShowBookingModal(false);
      setSelectedCounselor(null);
      setLoading(true);
    }
  }, [isOpen]);

  // Fetch questions when modal opens for the first time (no result yet)
  useEffect(() => {
    if (isOpen && !result && questions.length === 0) {
      fetchQuestions();
      setCurrentQuestion(0);
      setAnswers({});
      setSelectedCareer(null);
      setCareerCounselors([]);
      setShowBookingModal(false);
      setSelectedCounselor(null);
    }
  }, [isOpen]);

  const fetchQuestions = async () => {
    try {
      const res = await api.get('/quiz/career-assessment');
      setQuestions(res.data.questions || []);
      setLoading(false);
    } catch (error) {
      toast.error('Failed to load quiz');
      setLoading(false);
    }
  };

  const handleAnswer = (questionId, answer) => {
    setAnswers({ ...answers, [questionId]: answer });
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length < questions.length) {
      toast.error('Please answer all questions');
      return;
    }

    setSubmitting(true);
    try {
      const answerArray = Object.entries(answers).map(([questionId, answer]) => ({
        questionId: parseInt(questionId),
        answer
      }));

      const res = await api.post('/quiz/career-assessment/submit', { answers: answerArray });
      
      if (!res.data || !res.data.result) {
        console.error('Invalid quiz response:', res.data);
        toast.error('Invalid response from server');
        return;
      }
      
      const quizResult = res.data.result;
      console.log('Quiz result received:', quizResult);
      
      // Ensure recommendedCareers is an array and has valid data
      if (!Array.isArray(quizResult.recommendedCareers)) {
        console.warn('recommendedCareers is not an array:', quizResult.recommendedCareers);
        quizResult.recommendedCareers = [];
      }
      
      // Validate that careers have required fields
      quizResult.recommendedCareers = quizResult.recommendedCareers.filter(c => c && c.id && c.title);
      
      console.log('Processed quiz result:', quizResult);
      console.log('Number of recommended careers:', quizResult.recommendedCareers.length);
      
      setResult(quizResult);
      toast.success('Quiz completed!');
      
      if (onComplete) {
        onComplete(quizResult);
      }
    } catch (error) {
      console.error('Quiz submission error:', error);
      toast.error(error.response?.data?.error || 'Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCareerClick = async (career) => {
    if (!career || !career.id) {
      toast.error('Invalid career selected');
      return;
    }
    
    setSelectedCareer(career);
    setLoadingCounselors(true);
    try {
      const res = await api.get(`/careers/${career.id}`);
      
      if (!res.data) {
        toast.error('Invalid response from server');
        setCareerCounselors([]);
        return;
      }
      
      const counselors = res.data.counselors || [];
      setCareerCounselors(counselors);
      
      if (counselors.length === 0) {
        toast.info('No counselors available for this career at the moment');
      }
    } catch (error) {
      console.error('Failed to load counselors:', error);
      toast.error(error.response?.data?.error || 'Failed to load counselors');
      setCareerCounselors([]);
    } finally {
      setLoadingCounselors(false);
    }
  };

  const handleBookAppointment = (counselor, type = 'immediate') => {
    setSelectedCounselor(counselor);
    setBookingType(type);
    setShowBookingModal(true);
  };

  const handleConfirmBooking = async () => {
    if (!selectedCounselor) {
      toast.error('No counselor selected');
      return;
    }

    try {
      setShowBookingModal(false);
      
      if (bookingType === 'immediate') {
        // Navigate to appointments page with counselor pre-selected
        onClose();
        const careerParam = selectedCareer?.id ? `&career=${selectedCareer.id}` : '';
        navigate(`/student/appointments?counselor=${selectedCounselor.id}${careerParam}`);
        toast.success('Redirecting to book appointment...');
      } else {
        // Navigate to schedule appointment page
        onClose();
        const careerParam = selectedCareer?.id ? `&career=${selectedCareer.id}` : '';
        navigate(`/student/appointments?counselor=${selectedCounselor.id}${careerParam}&schedule=true`);
        toast.success('Redirecting to schedule appointment...');
      }
    } catch (error) {
      console.error('Booking navigation error:', error);
      toast.error('Failed to process booking');
    }
  };

  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  // Debug logging
  if (result) {
    console.log('Rendering results screen. Result:', result);
    console.log('Has selectedCareer:', !!selectedCareer);
    console.log('Recommended careers count:', result.recommendedCareers?.length || 0);
    console.log('Modal isOpen:', isOpen);
    console.log('showBookingModal:', showBookingModal);
  }

  // Show results screen if we have a result and no career is selected
  if (result && !selectedCareer && !showBookingModal) {
    console.log('✅ Rendering results view - conditions met');
    console.log('Result object:', result);
    console.log('Recommended careers:', result.recommendedCareers);
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto"
        >
          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="text-center flex-1">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Quiz Completed!</h2>
                <p className="text-gray-600">Your Career Assessment Results</p>
              </div>
              <button
                onClick={() => {
                  setResult(null);
                  setSelectedCareer(null);
                  onClose();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="bg-gradient-to-r from-primary-600 to-blue-600 text-white rounded-lg p-6 mb-6">
              <div className="text-center">
                <p className="text-4xl font-bold mb-2">{Math.round(result.score)}%</p>
                <p className="text-lg">Recommended Category: {result.recommendedCategory}</p>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-bold mb-4">Recommended Careers for You</h3>
              <p className="text-gray-600 mb-4">Click on any career to see available counselors</p>
              {(() => {
                const careers = Array.isArray(result.recommendedCareers) ? result.recommendedCareers : [];
                console.log('Rendering careers. Count:', careers.length, 'Careers:', careers);
                
                if (careers.length > 0) {
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {careers.map((career, index) => {
                        if (!career || (!career.id && !career.title)) {
                          console.warn('Invalid career at index', index, career);
                          return null;
                        }
                        return (
                          <motion.div
                            key={career.id || `career-${index}`}
                            whileHover={{ scale: 1.05, y: -5 }}
                            className="border-2 border-gray-200 rounded-lg p-4 hover:border-primary-500 hover:shadow-lg cursor-pointer transition-all"
                            onClick={() => {
                              console.log('Career clicked:', career);
                              handleCareerClick(career);
                            }}
                          >
                            <div className="flex items-start space-x-3">
                              <BookOpen className="w-6 h-6 text-primary-600 flex-shrink-0 mt-1" />
                              <div className="flex-1">
                                <h4 className="font-bold text-gray-900 mb-1">{career.title || 'Career'}</h4>
                                <p className="text-sm text-gray-600 mb-2">{career.category || 'General'}</p>
                                {career.description && (
                                  <p className="text-xs text-gray-500 line-clamp-2">{career.description}</p>
                                )}
                              </div>
                            </div>
                            <div className="mt-3 flex items-center text-primary-600 text-sm font-medium">
                              <span>View Counselors</span>
                              <ArrowRight className="w-4 h-4 ml-1" />
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  );
                } else {
                  return (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600">No careers recommended at this time.</p>
                      <p className="text-sm text-gray-500 mt-2">Please try the assessment again or browse all careers.</p>
                      <button
                        onClick={() => {
                          setResult(null);
                          setCurrentQuestion(0);
                          setAnswers({});
                        }}
                        className="mt-4 btn-primary"
                      >
                        Retake Assessment
                      </button>
                    </div>
                  );
                }
              })()}
            </div>

            <div className="flex space-x-4">
              <button
                onClick={() => {
                  setResult(null);
                  setSelectedCareer(null);
                  setCareerCounselors([]);
                  onClose();
                }}
                className="btn-primary flex-1"
              >
                Go to Dashboard
              </button>
              <button
                onClick={() => {
                  setResult(null);
                  setSelectedCareer(null);
                  setCareerCounselors([]);
                  onClose();
                  navigate('/careers');
                }}
                className="btn-secondary flex-1"
              >
                Browse All Careers
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Show counselors for selected career
  if (selectedCareer) {
    return (
      <>
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <button
                    onClick={() => setSelectedCareer(null)}
                    className="text-primary-600 hover:text-primary-700 mb-2 flex items-center"
                  >
                    <ArrowRight className="w-4 h-4 rotate-180 mr-1" />
                    Back to Careers
                  </button>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedCareer.title}</h2>
                  <p className="text-gray-600">{selectedCareer.category}</p>
                </div>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                  <X className="w-6 h-6" />
                </button>
              </div>

            {loadingCounselors ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading counselors...</p>
              </div>
            ) : careerCounselors.length > 0 ? (
              <>
                <div className="mb-6">
                  <h3 className="text-xl font-bold mb-2">Available Counselors</h3>
                  <p className="text-gray-600">Book an appointment with a counselor specializing in {selectedCareer.title}</p>
                </div>
                <div className="space-y-4">
                  {careerCounselors.map((counselor) => (
                    <motion.div
                      key={counselor.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="border-2 border-gray-200 rounded-lg p-6 hover:border-primary-500 hover:shadow-lg transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4 flex-1">
                          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="w-8 h-8 text-primary-600" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-lg text-gray-900 mb-1">
                              {counselor.first_name} {counselor.last_name}
                            </h4>
                            <p className="text-sm text-gray-600 mb-2">
                              <span className="font-medium">Specialty:</span> {counselor.industry_specialty || 'General Counseling'}
                            </p>
                            {counselor.years_of_experience && (
                              <p className="text-sm text-gray-600 mb-1">
                                <span className="font-medium">Experience:</span> {counselor.years_of_experience} years
                              </p>
                            )}
                            {counselor.county && (
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Location:</span> {counselor.county}
                              </p>
                            )}
                            {counselor.bio && (
                              <p className="text-sm text-gray-600 mt-2 line-clamp-2">{counselor.bio}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col space-y-2 ml-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBookAppointment(counselor, 'immediate');
                            }}
                            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium flex items-center space-x-2"
                          >
                            <Calendar className="w-4 h-4" />
                            <span>Book Now</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBookAppointment(counselor, 'later');
                            }}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium flex items-center space-x-2"
                          >
                            <Clock className="w-4 h-4" />
                            <span>Schedule Later</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">No counselors available for this career at the moment.</p>
                <button
                  onClick={() => setSelectedCareer(null)}
                  className="btn-secondary"
                >
                  Back to Careers
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
      
      {/* Booking confirmation modal - Show on top of counselor list */}
      {showBookingModal && selectedCounselor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Book Appointment</h3>
              <button
                onClick={() => {
                  setShowBookingModal(false);
                  setSelectedCounselor(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-4">
              <p className="text-gray-600 mb-2">
                <span className="font-medium">Counselor:</span> {selectedCounselor.first_name} {selectedCounselor.last_name}
              </p>
              {selectedCareer && (
                <p className="text-gray-600 mb-2">
                  <span className="font-medium">Career:</span> {selectedCareer.title}
                </p>
              )}
              <p className="text-gray-600">
                <span className="font-medium">Booking Type:</span> {bookingType === 'immediate' ? 'Book Now (Recommended)' : 'Schedule for Later'}
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowBookingModal(false);
                  setSelectedCounselor(null);
                }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBooking}
                className="btn-primary flex-1"
              >
                Confirm & Continue
              </button>
            </div>
          </motion.div>
        </div>
      )}
      </>
    );
  }

  const question = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const options = question ? JSON.parse(question.options || '[]') : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-2xl font-bold">Career Assessment Quiz</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Question {currentQuestion + 1} of {questions.length}</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-4">{question?.question}</h3>
            <div className="space-y-3">
              {options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswer(question.id, option)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    answers[question.id] === option
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-gray-200 hover:border-primary-300'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentQuestion === 0}
              className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            {currentQuestion === questions.length - 1 ? (
              <button
                onClick={handleSubmit}
                disabled={submitting || !answers[question.id]}
                className="btn-primary disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Quiz'}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={!answers[question.id]}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
