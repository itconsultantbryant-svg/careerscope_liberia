import { useState, useEffect } from 'react';
import { useLocation, Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Sidebar from '../components/Sidebar';
import CareerQuizModal from '../components/CareerQuizModal';
import NotificationBell from '../components/NotificationBell';
import CalendarView from '../components/CalendarView';
import Careers from './Careers';
import { Calendar, Users, BookOpen, MessageSquare, FileText, Award, TrendingUp, Clock, X } from 'lucide-react';
import { motion } from 'framer-motion';

export default function StudentDashboard() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [appointments, setAppointments] = useState([]);
  const [counselors, setCounselors] = useState([]);
  const [careers, setCareers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [grades, setGrades] = useState([]);
  const [progress, setProgress] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [showQuiz, setShowQuiz] = useState(false);
  const [hasCompletedQuiz, setHasCompletedQuiz] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedCounselor, setSelectedCounselor] = useState(null);
  const [preSelectedCounselorId, setPreSelectedCounselorId] = useState(null);
  const [preSelectedCareerId, setPreSelectedCareerId] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showResetWarning, setShowResetWarning] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Determine active section from URL
  const getActiveSection = () => {
    const path = location.pathname;
    if (path.includes('/appointments')) return 'appointments';
    if (path.includes('/learning')) return 'learning';
    if (path.includes('/grades')) return 'grades';
    if (path.includes('/sessions')) return 'sessions';
    if (path.includes('/calendar')) return 'calendar';
    if (path.includes('/careers')) return 'careers';
    return 'dashboard';
  };

  const activeSection = getActiveSection();

  useEffect(() => {
    if (activeSection !== 'careers') {
      checkQuizCompletion();
      fetchData();
      // Poll for updates every 10 seconds for real-time experience
      const interval = setInterval(() => {
        fetchData();
        setLastUpdate(new Date());
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [activeSection]);

  // Handle URL query parameters for booking
  useEffect(() => {
    const counselorId = searchParams.get('counselor');
    const careerId = searchParams.get('career');
    const schedule = searchParams.get('schedule');
    
    if (counselorId && counselors.length > 0) {
      setPreSelectedCounselorId(counselorId);
      setPreSelectedCareerId(careerId);
      
      // If on appointments page, show booking modal
      if (activeSection === 'appointments') {
        const counselor = counselors.find(c => c.id === parseInt(counselorId));
        if (counselor) {
          setSelectedCounselor(counselor);
          if (schedule === 'true') {
            setShowScheduleModal(true);
          } else {
            setShowBookingModal(true);
          }
          // Clear URL parameters after a short delay
          setTimeout(() => {
            setSearchParams({});
          }, 100);
        } else {
          toast.error('Counselor not found');
          setSearchParams({});
        }
      } else if (activeSection !== 'appointments') {
        // Navigate to appointments page if not already there
        navigate(`/student/appointments?counselor=${counselorId}${careerId ? `&career=${careerId}` : ''}${schedule ? `&schedule=${schedule}` : ''}`);
      }
    }
  }, [searchParams, counselors, activeSection, navigate, setSearchParams]);

  const checkQuizCompletion = async () => {
    try {
      const res = await api.get('/quiz/check-completion');
      if (!res.data.hasCompleted) {
        setShowQuiz(true);
      }
      setHasCompletedQuiz(res.data.hasCompleted);
    } catch (error) {
      console.error('Failed to check quiz completion');
    }
  };

  const fetchData = async () => {
    try {
      const [
        apptsRes,
        counselorsRes,
        careersRes,
        materialsRes,
        gradesRes,
        progressRes,
        sessionsRes,
        schedulesRes
      ] = await Promise.all([
        api.get('/appointments/student'),
        api.get('/users/counselors/list'),
        api.get('/careers'),
        api.get('/learning/materials/student'),
        api.get('/learning/grades/student'),
        api.get('/progress/student'),
        api.get('/sessions/student'),
        api.get('/schedules/student'),
      ]);
      setAppointments(apptsRes.data.appointments || []);
      setCounselors(counselorsRes.data.counselors || []);
      setCareers(careersRes.data.careers || []);
      setMaterials(materialsRes.data.materials || []);
      setGrades(gradesRes.data.grades || []);
      setProgress(progressRes.data.progress);
      setSessions(sessionsRes.data.sessions || []);
      setSchedules(schedulesRes.data.schedules || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuizComplete = (result) => {
    // Don't close the modal immediately - let user see results
    // The modal will close when user clicks "Go to Dashboard" or closes it
    setHasCompletedQuiz(true);
    // Keep showQuiz true so results can be displayed
    fetchData();
  };

  const handleResetProgress = async () => {
    setResetting(true);
    try {
      await api.post('/quiz/reset-progress');
      toast.success('Progress reset successfully. You can now retake the assessment.');
      setHasCompletedQuiz(false);
      setShowQuiz(true);
      setShowResetWarning(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to reset progress');
    } finally {
      setResetting(false);
    }
  };

  const bookAppointment = async (counselorId) => {
    const date = prompt('Enter appointment date (YYYY-MM-DD):');
    const time = prompt('Enter appointment time (HH:MM):');
    if (!date || !time) return;

    try {
      await api.post('/appointments', { counselorId, appointmentDate: date, appointmentTime: time });
      toast.success('Appointment requested!');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to book appointment');
    }
  };

  const proposeSchedule = async (counselorId, dayOfWeek, startTime, endTime, notes) => {
    try {
      await api.post('/schedules/student/propose', {
        counselorId,
        dayOfWeek,
        startTime,
        endTime,
        notes
      });
      toast.success('Schedule proposed! Waiting for counselor approval.');
      setShowScheduleModal(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to propose schedule');
    }
  };

  const submitAssignment = async (materialId, content) => {
    try {
      await api.post('/learning/submit', { materialId, submissionContent: content });
      toast.success('Assignment submitted!');
      fetchData();
    } catch (error) {
      toast.error('Failed to submit assignment');
    }
  };

  // If careers route, show careers page
  if (activeSection === 'careers') {
    return <Careers />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const pendingMaterials = materials.filter(m => {
    const dueDate = m.due_date ? new Date(m.due_date) : null;
    const now = new Date();
    return dueDate && dueDate > now;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <Sidebar role="student" />
      
      {/* Quiz Modal - Keep open to show results after completion */}
      <CareerQuizModal
        isOpen={showQuiz}
        onClose={() => {
          setShowQuiz(false);
        }}
        onComplete={handleQuizComplete}
      />

      {/* Reset Progress Warning Modal */}
      {showResetWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-red-600">⚠️ Warning: Reset Progress</h3>
              <button
                onClick={() => setShowResetWarning(false)}
                className="text-gray-500 hover:text-gray-700"
                disabled={resetting}
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700 mb-4">
                Are you sure you want to retake the career assessment? This action will <strong className="text-red-600">permanently delete</strong> all of your progress, including:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 mb-4">
                <li>All quiz results and career recommendations</li>
                <li>Your learning progress and level</li>
                <li>All learning materials and assignments</li>
                <li>All grades and submissions</li>
                <li>All appointments with counselors</li>
                <li>All scheduled sessions</li>
                <li>All career interests</li>
              </ul>
              <p className="text-red-600 font-semibold">
                This action cannot be undone. You will start from scratch.
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowResetWarning(false)}
                className="btn-secondary flex-1"
                disabled={resetting}
              >
                Cancel
              </button>
              <button
                onClick={handleResetProgress}
                className="btn-primary bg-red-600 hover:bg-red-700 flex-1"
                disabled={resetting}
              >
                {resetting ? 'Resetting...' : 'Yes, Reset Everything'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <div className="ml-64 p-8">
        {/* Welcome Section with Progress - Only on dashboard */}
        {activeSection === 'dashboard' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-primary-600 to-blue-600 text-white rounded-xl p-6 mb-8"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold mb-2">Hi {user?.first_name}!</h1>
                <p className="text-white/90">
                  Grade {user?.grade_level} at {user?.school_name} • {user?.county} County
                </p>
              </div>
              <div className="flex items-center space-x-3">
                {hasCompletedQuiz && (
                  <button
                    onClick={() => setShowResetWarning(true)}
                    className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors text-sm font-medium border border-white/30"
                    title="Retake Assessment"
                  >
                    Retake Assessment
                  </button>
                )}
                <NotificationBell />
              </div>
            </div>

            {/* Progress Bar */}
            {progress && (
              <div className="mt-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Career Counseling Progress</span>
                  <span className="text-sm font-bold">
                    Level {progress.current_level}/10 • {Math.round(progress.progress_percentage)}%
                  </span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-4">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress.progress_percentage}%` }}
                    transition={{ duration: 1 }}
                    className="bg-white h-4 rounded-full flex items-center justify-end pr-2"
                  >
                    <span className="text-xs text-primary-600 font-bold">
                      {Math.round(progress.progress_percentage)}%
                    </span>
                  </motion.div>
                </div>
                <p className="text-xs mt-2 text-white/80">
                  {progress.total_months || 0} months into your 10-month career counseling journey
                </p>
                <div className="mt-2 flex items-center space-x-2 text-xs text-white/70">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span>Live • Last updated: {lastUpdate.toLocaleTimeString()}</span>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Section Headers */}
        {activeSection !== 'dashboard' && (
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {activeSection === 'appointments' && 'My Appointments'}
              {activeSection === 'learning' && 'Learning Portal'}
              {activeSection === 'grades' && 'My Grades'}
              {activeSection === 'sessions' && 'Live Sessions'}
            </h1>
            <p className="text-gray-600">
              {activeSection === 'appointments' && 'View and manage your counseling appointments'}
              {activeSection === 'learning' && 'Access your assignments, notes, and quizzes'}
              {activeSection === 'grades' && 'View your grades and feedback'}
              {activeSection === 'sessions' && 'View your live counseling sessions'}
              {activeSection === 'calendar' && 'View your schedules, appointments, and sessions on calendar'}
            </p>
          </div>
        )}

        {/* Dashboard View */}
        {activeSection === 'dashboard' && (
          <>
            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="card">
                <div className="flex items-center space-x-3">
                  <div className="bg-primary-100 p-3 rounded-lg">
                    <Calendar className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{appointments.length}</p>
                    <p className="text-sm text-gray-600">Appointments</p>
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{pendingMaterials.length}</p>
                    <p className="text-sm text-gray-600">Pending Tasks</p>
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="flex items-center space-x-3">
                  <div className="bg-green-100 p-3 rounded-lg">
                    <Award className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{grades.length}</p>
                    <p className="text-sm text-gray-600">Grades Received</p>
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="flex items-center space-x-3">
                  <div className="bg-gold-100 p-3 rounded-lg">
                    <MessageSquare className="w-6 h-6 text-gold-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{sessions.length}</p>
                    <p className="text-sm text-gray-600">Live Sessions</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Learning Materials */}
              <div className="card">
                <h2 className="text-2xl font-bold mb-4 flex items-center space-x-2">
                  <FileText className="w-6 h-6" />
                  <span>Learning Materials</span>
                </h2>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {materials.length === 0 ? (
                    <p className="text-gray-500">No materials assigned yet</p>
                  ) : (
                    materials.slice(0, 5).map((material) => (
                      <div key={material.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-semibold">{material.title}</h3>
                            <p className="text-sm text-gray-600">
                              {material.material_type} from {material.counselor_name}
                            </p>
                          </div>
                          <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded">
                            {material.material_type}
                          </span>
                        </div>
                        {material.due_date && (
                          <p className="text-xs text-gray-500 mb-2">
                            Due: {new Date(material.due_date).toLocaleDateString()}
                          </p>
                        )}
                        <button
                          onClick={() => {
                            const content = prompt('Enter your submission:');
                            if (content) submitAssignment(material.id, content);
                          }}
                          className="btn-primary text-sm py-2 px-4 mt-2"
                        >
                          Submit
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Grades */}
              <div className="card">
                <h2 className="text-2xl font-bold mb-4 flex items-center space-x-2">
                  <Award className="w-6 h-6" />
                  <span>My Grades</span>
                </h2>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {grades.length === 0 ? (
                    <p className="text-gray-500">No grades yet</p>
                  ) : (
                    grades.slice(0, 5).map((grade) => (
                      <div key={grade.id} className="border-l-4 border-green-600 pl-4 py-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold">{grade.material_title}</p>
                            <p className="text-sm text-gray-600">{grade.counselor_name}</p>
                            {grade.feedback && (
                              <p className="text-sm text-gray-700 mt-1 italic">"{grade.feedback}"</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg">
                              {grade.score}/{grade.max_score}
                            </p>
                            <p className="text-sm text-gray-600">{Math.round(grade.percentage)}%</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Schedules, Appointments and Sessions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
              <div className="card">
                <h2 className="text-2xl font-bold mb-4 flex items-center space-x-2">
                  <Clock className="w-6 h-6" />
                  <span>My Schedules</span>
                </h2>
                <div className="space-y-3">
                  {schedules.length === 0 ? (
                    <p className="text-gray-500 text-sm">No schedules yet</p>
                  ) : (
                    schedules.slice(0, 3).map((schedule) => (
                      <div key={schedule.id} className="border-l-4 border-blue-600 pl-4 py-2">
                        <p className="font-semibold text-sm">{schedule.counselor_name}</p>
                        <p className="text-xs text-gray-600">
                          {schedule.day_of_week} • {schedule.start_time} - {schedule.end_time}
                        </p>
                        <span className={`inline-block mt-1 px-2 py-1 rounded text-xs font-medium ${
                          schedule.status === 'accepted' || schedule.status === 'active' ? 'bg-green-100 text-green-800' :
                          schedule.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {schedule.status}
                        </span>
                      </div>
                    ))
                  )}
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    className="text-primary-600 text-sm font-medium hover:underline mt-2"
                  >
                    + Propose New Schedule
                  </button>
                </div>
              </div>

              <div className="card">
                <h2 className="text-2xl font-bold mb-4 flex items-center space-x-2">
                  <Calendar className="w-6 h-6" />
                  <span>My Appointments</span>
                </h2>
                <div className="space-y-3">
                  {appointments.slice(0, 3).map((apt) => (
                    <div key={apt.id} className="border-l-4 border-primary-600 pl-4 py-2">
                      <p className="font-semibold text-sm">{apt.counselor_name}</p>
                      <p className="text-xs text-gray-600">
                        {apt.appointment_date} at {apt.appointment_time}
                      </p>
                      <span className={`inline-block mt-1 px-2 py-1 rounded text-xs font-medium ${
                        apt.status === 'accepted' ? 'bg-green-100 text-green-800' :
                        apt.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {apt.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <h2 className="text-2xl font-bold mb-4 flex items-center space-x-2">
                  <MessageSquare className="w-6 h-6" />
                  <span>Live Sessions</span>
                </h2>
                <div className="space-y-3">
                  {sessions.slice(0, 5).map((session) => (
                    <div key={session.id} className="border rounded-lg p-3">
                      <p className="font-semibold">{session.session_title}</p>
                      <p className="text-sm text-gray-600">{session.counselor_name}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(session.start_time).toLocaleString()}
                      </p>
                      <span className={`inline-block mt-2 px-2 py-1 rounded text-xs ${
                        session.status === 'active' ? 'bg-green-100 text-green-800' :
                        session.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {session.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Available Counselors */}
            <div className="card mt-8">
              <h2 className="text-2xl font-bold mb-4 flex items-center space-x-2">
                <Users className="w-6 h-6" />
                <span>Available Counselors</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {counselors.slice(0, 6).map((counselor) => (
                  <div key={counselor.id} className="border rounded-lg p-4">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-12 h-12 bg-primary-200 rounded-full flex items-center justify-center">
                        {counselor.profile_image ? (
                          <img src={counselor.profile_image} alt={counselor.first_name} className="w-12 h-12 rounded-full" />
                        ) : (
                          <Users className="w-6 h-6 text-primary-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold">{counselor.first_name} {counselor.last_name}</p>
                        <p className="text-sm text-gray-600">{counselor.industry_specialty}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => bookAppointment(counselor.id)}
                      className="btn-primary w-full text-sm py-2"
                    >
                      Book Appointment
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Appointments Section */}
        {activeSection === 'appointments' && (
          <div className="space-y-6">
            {/* Schedules Section */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">My Counseling Schedules</h2>
                <button
                  onClick={() => setShowScheduleModal(true)}
                  className="btn-primary flex items-center space-x-2"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Propose Schedule</span>
                </button>
              </div>
              <div className="space-y-4">
                {schedules.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p>No schedules yet. Propose a schedule with your counselor!</p>
                  </div>
                ) : (
                  schedules.map((schedule) => (
                    <div key={schedule.id} className="border rounded-lg p-4 bg-white">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="font-semibold text-lg">{schedule.counselor_name}</h3>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              schedule.status === 'accepted' ? 'bg-green-100 text-green-800' :
                              schedule.status === 'active' ? 'bg-blue-100 text-blue-800' :
                              schedule.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {schedule.status}
                            </span>
                            {schedule.schedule_type === 'student_proposed' && (
                              <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                                You Proposed
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-4 mt-3">
                            <div>
                              <p className="text-sm font-medium text-gray-700">Day</p>
                              <p className="text-lg font-bold text-primary-600">{schedule.day_of_week}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-700">Time</p>
                              <p className="text-lg font-bold text-primary-600">
                                {schedule.start_time} - {schedule.end_time}
                              </p>
                            </div>
                          </div>
                          {schedule.notes && (
                            <p className="text-sm text-gray-600 mt-2 italic">"{schedule.notes}"</p>
                          )}
                          {schedule.rejection_reason && (
                            <p className="text-sm text-red-600 mt-2">Rejected: {schedule.rejection_reason}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Appointments Section */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">All Appointments</h2>
                {preSelectedCounselorId && (
                  <button
                    onClick={() => setShowBookingModal(true)}
                    className="btn-primary flex items-center space-x-2"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>Book Appointment</span>
                  </button>
                )}
              </div>
              <div className="space-y-4">
                {appointments.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p className="text-gray-500 mb-4">No appointments yet</p>
                    {preSelectedCounselorId && (
                      <button
                        onClick={() => setShowBookingModal(true)}
                        className="btn-primary"
                      >
                        Book Your First Appointment
                      </button>
                    )}
                  </div>
                ) : (
                  appointments.map((apt) => (
                    <div key={apt.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{apt.counselor_name}</h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {apt.counselor_specialty} • {apt.appointment_date} at {apt.appointment_time}
                          </p>
                          {apt.notes && (
                            <p className="text-sm text-gray-700 mt-2 italic">"{apt.notes}"</p>
                          )}
                        </div>
                        <span className={`px-3 py-1 rounded text-sm font-medium ${
                          apt.status === 'accepted' ? 'bg-green-100 text-green-800' :
                          apt.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          apt.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {apt.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Booking Modal */}
            {showBookingModal && selectedCounselor && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
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
                        setPreSelectedCounselorId(null);
                        setPreSelectedCareerId(null);
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  <div className="mb-4">
                    <p className="text-gray-600 mb-2">
                      <span className="font-medium">Counselor:</span> {selectedCounselor.first_name} {selectedCounselor.last_name}
                    </p>
                    <p className="text-gray-600 mb-2">
                      <span className="font-medium">Specialty:</span> {selectedCounselor.industry_specialty || 'General Counseling'}
                    </p>
                    {preSelectedCareerId && (
                      <p className="text-gray-600 mb-4">
                        <span className="font-medium">Career Interest:</span> {careers.find(c => c.id === parseInt(preSelectedCareerId))?.title || 'N/A'}
                      </p>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                      <input
                        type="date"
                        id="appointmentDate"
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                      <input
                        type="time"
                        id="appointmentTime"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                      <textarea
                        id="appointmentNotes"
                        rows={3}
                        placeholder="Any specific topics you'd like to discuss..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="flex space-x-3 mt-6">
                    <button
                      onClick={() => {
                        setShowBookingModal(false);
                        setSelectedCounselor(null);
                        setPreSelectedCounselorId(null);
                        setPreSelectedCareerId(null);
                      }}
                      className="btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        const date = document.getElementById('appointmentDate').value;
                        const time = document.getElementById('appointmentTime').value;
                        const notes = document.getElementById('appointmentNotes').value;
                        
                        if (!date || !time) {
                          toast.error('Please select both date and time');
                          return;
                        }
                        
                        try {
                          await api.post('/appointments', {
                            counselorId: selectedCounselor.id,
                            appointmentDate: date,
                            appointmentTime: time,
                            notes: notes || null
                          });
                          toast.success('Appointment requested successfully!');
                          setShowBookingModal(false);
                          setSelectedCounselor(null);
                          setPreSelectedCounselorId(null);
                          setPreSelectedCareerId(null);
                          fetchData();
                        } catch (error) {
                          toast.error(error.response?.data?.error || 'Failed to book appointment');
                        }
                      }}
                      className="btn-primary flex-1"
                    >
                      Book Appointment
                    </button>
                  </div>
                </motion.div>
              </div>
            )}

            {/* Schedule Modal */}
            {showScheduleModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold">Propose Schedule</h3>
                    <button
                      onClick={() => {
                        setShowScheduleModal(false);
                        setSelectedCounselor(null);
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  {selectedCounselor && (
                    <div className="mb-4">
                      <p className="text-gray-600">
                        <span className="font-medium">Counselor:</span> {selectedCounselor.first_name} {selectedCounselor.last_name}
                      </p>
                    </div>
                  )}
                  <div className="space-y-3">
                    {!selectedCounselor && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Select Counselor</label>
                        <select
                          id="scheduleCounselor"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="">Choose a counselor...</option>
                          {counselors.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.first_name} {c.last_name} - {c.industry_specialty}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Day of Week</label>
                      <select
                        id="scheduleDay"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="Monday">Monday</option>
                        <option value="Tuesday">Tuesday</option>
                        <option value="Wednesday">Wednesday</option>
                        <option value="Thursday">Thursday</option>
                        <option value="Friday">Friday</option>
                        <option value="Saturday">Saturday</option>
                        <option value="Sunday">Sunday</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                        <input
                          type="time"
                          id="scheduleStart"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                        <input
                          type="time"
                          id="scheduleEnd"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                      <textarea
                        id="scheduleNotes"
                        rows={3}
                        placeholder="Any additional information..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                  <div className="flex space-x-3 mt-6">
                    <button
                      onClick={() => {
                        setShowScheduleModal(false);
                        setSelectedCounselor(null);
                      }}
                      className="btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        const counselorId = selectedCounselor?.id || document.getElementById('scheduleCounselor').value;
                        const dayOfWeek = document.getElementById('scheduleDay').value;
                        const startTime = document.getElementById('scheduleStart').value;
                        const endTime = document.getElementById('scheduleEnd').value;
                        const notes = document.getElementById('scheduleNotes').value;
                        
                        if (!counselorId || !dayOfWeek || !startTime || !endTime) {
                          toast.error('Please fill in all required fields');
                          return;
                        }
                        
                        try {
                          await proposeSchedule(counselorId, dayOfWeek, startTime, endTime, notes || null);
                        } catch (error) {
                          // Error handled in proposeSchedule
                        }
                      }}
                      className="btn-primary flex-1"
                    >
                      Propose Schedule
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </div>
        )}

        {/* Learning Materials Section */}
        {activeSection === 'learning' && (
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-2xl font-bold mb-4">All Learning Materials</h2>
              <div className="space-y-4">
                {materials.length === 0 ? (
                  <p className="text-gray-500">No materials assigned yet</p>
                ) : (
                  materials.map((material) => (
                    <div key={material.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{material.title}</h3>
                          <p className="text-sm text-gray-600">
                            {material.material_type} from {material.counselor_name}
                          </p>
                          {material.content && (
                            <p className="text-sm text-gray-700 mt-2">{material.content}</p>
                          )}
                          {material.due_date && (
                            <p className="text-xs text-gray-500 mt-2">
                              Due: {new Date(material.due_date).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded">
                          {material.material_type}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          const content = prompt('Enter your submission:');
                          if (content) submitAssignment(material.id, content);
                        }}
                        className="btn-primary text-sm py-2 px-4"
                      >
                        Submit
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Grades Section */}
        {activeSection === 'grades' && (
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-2xl font-bold mb-4">All Grades</h2>
              <div className="space-y-4">
                {grades.length === 0 ? (
                  <p className="text-gray-500">No grades yet</p>
                ) : (
                  grades.map((grade) => (
                    <div key={grade.id} className="border-l-4 border-green-600 pl-4 py-3 bg-green-50 rounded">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{grade.material_title}</h3>
                          <p className="text-sm text-gray-600">{grade.counselor_name}</p>
                          {grade.feedback && (
                            <p className="text-sm text-gray-700 mt-2 italic">"{grade.feedback}"</p>
                          )}
                          <p className="text-xs text-gray-500 mt-2">
                            Graded: {new Date(grade.graded_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-2xl">
                            {grade.score}/{grade.max_score}
                          </p>
                          <p className="text-sm font-semibold text-green-600">{Math.round(grade.percentage)}%</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sessions Section */}
        {activeSection === 'sessions' && (
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-2xl font-bold mb-4">All Live Sessions</h2>
              <div className="space-y-4">
                {sessions.length === 0 ? (
                  <p className="text-gray-500">No sessions yet</p>
                ) : (
                  sessions.map((session) => (
                    <div key={session.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{session.session_title}</h3>
                          <p className="text-sm text-gray-600 mt-1">
                            Counselor: {session.counselor_name} • {session.counselor_specialty}
                          </p>
                          <p className="text-sm text-gray-600">
                            Start: {new Date(session.start_time).toLocaleString()}
                          </p>
                          {session.end_time && (
                            <p className="text-sm text-gray-600">
                              End: {new Date(session.end_time).toLocaleString()}
                            </p>
                          )}
                          {session.session_notes && (
                            <p className="text-sm text-gray-700 mt-2 italic">"{session.session_notes}"</p>
                          )}
                        </div>
                        <span className={`px-3 py-1 rounded text-sm font-medium ${
                          session.status === 'active' ? 'bg-green-100 text-green-800' :
                          session.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {session.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Calendar Section */}
        {activeSection === 'calendar' && (
          <CalendarView
            schedules={schedules}
            appointments={appointments}
            sessions={sessions}
            role="student"
            onSelectEvent={(event) => {
              const data = event.resource?.data;
              if (data) {
                if (event.resource.type === 'schedule') {
                  toast.info(`Schedule: ${data.day_of_week} ${data.start_time} - ${data.end_time}`);
                } else if (event.resource.type === 'appointment') {
                  toast.info(`Appointment: ${data.appointment_date} at ${data.appointment_time}`);
                } else if (event.resource.type === 'session') {
                  toast.info(`Session: ${data.session_title}`);
                }
              }
            }}
          />
        )}
      </div>

      {/* Schedule Proposal Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl p-6 w-full max-w-md"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Propose Schedule</h2>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const counselorId = formData.get('counselorId');
                const dayOfWeek = formData.get('dayOfWeek');
                const startTime = formData.get('startTime');
                const endTime = formData.get('endTime');
                const notes = formData.get('notes');
                if (counselorId && dayOfWeek && startTime && endTime) {
                  proposeSchedule(counselorId, dayOfWeek, startTime, endTime, notes);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Counselor *
                </label>
                <select
                  name="counselorId"
                  required
                  className="input-field w-full"
                >
                  <option value="">Choose a counselor</option>
                  {counselors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name} - {c.industry_specialty}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Day of Week *
                </label>
                <select
                  name="dayOfWeek"
                  required
                  className="input-field w-full"
                >
                  <option value="">Select day</option>
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    name="startTime"
                    required
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Time *
                  </label>
                  <input
                    type="time"
                    name="endTime"
                    required
                    className="input-field w-full"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  name="notes"
                  rows="3"
                  className="input-field w-full"
                  placeholder="Any additional information..."
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="btn-primary flex-1"
                >
                  Propose Schedule
                </button>
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      <Footer />
    </div>
  );
}
