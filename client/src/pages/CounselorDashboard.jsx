import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Sidebar from '../components/Sidebar';
import NotificationBell from '../components/NotificationBell';
import CalendarView from '../components/CalendarView';
import { Calendar, CheckCircle, XCircle, MessageSquare, User, FileText, Award, Plus, Users as UsersIcon, Clock, TrendingUp, X } from 'lucide-react';
import { motion } from 'framer-motion';

export default function CounselorDashboard() {
  const { user } = useAuth();
  const location = useLocation();
  const [appointments, setAppointments] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [reports, setReports] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [studentProgress, setStudentProgress] = useState([]);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [newMaterial, setNewMaterial] = useState({
    studentId: '',
    materialType: 'note',
    title: '',
    content: '',
    instructions: '',
    dueDate: '',
    points: 0,
  });
  const [loading, setLoading] = useState(true);

  // Determine active section from URL
  const getActiveSection = () => {
    const path = location.pathname;
    if (path.includes('/appointments')) return 'appointments';
    if (path.includes('/students')) return 'students';
    if (path.includes('/materials')) return 'materials';
    if (path.includes('/grading')) return 'grading';
    if (path.includes('/sessions')) return 'sessions';
    if (path.includes('/reports')) return 'reports';
    if (path.includes('/calendar')) return 'calendar';
    return 'dashboard';
  };

  const activeSection = getActiveSection();

  useEffect(() => {
    fetchData();
    // Real-time updates every 10 seconds
    const interval = setInterval(() => {
      fetchData();
      setLastUpdate(new Date());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [apptsRes, materialsRes, sessionsRes, studentsRes, schedulesRes, progressRes] = await Promise.all([
        api.get('/appointments/counselor'),
        api.get('/learning/materials/counselor'),
        api.get('/sessions/counselor'),
        api.get('/users/students/list'),
        api.get('/schedules/counselor'),
        api.get('/progress/all'),
      ]);
      setAppointments(apptsRes.data.appointments || []);
      setMaterials(materialsRes.data.materials || []);
      setSessions(sessionsRes.data.sessions || []);
      setStudents(studentsRes.data.students || []);
      setSchedules(schedulesRes.data.schedules || []);
      setStudentProgress(progressRes.data.students || []);

      // Get submissions for each material
      const submissionsData = [];
      for (const material of materialsRes.data.materials || []) {
        try {
          const subRes = await api.get(`/learning/submissions/${material.id}`);
          submissionsData.push(...(subRes.data.submissions || []));
        } catch (error) {
          console.error(`Failed to fetch submissions for material ${material.id}`);
        }
      }
      setSubmissions(submissionsData);

      // Get reports
      try {
        const reportsRes = await api.get('/reports/counselor');
        setReports(reportsRes.data.reports || []);
      } catch (error) {
        console.error('Failed to fetch reports');
      }
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const createMaterial = async (e) => {
    e.preventDefault();
    try {
      await api.post('/learning/materials', newMaterial);
      toast.success('Material created!');
      setShowMaterialForm(false);
      setNewMaterial({
        studentId: '',
        materialType: 'note',
        title: '',
        content: '',
        instructions: '',
        dueDate: '',
        points: 0,
      });
      fetchData();
    } catch (error) {
      toast.error('Failed to create material');
    }
  };

  const gradeSubmission = async (submissionId, score, maxScore, feedback) => {
    try {
      await api.post('/learning/grade', { submissionId, score, maxScore, feedback });
      toast.success('Grade submitted!');
      fetchData();
    } catch (error) {
      toast.error('Failed to grade submission');
    }
  };

  const updateAppointmentStatus = async (appointmentId, status, rejectionReason = null) => {
    try {
      await api.patch(`/appointments/${appointmentId}/status`, { status, rejectionReason });
      toast.success(`Appointment ${status}`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update appointment');
    }
  };

  const createReport = async (studentId, title, content, reportType, isUrgent) => {
    try {
      await api.post('/reports', {
        studentId,
        title,
        content,
        reportType: reportType || 'progress',
        isUrgent: isUrgent || false,
      });
      toast.success('Report submitted!');
      fetchData();
    } catch (error) {
      toast.error('Failed to submit report');
    }
  };

  const createSchedule = async (studentId, dayOfWeek, startTime, endTime, notes) => {
    try {
      await api.post('/schedules/counselor/create', {
        studentId,
        dayOfWeek,
        startTime,
        endTime,
        notes
      });
      toast.success('Schedule created! Student will be notified.');
      setShowScheduleModal(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create schedule');
    }
  };

  const acceptSchedule = async (scheduleId) => {
    try {
      await api.patch(`/schedules/${scheduleId}/accept`);
      toast.success('Schedule accepted!');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to accept schedule');
    }
  };

  const rejectSchedule = async (scheduleId, rejectionReason) => {
    try {
      await api.patch(`/schedules/${scheduleId}/reject`, { rejectionReason });
      toast.success('Schedule rejected');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to reject schedule');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const pendingAppointments = appointments.filter(apt => apt.status === 'pending');
  const pendingSubmissions = submissions.filter(sub => sub.status === 'submitted');

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <Sidebar role="counselor" />
      
      <div className="ml-64 p-8">
        {/* Welcome Section - Only on dashboard */}
        {activeSection === 'dashboard' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-blue-600 to-primary-600 text-white rounded-xl p-6 mb-8"
          >
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Welcome, {user?.first_name}!</h1>
                <p className="text-white/90">
                  {user?.industry_specialty} • {user?.county} County
                </p>
              </div>
              <NotificationBell />
            </div>
          </motion.div>
        )}

        {/* Section Headers */}
        {activeSection !== 'dashboard' && (
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {activeSection === 'appointments' && 'Appointments'}
              {activeSection === 'students' && 'My Students'}
              {activeSection === 'materials' && 'Learning Materials'}
              {activeSection === 'grading' && 'Grading'}
              {activeSection === 'sessions' && 'Live Sessions'}
              {activeSection === 'reports' && 'Reports'}
            </h1>
            <p className="text-gray-600">
              {activeSection === 'appointments' && 'Manage appointment requests and scheduled sessions'}
              {activeSection === 'students' && 'View all your students and their progress'}
              {activeSection === 'materials' && 'Create and manage learning materials'}
              {activeSection === 'grading' && 'Grade student submissions'}
              {activeSection === 'sessions' && 'View and manage live counseling sessions'}
              {activeSection === 'reports' && 'Submit progress reports to admin'}
              {activeSection === 'calendar' && 'View all schedules, appointments, and sessions on calendar'}
            </p>
          </div>
        )}

        {/* Dashboard View */}
        {activeSection === 'dashboard' && (
          <>
            {/* Real-time Indicator */}
            <div className="mb-4 flex items-center space-x-2 text-sm text-gray-600">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span>Live Updates • Last updated: {lastUpdate.toLocaleTimeString()}</span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
              <div className="card">
                <div className="flex items-center space-x-3">
                  <div className="bg-yellow-100 p-3 rounded-lg">
                    <Calendar className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{pendingAppointments.length}</p>
                    <p className="text-sm text-gray-600">Pending Requests</p>
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="flex items-center space-x-3">
                  <div className="bg-indigo-100 p-3 rounded-lg">
                    <Clock className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{schedules.filter(s => s.status === 'pending').length}</p>
                    <p className="text-sm text-gray-600">Pending Schedules</p>
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{materials.length}</p>
                    <p className="text-sm text-gray-600">Materials Created</p>
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="flex items-center space-x-3">
                  <div className="bg-green-100 p-3 rounded-lg">
                    <Award className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{pendingSubmissions.length}</p>
                    <p className="text-sm text-gray-600">Pending Grading</p>
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="flex items-center space-x-3">
                  <div className="bg-purple-100 p-3 rounded-lg">
                    <MessageSquare className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{sessions.length}</p>
                    <p className="text-sm text-gray-600">Live Sessions</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Create Material Button */}
            <div className="mb-6">
              <button
                onClick={() => setShowMaterialForm(!showMaterialForm)}
                className="btn-primary flex items-center space-x-2"
              >
                <Plus className="w-5 h-5" />
                <span>Create Learning Material</span>
              </button>
            </div>

            {/* Material Form */}
            {showMaterialForm && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="card mb-8"
              >
                <form onSubmit={createMaterial} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Material Type</label>
                      <select
                        value={newMaterial.materialType}
                        onChange={(e) => setNewMaterial({ ...newMaterial, materialType: e.target.value })}
                        className="input-field"
                      >
                        <option value="note">Note</option>
                        <option value="assignment">Assignment</option>
                        <option value="quiz">Quiz</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Student (Optional - leave blank for all)</label>
                      <select
                        value={newMaterial.studentId}
                        onChange={(e) => setNewMaterial({ ...newMaterial, studentId: e.target.value })}
                        className="input-field"
                      >
                        <option value="">All Students</option>
                        {students.map((s) => (
                          <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Title *</label>
                    <input
                      type="text"
                      value={newMaterial.title}
                      onChange={(e) => setNewMaterial({ ...newMaterial, title: e.target.value })}
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Content</label>
                    <textarea
                      value={newMaterial.content}
                      onChange={(e) => setNewMaterial({ ...newMaterial, content: e.target.value })}
                      className="input-field"
                      rows="4"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Due Date</label>
                      <input
                        type="datetime-local"
                        value={newMaterial.dueDate}
                        onChange={(e) => setNewMaterial({ ...newMaterial, dueDate: e.target.value })}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Points</label>
                      <input
                        type="number"
                        value={newMaterial.points}
                        onChange={(e) => setNewMaterial({ ...newMaterial, points: parseInt(e.target.value) })}
                        className="input-field"
                      />
                    </div>
                  </div>
                  <div className="flex space-x-4">
                    <button type="submit" className="btn-primary">Create Material</button>
                    <button
                      type="button"
                      onClick={() => setShowMaterialForm(false)}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* Pending Appointments */}
            {pendingAppointments.length > 0 && (
              <div className="card mb-8">
                <h2 className="text-2xl font-bold mb-4">Pending Appointment Requests</h2>
                <div className="space-y-4">
                  {pendingAppointments.map((apt) => (
                    <div key={apt.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-semibold text-lg">{apt.student_name}</p>
                          <p className="text-sm text-gray-600">
                            {apt.school_name} • Grade {apt.grade_level}
                          </p>
                          <p className="text-sm text-gray-600 mt-2">
                            <Calendar className="w-4 h-4 inline mr-1" />
                            {apt.appointment_date} at {apt.appointment_time}
                          </p>
                          {apt.notes && (
                            <p className="text-sm text-gray-700 mt-2 italic">"{apt.notes}"</p>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => updateAppointmentStatus(apt.id, 'accepted')}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span>Accept</span>
                          </button>
                          <button
                            onClick={() => {
                              const reason = prompt('Rejection reason (optional):');
                              updateAppointmentStatus(apt.id, 'rejected', reason);
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending Submissions */}
            {pendingSubmissions.length > 0 && (
              <div className="card mb-8">
                <h2 className="text-2xl font-bold mb-4">Pending Submissions to Grade</h2>
                <div className="space-y-4">
                  {pendingSubmissions.slice(0, 3).map((submission) => {
                    const material = materials.find(m => m.id === submission.material_id);
                    return (
                      <div key={submission.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="font-semibold">{submission.student_name}</p>
                            <p className="text-sm text-gray-600">{material?.title}</p>
                          </div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded mb-3">
                          <p className="text-sm">{submission.submission_content}</p>
                        </div>
                        <button
                          onClick={() => {
                            const score = prompt('Enter score:');
                            const maxScore = prompt('Enter max score:', material?.points || 100);
                            const feedback = prompt('Enter feedback (optional):');
                            if (score) {
                              gradeSubmission(submission.id, parseFloat(score), parseFloat(maxScore) || 100, feedback);
                            }
                          }}
                          className="btn-primary"
                        >
                          Grade
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Appointments Section */}
        {activeSection === 'appointments' && (
          <div className="space-y-6">
            {/* Schedules Section */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">Counseling Schedules</h2>
                <button
                  onClick={() => setShowScheduleModal(true)}
                  className="btn-primary flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Schedule</span>
                </button>
              </div>
              <div className="mb-4 flex items-center space-x-2 text-sm text-gray-600">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span>Live • Last updated: {lastUpdate.toLocaleTimeString()}</span>
              </div>
              <div className="space-y-4">
                {schedules.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p>No schedules yet. Create a schedule for your students!</p>
                  </div>
                ) : (
                  schedules.map((schedule) => (
                    <div key={schedule.id} className="border rounded-lg p-4 bg-white">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="font-semibold text-lg">{schedule.student_name}</h3>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              schedule.status === 'accepted' || schedule.status === 'active' ? 'bg-green-100 text-green-800' :
                              schedule.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {schedule.status}
                            </span>
                            {schedule.schedule_type === 'student_proposed' && (
                              <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                                Student Proposed
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
                        {schedule.status === 'pending' && schedule.schedule_type === 'student_proposed' && (
                          <div className="flex flex-col space-y-2 ml-4">
                            <button
                              onClick={() => acceptSchedule(schedule.id)}
                              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => {
                                const reason = prompt('Rejection reason (optional):');
                                rejectSchedule(schedule.id, reason);
                              }}
                              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-medium"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Appointments Section */}
            <div className="card">
              <h2 className="text-2xl font-bold mb-4">All Appointments</h2>
              <div className="space-y-4">
                {appointments.length === 0 ? (
                  <p className="text-gray-500">No appointments</p>
                ) : (
                  appointments.map((apt) => (
                    <div key={apt.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-semibold text-lg">{apt.student_name}</p>
                          <p className="text-sm text-gray-600">
                            {apt.school_name} • Grade {apt.grade_level}
                          </p>
                          <p className="text-sm text-gray-600 mt-2">
                            {apt.appointment_date} at {apt.appointment_time}
                          </p>
                          {apt.notes && (
                            <p className="text-sm text-gray-700 mt-2 italic">"{apt.notes}"</p>
                          )}
                        </div>
                        <div className="flex flex-col space-y-2">
                          <span className={`px-3 py-1 rounded text-sm font-medium ${
                            apt.status === 'accepted' ? 'bg-green-100 text-green-800' :
                            apt.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            apt.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {apt.status}
                          </span>
                          {apt.status === 'pending' && (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => updateAppointmentStatus(apt.id, 'accepted')}
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => {
                                  const reason = prompt('Rejection reason:');
                                  updateAppointmentStatus(apt.id, 'rejected', reason);
                                }}
                                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Students Section */}
        {activeSection === 'students' && (
          <div className="card">
            <h2 className="text-2xl font-bold mb-4">My Students</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {students.map((student) => (
                <div key={student.id} className="border rounded-lg p-4">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-12 h-12 bg-primary-200 rounded-full flex items-center justify-center">
                      {student.profile_image ? (
                        <img src={student.profile_image} alt={student.first_name} className="w-12 h-12 rounded-full" />
                      ) : (
                        <User className="w-6 h-6 text-primary-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold">{student.first_name} {student.last_name}</p>
                      <p className="text-sm text-gray-600">{student.school_name}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">Grade {student.grade_level} • {student.county}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Materials Section */}
        {activeSection === 'materials' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Learning Materials</h2>
              <button
                onClick={() => setShowMaterialForm(!showMaterialForm)}
                className="btn-primary flex items-center space-x-2"
              >
                <Plus className="w-5 h-5" />
                <span>Create New</span>
              </button>
            </div>

            {showMaterialForm && (
              <div className="card">
                <form onSubmit={createMaterial} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Material Type</label>
                      <select
                        value={newMaterial.materialType}
                        onChange={(e) => setNewMaterial({ ...newMaterial, materialType: e.target.value })}
                        className="input-field"
                      >
                        <option value="note">Note</option>
                        <option value="assignment">Assignment</option>
                        <option value="quiz">Quiz</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Student (Optional)</label>
                      <select
                        value={newMaterial.studentId}
                        onChange={(e) => setNewMaterial({ ...newMaterial, studentId: e.target.value })}
                        className="input-field"
                      >
                        <option value="">All Students</option>
                        {students.map((s) => (
                          <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Title *</label>
                    <input
                      type="text"
                      value={newMaterial.title}
                      onChange={(e) => setNewMaterial({ ...newMaterial, title: e.target.value })}
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Content</label>
                    <textarea
                      value={newMaterial.content}
                      onChange={(e) => setNewMaterial({ ...newMaterial, content: e.target.value })}
                      className="input-field"
                      rows="4"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Due Date</label>
                      <input
                        type="datetime-local"
                        value={newMaterial.dueDate}
                        onChange={(e) => setNewMaterial({ ...newMaterial, dueDate: e.target.value })}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Points</label>
                      <input
                        type="number"
                        value={newMaterial.points}
                        onChange={(e) => setNewMaterial({ ...newMaterial, points: parseInt(e.target.value) })}
                        className="input-field"
                      />
                    </div>
                  </div>
                  <div className="flex space-x-4">
                    <button type="submit" className="btn-primary">Create Material</button>
                    <button
                      type="button"
                      onClick={() => setShowMaterialForm(false)}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="card">
              <div className="space-y-4">
                {materials.length === 0 ? (
                  <p className="text-gray-500">No materials created yet</p>
                ) : (
                  materials.map((material) => (
                    <div key={material.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-lg">{material.title}</h3>
                          <p className="text-sm text-gray-600">
                            {material.material_type} • {material.student_name || 'All Students'}
                          </p>
                          {material.due_date && (
                            <p className="text-xs text-gray-500 mt-1">
                              Due: {new Date(material.due_date).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded">
                          {material.material_type}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Grading Section */}
        {activeSection === 'grading' && (
          <div className="card">
            <h2 className="text-2xl font-bold mb-4">Pending Submissions to Grade</h2>
            <div className="space-y-4">
              {pendingSubmissions.length === 0 ? (
                <p className="text-gray-500">No pending submissions</p>
              ) : (
                pendingSubmissions.map((submission) => {
                  const material = materials.find(m => m.id === submission.material_id);
                  return (
                    <div key={submission.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-semibold text-lg">{submission.student_name}</p>
                          <p className="text-sm text-gray-600">{material?.title}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Submitted: {new Date(submission.submitted_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded mb-3">
                        <p className="text-sm whitespace-pre-wrap">{submission.submission_content}</p>
                      </div>
                      <div className="flex space-x-2">
                        <input
                          type="number"
                          placeholder="Score"
                          className="input-field w-24"
                          id={`score-${submission.id}`}
                        />
                        <input
                          type="number"
                          placeholder="Max Score"
                          className="input-field w-24"
                          id={`max-${submission.id}`}
                          defaultValue={material?.points || 100}
                        />
                        <input
                          type="text"
                          placeholder="Feedback"
                          className="input-field flex-1"
                          id={`feedback-${submission.id}`}
                        />
                        <button
                          onClick={() => {
                            const score = document.getElementById(`score-${submission.id}`).value;
                            const maxScore = document.getElementById(`max-${submission.id}`).value;
                            const feedback = document.getElementById(`feedback-${submission.id}`).value;
                            if (score) {
                              gradeSubmission(submission.id, parseFloat(score), parseFloat(maxScore) || 100, feedback);
                            }
                          }}
                          className="btn-primary"
                        >
                          Grade
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Sessions Section */}
        {activeSection === 'sessions' && (
          <div className="card">
            <h2 className="text-2xl font-bold mb-4">Live Sessions</h2>
            <div className="space-y-4">
              {sessions.length === 0 ? (
                <p className="text-gray-500">No sessions yet</p>
              ) : (
                sessions.map((session) => (
                  <div key={session.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{session.session_title}</h3>
                        <p className="text-sm text-gray-600">
                          Student: {session.student_name} • {session.school_name}
                        </p>
                        <p className="text-sm text-gray-600">
                          {new Date(session.start_time).toLocaleString()}
                        </p>
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
        )}

        {/* Reports Section */}
        {activeSection === 'reports' && (
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-2xl font-bold mb-4">Submit Report</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const studentId = e.target.studentId.value;
                  const title = e.target.title.value;
                  const content = e.target.content.value;
                  const reportType = e.target.reportType.value;
                  const isUrgent = e.target.isUrgent.checked;
                  if (studentId && title && content) {
                    createReport(studentId, title, content, reportType, isUrgent);
                    e.target.reset();
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium mb-2">Student *</label>
                  <select name="studentId" className="input-field" required>
                    <option value="">Select Student</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Report Type</label>
                  <select name="reportType" className="input-field">
                    <option value="progress">Progress</option>
                    <option value="concern">Concern</option>
                    <option value="achievement">Achievement</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Title *</label>
                  <input type="text" name="title" className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Content *</label>
                  <textarea name="content" className="input-field" rows="6" required />
                </div>
                <div>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" name="isUrgent" />
                    <span className="text-sm font-medium">Mark as Urgent</span>
                  </label>
                </div>
                <button type="submit" className="btn-primary">Submit Report</button>
              </form>
            </div>

            <div className="card">
              <h2 className="text-2xl font-bold mb-4">Previous Reports</h2>
              <div className="space-y-4">
                {reports.length === 0 ? (
                  <p className="text-gray-500">No reports submitted yet</p>
                ) : (
                  reports.map((report) => (
                    <div
                      key={report.id}
                      className={`border rounded-lg p-4 ${
                        report.is_urgent ? 'border-red-500 bg-red-50' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold text-lg">{report.title}</h3>
                          <p className="text-sm text-gray-600">
                            Student: {report.student_name} • Type: {report.report_type}
                          </p>
                          {report.is_urgent && (
                            <span className="inline-block mt-2 px-2 py-1 bg-red-500 text-white text-xs rounded">
                              URGENT
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(report.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-gray-700">{report.content}</p>
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
            role="counselor"
            onSelectEvent={(event) => {
              const data = event.resource?.data;
              if (data) {
                if (event.resource.type === 'schedule') {
                  toast.info(`Schedule: ${data.day_of_week} ${data.start_time} - ${data.end_time} with ${data.student_name}`);
                } else if (event.resource.type === 'appointment') {
                  toast.info(`Appointment: ${data.appointment_date} at ${data.appointment_time} with ${data.student_name}`);
                } else if (event.resource.type === 'session') {
                  toast.info(`Session: ${data.session_title} with ${data.student_name}`);
                }
              }
            }}
          />
        )}
      </div>

      {/* Schedule Creation Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl p-6 w-full max-w-md"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Create Schedule</h2>
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
                const studentId = formData.get('studentId');
                const dayOfWeek = formData.get('dayOfWeek');
                const startTime = formData.get('startTime');
                const endTime = formData.get('endTime');
                const notes = formData.get('notes');
                if (studentId && dayOfWeek && startTime && endTime) {
                  createSchedule(studentId, dayOfWeek, startTime, endTime, notes);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Student *
                </label>
                <select
                  name="studentId"
                  required
                  className="input-field w-full"
                >
                  <option value="">Choose a student</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.first_name} {s.last_name} - {s.school_name}
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
                  Create Schedule
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
