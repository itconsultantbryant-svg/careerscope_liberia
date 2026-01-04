import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  User,
  Users,
  Calendar,
  FileText,
  Award,
  MessageSquare,
  Settings,
  BarChart3,
  BookOpen,
  ClipboardList,
  Bell,
  LogOut,
} from 'lucide-react';

export default function Sidebar({ role }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isActive = (path) => {
    // Exact match
    if (location.pathname === path) return true;
    
    // For dashboard route, highlight if we're on any sub-route of that role (except profile)
    if (path.includes('/dashboard')) {
      const role = path.split('/')[1]; // e.g., 'student', 'counselor', 'admin'
      return location.pathname.startsWith(`/${role}/`) && 
             !location.pathname.includes('/profile');
    }
    
    // For other routes, check if current path starts with the menu path
    return location.pathname.startsWith(path);
  };

  const studentMenu = [
    { path: '/student/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/student/calendar', icon: Calendar, label: 'Calendar' },
    { path: '/student/appointments', icon: Calendar, label: 'Appointments' },
    { path: '/student/learning', icon: BookOpen, label: 'Learning Portal' },
    { path: '/student/grades', icon: Award, label: 'My Grades' },
    { path: '/student/sessions', icon: MessageSquare, label: 'Live Sessions' },
    { path: '/chat', icon: MessageSquare, label: 'Chat' },
    { path: '/student/careers', icon: ClipboardList, label: 'Career Explorer' },
    { path: '/student/profile', icon: User, label: 'My Profile' },
  ];

  const counselorMenu = [
    { path: '/counselor/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/counselor/calendar', icon: Calendar, label: 'Calendar' },
    { path: '/counselor/appointments', icon: Calendar, label: 'Appointments' },
    { path: '/counselor/students', icon: Users, label: 'My Students' },
    { path: '/counselor/materials', icon: FileText, label: 'Learning Materials' },
    { path: '/counselor/grading', icon: Award, label: 'Grading' },
    { path: '/counselor/sessions', icon: MessageSquare, label: 'Live Sessions' },
    { path: '/counselor/reports', icon: BarChart3, label: 'Reports' },
    { path: '/counselor/profile', icon: User, label: 'My Profile' },
  ];

  const adminMenu = [
    { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/calendar', icon: Calendar, label: 'Calendar' },
    { path: '/admin/users', icon: Users, label: 'All Users' },
    { path: '/admin/students', icon: Users, label: 'Students' },
    { path: '/admin/counselors', icon: Users, label: 'Counselors' },
    { path: '/admin/appointments', icon: Calendar, label: 'Appointments' },
    { path: '/admin/sessions', icon: MessageSquare, label: 'Live Sessions' },
    { path: '/admin/reports', icon: FileText, label: 'Counselor Reports' },
    { path: '/admin/careers', icon: BookOpen, label: 'Career Management' },
    { path: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
    { path: '/admin/profile', icon: User, label: 'My Profile' },
  ];

  const menu = role === 'student' ? studentMenu : role === 'counselor' ? counselorMenu : adminMenu;

  return (
    <div className="w-64 bg-white shadow-lg min-h-screen fixed left-0 top-0 pt-16 flex flex-col">
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {menu.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                isActive(item.path)
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t">
        <button
          onClick={handleLogout}
          className="flex items-center space-x-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 w-full transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
}

