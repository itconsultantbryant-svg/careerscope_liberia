import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { Toaster } from 'sonner';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import StudentDashboard from './pages/StudentDashboard';
import CounselorDashboard from './pages/CounselorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Community from './pages/Community';
import Careers from './pages/Careers';
import CareerDetail from './pages/CareerDetail';
import Profile from './pages/Profile';
import ChatPage from './pages/ChatPage';

// Protected Route Component
function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={user ? <Navigate to={`/${user.role}/dashboard`} replace /> : <Login />} />
      <Route path="/careers" element={<Careers />} />
      <Route path="/careers/:id" element={<CareerDetail />} />
      
      {/* Student Routes */}
      <Route
        path="/student/dashboard"
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/appointments"
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/learning"
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/grades"
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/sessions"
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/calendar"
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/careers"
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <Careers />
          </ProtectedRoute>
        }
      />
      
      {/* Counselor Routes */}
      <Route
        path="/counselor/dashboard"
        element={
          <ProtectedRoute allowedRoles={['counselor']}>
            <CounselorDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/counselor/appointments"
        element={
          <ProtectedRoute allowedRoles={['counselor']}>
            <CounselorDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/counselor/students"
        element={
          <ProtectedRoute allowedRoles={['counselor']}>
            <CounselorDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/counselor/materials"
        element={
          <ProtectedRoute allowedRoles={['counselor']}>
            <CounselorDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/counselor/grading"
        element={
          <ProtectedRoute allowedRoles={['counselor']}>
            <CounselorDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/counselor/sessions"
        element={
          <ProtectedRoute allowedRoles={['counselor']}>
            <CounselorDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/counselor/calendar"
        element={
          <ProtectedRoute allowedRoles={['counselor']}>
            <CounselorDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/counselor/reports"
        element={
          <ProtectedRoute allowedRoles={['counselor']}>
            <CounselorDashboard />
          </ProtectedRoute>
        }
      />
      
      {/* Admin Routes */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/students"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/counselors"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/appointments"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/schedules"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/calendar"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/sessions"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/reports"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/careers"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/analytics"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/community"
        element={
          <ProtectedRoute>
            <Community />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/chat"
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <ChatPage />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/student/profile"
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <Profile />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/counselor/profile"
        element={
          <ProtectedRoute allowedRoles={['counselor']}>
            <Profile />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/admin/profile"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Profile />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Router
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AppRoutes />
          <Toaster position="top-right" richColors />
        </Router>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
