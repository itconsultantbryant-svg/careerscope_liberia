import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Sidebar from '../components/Sidebar';
import NotificationBell from '../components/NotificationBell';
import CalendarView from '../components/CalendarView';
import {
  Users,
  CheckCircle,
  XCircle,
  BarChart3,
  BookOpen,
  FileText,
  MessageSquare,
  AlertCircle,
  Calendar,
  Award,
  TrendingUp,
  Activity,
  UserCheck,
  Clock,
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [users, setUsers] = useState([]);
  const [students, setStudents] = useState([]);
  const [counselors, setCounselors] = useState([]);
  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [careers, setCareers] = useState([]);
  const [progress, setProgress] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  
  // Determine active tab from URL
  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes('/appointments')) return 'appointments';
    if (path.includes('/students')) return 'students';
    if (path.includes('/counselors')) return 'counselors';
    if (path.includes('/users')) return 'users';
    if (path.includes('/reports')) return 'reports';
    if (path.includes('/sessions')) return 'sessions';
    if (path.includes('/schedules')) return 'schedules';
    if (path.includes('/calendar')) return 'calendar';
    if (path.includes('/careers')) return 'careers';
    if (path.includes('/analytics')) return 'overview';
    return 'overview';
  };
  
  const [activeTab, setActiveTab] = useState(getActiveTab());
  
  useEffect(() => {
    setActiveTab(getActiveTab());
  }, [location.pathname]);

  useEffect(() => {
    if (!authLoading && user) {
      if (user.role !== 'admin') {
        toast.error('Access denied. Admin privileges required.');
        return;
      }
      fetchData();
      // Real-time updates every 10 seconds
      const interval = setInterval(() => {
        fetchData();
        setLastUpdate(new Date());
      }, 10000);
      return () => clearInterval(interval);
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [user, authLoading]);

  const fetchData = async () => {
    try {
      const [
        usersRes,
        statsRes,
        reportsRes,
        sessionsRes,
        careersRes,
        progressRes,
        schedulesRes,
        appointmentsRes,
      ] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/analytics'),
        api.get('/reports/all'),
        api.get('/sessions/all'),
        api.get('/careers'),
        api.get('/progress/all'),
        api.get('/schedules/all'),
        api.get('/appointments/all'),
      ]);
      const fetchedUsers = usersRes.data.users || [];
      setUsers(fetchedUsers);
      setStats(statsRes.data.stats || null);
      setReports(reportsRes.data.reports || []);
      setSessions(sessionsRes.data.sessions || []);
      setCareers(careersRes.data.careers || []);
      setProgress(progressRes.data.students || []);
      setSchedules(schedulesRes.data.schedules || []);
      setAppointments(appointmentsRes.data.appointments || []);

      // Separate students and counselors
      setStudents(fetchedUsers.filter(u => u.role === 'student'));
      setCounselors(fetchedUsers.filter(u => u.role === 'counselor'));
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to load data';
      toast.error(errorMessage);
      console.error('Admin dashboard error:', error.response?.data || error);
    } finally {
      setLoading(false);
    }
  };

  const approveCounselor = async (counselorId, isApproved) => {
    try {
      await api.patch(`/admin/counselors/${counselorId}/approve`, { isApproved });
      toast.success(`Counselor ${isApproved ? 'approved' : 'rejected'}`);
      fetchData();
    } catch (error) {
      toast.error('Failed to update counselor');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">You need admin privileges to access this page.</p>
          <a href="/login" className="btn-primary">Go to Login</a>
        </div>
      </div>
    );
  }

  const pendingCounselors = counselors.filter(c => !c.is_approved);
  const approvedCounselorsCount = counselors.filter(c => c.is_approved).length;
  const pendingCounselorsCount = pendingCounselors.length;
  const activeSessions = sessions.filter(s => s.status === 'active');
  const urgentReports = reports.filter(r => r.is_urgent && !r.admin_viewed);
  const recentUsers = users.slice(0, 5);
  const recentAppointments = appointments.slice(0, 5);
  const recentReports = reports.slice(0, 5);
  const completedAppointmentsCount = appointments.filter(a => a.status === 'completed').length;
  const pendingAppointmentsCount = appointments.filter(a => a.status === 'pending').length;
  const activeSchedulesCount = schedules.filter(
    s => s.status === 'accepted' || s.status === 'active'
  ).length;
  const approvalRate = counselors.length
    ? Math.round((approvedCounselorsCount / counselors.length) * 100)
    : 0;
  const appointmentCompletionRate = appointments.length
    ? Math.round((completedAppointmentsCount / appointments.length) * 100)
    : 0;
  const urgentReportRate = reports.length
    ? Math.round((urgentReports.length / reports.length) * 100)
    : 0;
  const countyCounts = users.reduce((acc, user) => {
    if (!user.county) return acc;
    acc[user.county] = (acc[user.county] || 0) + 1;
    return acc;
  }, {});
  const topCounties = Object.entries(countyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <Sidebar role="admin" />
      
      <div className="ml-64 p-8">
        {/* Real-time Indicator */}
        <div className="mb-4 flex items-center space-x-2 text-sm text-gray-600">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span>Live Monitoring • Last updated: {lastUpdate.toLocaleTimeString()}</span>
        </div>

        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-gold-600 to-primary-600 text-white rounded-xl p-6 mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
              <p className="text-white/90">Comprehensive system overview and management</p>
            </div>
            <NotificationBell />
          </div>
        </motion.div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card"
          >
            <div className="flex items-center space-x-4">
              <div className="bg-primary-100 p-4 rounded-lg">
                <Users className="w-8 h-8 text-primary-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">{stats?.totalUsers || 0}</p>
                <p className="text-gray-600">Total Users</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card"
          >
            <div className="flex items-center space-x-4">
              <div className="bg-blue-100 p-4 rounded-lg">
                <UserCheck className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">{stats?.totalStudents || 0}</p>
                <p className="text-gray-600">Students</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card"
          >
            <div className="flex items-center space-x-4">
              <div className="bg-green-100 p-4 rounded-lg">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">{stats?.totalCounselors || 0}</p>
                <p className="text-gray-600">Counselors</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="card"
          >
            <div className="flex items-center space-x-4">
              <div className="bg-purple-100 p-4 rounded-lg">
                <Calendar className="w-8 h-8 text-purple-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">{stats?.totalAppointments || 0}</p>
                <p className="text-gray-600">Appointments</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="card"
          >
            <div className="flex items-center space-x-4">
              <div className="bg-yellow-100 p-4 rounded-lg">
                <MessageSquare className="w-8 h-8 text-yellow-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">{sessions.length}</p>
                <p className="text-gray-600">Live Sessions</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="card"
          >
            <div className="flex items-center space-x-4">
              <div className="bg-red-100 p-4 rounded-lg">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">{urgentReports.length}</p>
                <p className="text-gray-600">Urgent Reports</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="card"
          >
            <div className="flex items-center space-x-4">
              <div className="bg-indigo-100 p-4 rounded-lg">
                <FileText className="w-8 h-8 text-indigo-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">{reports.length}</p>
                <p className="text-gray-600">Total Reports</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="card"
          >
            <div className="flex items-center space-x-4">
              <div className="bg-teal-100 p-4 rounded-lg">
                <TrendingUp className="w-8 h-8 text-teal-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">{stats?.activeCounties || 0}</p>
                <p className="text-gray-600">Active Counties</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="card"
          >
            <div className="flex items-center space-x-4">
              <div className="bg-violet-100 p-4 rounded-lg">
                <Clock className="w-8 h-8 text-violet-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">{activeSchedulesCount}</p>
                <p className="text-gray-600">Active Schedules</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex space-x-2 border-b overflow-x-auto">
            {[
              { id: 'overview', label: 'Overview', path: '/admin/dashboard' },
              { id: 'users', label: 'Users', path: '/admin/users' },
              { id: 'appointments', label: 'Appointments', path: '/admin/appointments' },
              { id: 'schedules', label: 'Schedules', path: '/admin/schedules' },
              { id: 'calendar', label: 'Calendar', path: '/admin/calendar' },
              { id: 'reports', label: 'Reports', path: '/admin/reports' },
              { id: 'sessions', label: 'Sessions', path: '/admin/sessions' },
              { id: 'careers', label: 'Careers', path: '/admin/careers' },
            ].map((tab) => (
              <Link
                key={tab.id}
                to={tab.path}
                className={`px-6 py-3 font-medium capitalize transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-primary-600 border-b-2 border-primary-600'
                    : 'text-gray-600 hover:text-primary-600'
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="space-y-6">
                {/* Pending Counselors */}
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold flex items-center space-x-2">
                      <AlertCircle className="w-6 h-6 text-yellow-600" />
                      <span>Pending Counselor Approvals</span>
                    </h2>
                    <span className="text-sm text-gray-500">{pendingCounselorsCount} pending</span>
                  </div>
                  {pendingCounselors.length === 0 ? (
                    <p className="text-sm text-gray-500">No pending counselor approvals right now.</p>
                  ) : (
                    <div className="space-y-4">
                      {pendingCounselors.map((counselor) => (
                        <div key={counselor.id} className="border rounded-lg p-4">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <p className="font-semibold text-lg">
                                {counselor.first_name} {counselor.last_name}
                              </p>
                              <p className="text-sm text-gray-600">{counselor.county} County</p>
                              <p className="text-sm text-gray-600">{counselor.phone}</p>
                              {counselor.email && (
                                <p className="text-sm text-gray-600">{counselor.email}</p>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => approveCounselor(counselor.id, true)}
                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                              >
                                <CheckCircle className="w-4 h-4" />
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => approveCounselor(counselor.id, false)}
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
                  )}
                </div>

                {/* Urgent Reports */}
                {urgentReports.length > 0 && (
                  <div className="card">
                    <h2 className="text-2xl font-bold mb-4 flex items-center space-x-2">
                      <AlertCircle className="w-6 h-6 text-red-600" />
                      <span>Urgent Reports</span>
                    </h2>
                    <div className="space-y-4">
                      {urgentReports.map((report) => (
                        <div
                          key={report.id}
                          className="border-l-4 border-red-500 bg-red-50 rounded-lg p-4"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h3 className="font-semibold text-lg">{report.title}</h3>
                              <p className="text-sm text-gray-600">
                                From: {report.counselor_name} • Student: {report.student_name}
                              </p>
                            </div>
                            <span className="text-xs text-gray-500">
                              {new Date(report.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-gray-700">{report.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active Sessions */}
                {activeSessions.length > 0 && (
                  <div className="card">
                    <h2 className="text-2xl font-bold mb-4">Active Live Sessions</h2>
                    <div className="space-y-3">
                      {activeSessions.map((session) => (
                        <div key={session.id} className="border rounded-lg p-4 bg-green-50">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold">{session.session_title}</p>
                              <p className="text-sm text-gray-600">
                                {session.student_name} with {session.counselor_name}
                              </p>
                              <p className="text-xs text-gray-500">
                                Started: {new Date(session.start_time).toLocaleString()}
                              </p>
                            </div>
                            <span className="px-3 py-1 bg-green-500 text-white text-sm rounded-full">
                              Active
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Admin Quick Actions */}
                <div className="card">
                  <h2 className="text-2xl font-bold mb-4">Admin Quick Actions</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { label: 'Review Users', path: '/admin/users' },
                      { label: 'Manage Appointments', path: '/admin/appointments' },
                      { label: 'Check Schedules', path: '/admin/schedules' },
                      { label: 'View Reports', path: '/admin/reports' },
                      { label: 'Live Sessions', path: '/admin/sessions' },
                      { label: 'Careers Library', path: '/admin/careers' },
                    ].map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        className="border rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:border-primary-600 hover:text-primary-700 transition-colors"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {/* System Snapshot */}
                <div className="card">
                  <h2 className="text-2xl font-bold mb-4">System Snapshot</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600">
                    <div className="border rounded-lg p-3">
                      <p className="text-xs uppercase tracking-wide text-gray-400">Users</p>
                      <p className="text-lg font-semibold text-gray-900">{users.length}</p>
                      <p className="text-xs text-gray-500">Students: {students.length} • Counselors: {counselors.length}</p>
                    </div>
                    <div className="border rounded-lg p-3">
                      <p className="text-xs uppercase tracking-wide text-gray-400">Approvals</p>
                      <p className="text-lg font-semibold text-gray-900">{approvedCounselorsCount}</p>
                      <p className="text-xs text-gray-500">Pending: {pendingCounselorsCount}</p>
                    </div>
                    <div className="border rounded-lg p-3">
                      <p className="text-xs uppercase tracking-wide text-gray-400">Appointments</p>
                      <p className="text-lg font-semibold text-gray-900">{appointments.length}</p>
                      <p className="text-xs text-gray-500">Pending: {pendingAppointmentsCount} • Completed: {completedAppointmentsCount}</p>
                    </div>
                    <div className="border rounded-lg p-3">
                      <p className="text-xs uppercase tracking-wide text-gray-400">Reports</p>
                      <p className="text-lg font-semibold text-gray-900">{reports.length}</p>
                      <p className="text-xs text-gray-500">Urgent: {urgentReports.length}</p>
                    </div>
                  </div>
                </div>

                {/* Operational Health */}
                <div className="card">
                  <h2 className="text-2xl font-bold mb-4">Operational Health</h2>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                        <span>Counselor approvals</span>
                        <span>{approvalRate}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: `${approvalRate}%` }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                        <span>Appointments completed</span>
                        <span>{appointmentCompletionRate}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${appointmentCompletionRate}%` }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                        <span>Urgent report share</span>
                        <span>{urgentReportRate}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-red-500 h-2 rounded-full" style={{ width: `${urgentReportRate}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top Counties */}
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold">Top Counties</h2>
                    <span className="text-sm text-gray-500">User distribution</span>
                  </div>
                  {topCounties.length === 0 ? (
                    <p className="text-sm text-gray-500">No county data available.</p>
                  ) : (
                    <div className="space-y-3">
                      {topCounties.map(([county, count]) => (
                        <div key={county} className="flex items-center justify-between border rounded-lg p-3">
                          <p className="font-semibold">{county}</p>
                          <span className="text-sm text-gray-600">{count} users</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Users */}
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold">Recent Users</h2>
                    <span className="text-sm text-gray-500">Latest signups</span>
                  </div>
                  {recentUsers.length === 0 ? (
                    <p className="text-sm text-gray-500">No new users yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {recentUsers.map((recentUser) => (
                        <div key={recentUser.id} className="flex items-center justify-between border rounded-lg p-3">
                          <div>
                            <p className="font-semibold">
                              {recentUser.first_name} {recentUser.last_name}
                            </p>
                            <p className="text-sm text-gray-600">{recentUser.email || recentUser.phone || 'No contact'}</p>
                          </div>
                          <div className="text-right">
                            <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded capitalize">
                              {recentUser.role}
                            </span>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(recentUser.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Appointments */}
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold">Recent Appointments</h2>
                    <span className="text-sm text-gray-500">Latest 5 bookings</span>
                  </div>
                  {recentAppointments.length === 0 ? (
                    <p className="text-sm text-gray-500">No appointments scheduled.</p>
                  ) : (
                    <div className="space-y-3">
                      {recentAppointments.map((apt) => (
                        <div key={apt.id} className="flex items-center justify-between border rounded-lg p-3">
                          <div>
                            <p className="font-semibold">{apt.student_name}</p>
                            <p className="text-sm text-gray-600">
                              {apt.counselor_name} • {apt.appointment_date} at {apt.appointment_time}
                            </p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs ${
                            apt.status === 'accepted' ? 'bg-green-100 text-green-800' :
                            apt.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            apt.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {apt.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Reports */}
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold">Recent Reports</h2>
                    <span className="text-sm text-gray-500">Latest 5 submissions</span>
                  </div>
                  {recentReports.length === 0 ? (
                    <p className="text-sm text-gray-500">No reports submitted yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {recentReports.map((report) => (
                        <div key={report.id} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold">{report.title}</p>
                            {report.is_urgent && (
                              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">Urgent</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            {report.counselor_name} • {new Date(report.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Popular Careers */}
                {stats?.popularCareers && stats.popularCareers.length > 0 && (
                  <div className="card">
                    <h2 className="text-2xl font-bold mb-4">Most Popular Careers</h2>
                    <div className="space-y-2">
                      {stats.popularCareers.slice(0, 10).map((career, index) => (
                        <div key={career.title} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                          <div className="flex items-center space-x-3">
                            <span className="text-2xl font-bold text-primary-600">{index + 1}</span>
                            <div>
                              <p className="font-semibold">{career.title}</p>
                              <p className="text-sm text-gray-600">{career.interest_count} students interested</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {(activeTab === 'users' || activeTab === 'students' || activeTab === 'counselors') && (
          <div className="space-y-8">
            <div className="card">
              <h2 className="text-2xl font-bold mb-4">
                {activeTab === 'students' && 'All Students'}
                {activeTab === 'counselors' && 'All Counselors'}
                {activeTab === 'users' && 'All Users'}
              </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Name</th>
                    <th className="text-left py-3 px-4">Role</th>
                    <th className="text-left py-3 px-4">County</th>
                    <th className="text-left py-3 px-4">School/Organization</th>
                    <th className="text-left py-3 px-4">Status</th>
                    <th className="text-left py-3 px-4">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeTab === 'students' ? students : activeTab === 'counselors' ? counselors : users).map((u) => (
                    <tr key={u.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">{u.first_name} {u.last_name}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded capitalize">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">{u.county || '-'}</td>
                      <td className="py-3 px-4">{u.school_name || u.organization || '-'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          u.is_approved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {u.is_approved ? 'Approved' : 'Pending'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Appointments in Users Tab */}
          <div className="card mt-8">
            <h2 className="text-2xl font-bold mb-4">All Appointments</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Student</th>
                    <th className="text-left py-3 px-4">Counselor</th>
                    <th className="text-left py-3 px-4">Date</th>
                    <th className="text-left py-3 px-4">Time</th>
                    <th className="text-left py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.slice(0, 50).map((apt) => (
                    <tr key={apt.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">{apt.student_name}</td>
                      <td className="py-3 px-4">{apt.counselor_name}</td>
                      <td className="py-3 px-4">{apt.appointment_date}</td>
                      <td className="py-3 px-4">{apt.appointment_time}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          apt.status === 'accepted' ? 'bg-green-100 text-green-800' :
                          apt.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          apt.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {apt.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        )}

        {/* Appointments Tab */}
        {activeTab === 'appointments' && (
          <div className="card">
            <h2 className="text-2xl font-bold mb-4">All Appointments</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Student</th>
                    <th className="text-left py-3 px-4">Counselor</th>
                    <th className="text-left py-3 px-4">Date</th>
                    <th className="text-left py-3 px-4">Time</th>
                    <th className="text-left py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-gray-500">No appointments yet</td>
                    </tr>
                  ) : (
                    appointments.map((apt) => (
                      <tr key={apt.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">{apt.student_name}</td>
                        <td className="py-3 px-4">{apt.counselor_name}</td>
                        <td className="py-3 px-4">{apt.appointment_date}</td>
                        <td className="py-3 px-4">{apt.appointment_time}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs ${
                            apt.status === 'accepted' ? 'bg-green-100 text-green-800' :
                            apt.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            apt.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {apt.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="card">
            <h2 className="text-2xl font-bold mb-4">Counselor Reports</h2>
            <div className="space-y-4">
              {reports.length === 0 ? (
                <p className="text-gray-500">No reports yet</p>
              ) : (
                reports.map((report) => (
                  <div
                    key={report.id}
                    className={`border rounded-lg p-4 ${
                      report.is_urgent ? 'border-red-500 bg-red-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold text-lg">{report.title}</h3>
                          {report.is_urgent && (
                            <span className="px-2 py-1 bg-red-500 text-white text-xs rounded">URGENT</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          From: {report.counselor_name} • Student: {report.student_name}
                        </p>
                        <p className="text-sm text-gray-600">Type: {report.report_type}</p>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(report.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-gray-700 mb-2">{report.content}</p>
                    {report.recommendations && (
                      <div className="bg-blue-50 p-3 rounded mt-2">
                        <p className="text-sm font-medium text-blue-900">Recommendations:</p>
                        <p className="text-sm text-blue-700">{report.recommendations}</p>
                      </div>
                    )}
                    {report.student_progress !== null && (
                      <p className="text-sm text-gray-600 mt-2">
                        Student Progress: {Math.round(report.student_progress)}% • Level: {report.student_level}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Sessions Tab */}
        {activeTab === 'sessions' && (
          <div className="card">
            <h2 className="text-2xl font-bold mb-4">All Live Sessions</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Student</th>
                    <th className="text-left py-3 px-4">Counselor</th>
                    <th className="text-left py-3 px-4">Title</th>
                    <th className="text-left py-3 px-4">Type</th>
                    <th className="text-left py-3 px-4">Start Time</th>
                    <th className="text-left py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">{session.student_name}</td>
                      <td className="py-3 px-4">{session.counselor_name}</td>
                      <td className="py-3 px-4">{session.session_title}</td>
                      <td className="py-3 px-4 capitalize">{session.session_type}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {new Date(session.start_time).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          session.status === 'active' ? 'bg-green-100 text-green-800' :
                          session.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {session.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Careers Tab */}
        {activeTab === 'schedules' && (
          <div className="card">
            <h2 className="text-2xl font-bold mb-4">All Counseling Schedules</h2>
            <div className="mb-4 flex items-center space-x-2 text-sm text-gray-600">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span>Real-time monitoring • {schedules.length} total schedules</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Student</th>
                    <th className="text-left py-3 px-4">Counselor</th>
                    <th className="text-left py-3 px-4">Day</th>
                    <th className="text-left py-3 px-4">Time</th>
                    <th className="text-left py-3 px-4">Type</th>
                    <th className="text-left py-3 px-4">Status</th>
                    <th className="text-left py-3 px-4">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((schedule) => (
                    <tr key={schedule.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">{schedule.student_name}</td>
                      <td className="py-3 px-4">{schedule.counselor_name}</td>
                      <td className="py-3 px-4 font-medium">{schedule.day_of_week}</td>
                      <td className="py-3 px-4">
                        {schedule.start_time} - {schedule.end_time}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          schedule.schedule_type === 'student_proposed' 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {schedule.schedule_type === 'student_proposed' ? 'Student Proposed' : 'Counselor Created'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          schedule.status === 'accepted' || schedule.status === 'active' 
                            ? 'bg-green-100 text-green-800' :
                          schedule.status === 'pending' 
                            ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {schedule.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {new Date(schedule.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {schedules.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p>No schedules yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'careers' && (
          <div className="card">
            <h2 className="text-2xl font-bold mb-4">Career Management</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {careers.map((career) => (
                <div key={career.id} className="border rounded-lg p-4 hover:shadow-md">
                  <h3 className="font-semibold text-lg mb-2">{career.title}</h3>
                  <p className="text-sm text-gray-600 mb-2">{career.category}</p>
                  <p className="text-sm text-gray-700">{career.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Calendar Tab */}
        {activeTab === 'calendar' && (
          <CalendarView
            schedules={schedules}
            appointments={appointments}
            sessions={sessions}
            role="admin"
            onSelectEvent={(event) => {
              const data = event.resource?.data;
              if (data) {
                if (event.resource.type === 'schedule') {
                  toast.info(`Schedule: ${data.student_name} with ${data.counselor_name} - ${data.day_of_week} ${data.start_time} - ${data.end_time}`);
                } else if (event.resource.type === 'appointment') {
                  toast.info(`Appointment: ${data.student_name} with ${data.counselor_name} - ${data.appointment_date} at ${data.appointment_time}`);
                } else if (event.resource.type === 'session') {
                  toast.info(`Session: ${data.student_name} with ${data.counselor_name} - ${data.session_title}`);
                }
              }
            }}
          />
        )}
      </div>

      <Footer />
    </div>
  );
}
