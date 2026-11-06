import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';
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
  X,
} from 'lucide-react';

export default function Sidebar({ role, isOpen = false, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  useEffect(() => {
    if (!isOpen) return;
    const close = (event) => { if (event.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [isOpen, onClose]);

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isActive = (path) => {
    // Exact match
    if (location.pathname === path) return true;
    
    // Dashboard is only active on its own route. Each sub-route has a dedicated
    // navigation item, so treating all of them as the dashboard caused two items
    // to appear selected at once.
    if (path.includes('/dashboard')) {
      return location.pathname === path;
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
    { path: '/student/payments', icon: FileText, label: 'Subscription & Receipts' },
    { path: '/student/sessions', icon: MessageSquare, label: 'Live Sessions' },
    { path: '/chat', icon: MessageSquare, label: 'Chat' },
    { path: '/student/careers', icon: ClipboardList, label: 'Career Explorer' },
    { path: '/student/profile', icon: User, label: 'My Profile' },
    { path: '/student/archive', icon: FileText, label: 'My Documents & Notes' },
    { path: '/student/ai-counselors', icon: Users, label: 'AI Counselors' },
  ];

  const counselorMenu = [
    { path: '/counselor/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/counselor/calendar', icon: Calendar, label: 'Calendar' },
    { path: '/counselor/appointments', icon: Calendar, label: 'Appointments' },
    { path: '/counselor/students', icon: Users, label: 'My Students' },
    { path: '/counselor/materials', icon: FileText, label: 'Learning Materials' },
    { path: '/counselor/grading', icon: Award, label: 'Grading' },
    { path: '/counselor/sessions', icon: MessageSquare, label: 'Live Sessions' },
    { path: '/chat', icon: MessageSquare, label: 'Messages' },
    { path: '/counselor/reports', icon: BarChart3, label: 'Reports' },
    { path: '/counselor/profile', icon: User, label: 'My Profile' },
    { path: '/counselor/archive', icon: FileText, label: 'My Documents & Notes' },
  ];

  const adminMenu = [
    { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/calendar', icon: Calendar, label: 'Calendar' },
    { path: '/admin/users', icon: Users, label: 'All Users' },
    { path: '/admin/students', icon: Users, label: 'Students' },
    { path: '/admin/counselors', icon: Users, label: 'Counselors' },
    { path: '/admin/appointments', icon: Calendar, label: 'Appointments' },
    { path: '/admin/schedules', icon: Calendar, label: 'Schedules' },
    { path: '/admin/sessions', icon: MessageSquare, label: 'Live Sessions' },
    { path: '/admin/reports', icon: FileText, label: 'Counselor Reports' },
    { path: '/admin/careers', icon: BookOpen, label: 'Career Management' },
    { path: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
    { path: '/admin/payments', icon: FileText, label: 'Payments & Invoices' },
    { path: '/admin/profile', icon: User, label: 'My Profile' },
    { path: '/admin/archive', icon: FileText, label: 'My Documents & Notes' },
    { path: '/admin/ai-counselors', icon: Users, label: 'AI Counselors' },
  ];

  const menu = role === 'student' ? studentMenu : role === 'counselor' ? counselorMenu : adminMenu;

  return (
    <>
      {isOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={handleClose}
          aria-label="Close sidebar"
        />
      )}
      <div
        id="dashboard-sidebar"
        className={`w-64 bg-white shadow-lg fixed left-0 top-16 bottom-0 flex flex-col z-50 transform transition-transform duration-200 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b">
        <span className="font-semibold text-gray-900">Menu</span>
        <button
          type="button"
          className="text-gray-600"
          onClick={handleClose}
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <nav aria-label={`${role} dashboard navigation`} className="flex-1 min-h-0 px-4 py-4 space-y-1 overflow-y-auto overscroll-contain">
        {menu.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={isActive(item.path) ? 'page' : undefined}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                isActive(item.path)
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              onClick={handleClose}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t shrink-0 bg-white">
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center space-x-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 w-full transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </div>
    </>
  );
}
