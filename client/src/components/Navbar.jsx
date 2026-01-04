import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, X, User, LogOut } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3">
            <img 
              src="/assets/careerscope_logo.jpeg" 
              alt="CareerScope Logo" 
              className="h-10 w-auto object-contain"
              style={{ display: 'block', maxHeight: '40px' }}
              onError={(e) => {
                console.error('Failed to load logo image');
                e.target.style.display = 'none';
              }}
            />
            <span className="text-xl font-bold text-gray-900">CareerScope</span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-6">
            <Link to="/" className="text-gray-700 hover:text-primary-600 font-medium">
              Home
            </Link>
            <Link to="/careers" className="text-gray-700 hover:text-primary-600 font-medium">
              Careers
            </Link>
            {user && (
              <>
                <Link to="/community" className="text-gray-700 hover:text-primary-600 font-medium">
                  Community
                </Link>
                <Link
                  to={`/${user.role}/dashboard`}
                  className="text-gray-700 hover:text-primary-600 font-medium"
                >
                  Dashboard
                </Link>
              </>
            )}
            {user ? (
              <div className="flex items-center space-x-4">
                <NotificationBell />
                <div className="flex items-center space-x-2 text-gray-700">
                  <User className="w-5 h-5" />
                  <span className="font-medium">{user.first_name}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 text-red-600 hover:text-red-700 font-medium"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="btn-primary"
              >
                Get Started
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-gray-700"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t"
          >
            <div className="px-4 py-4 space-y-3">
              <Link
                to="/"
                className="block text-gray-700 hover:text-primary-600 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                to="/careers"
                className="block text-gray-700 hover:text-primary-600 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Careers
              </Link>
              {user && (
                <>
                  <Link
                    to="/community"
                    className="block text-gray-700 hover:text-primary-600 font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Community
                  </Link>
                  <Link
                    to={`/${user.role}/dashboard`}
                    className="block text-gray-700 hover:text-primary-600 font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                </>
              )}
              {user ? (
                <div className="pt-4 border-t space-y-3">
                  <div className="flex items-center space-x-2 text-gray-700">
                    <User className="w-5 h-5" />
                    <span className="font-medium">{user.first_name} {user.last_name}</span>
                  </div>
                  <button
                    onClick={() => {
                      handleLogout();
                      setMobileMenuOpen(false);
                    }}
                    className="flex items-center space-x-2 text-red-600 hover:text-red-700 font-medium w-full"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Logout</span>
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="btn-primary block text-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Get Started
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

