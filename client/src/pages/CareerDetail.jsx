import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  GraduationCap, 
  DollarSign, 
  Briefcase, 
  BookOpen, 
  TrendingUp,
  User,
  Calendar,
  Clock,
  MapPin,
  CheckCircle,
  Star,
  MessageCircle
} from 'lucide-react';
import api from '../utils/api';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';

export default function CareerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [career, setCareer] = useState(null);
  const [counselors, setCounselors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCounselor, setSelectedCounselor] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);

  useEffect(() => {
    fetchCareerDetails();
  }, [id]);

  const fetchCareerDetails = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/careers/${id}`);
      
      if (res.data) {
        setCareer(res.data.career);
        setCounselors(res.data.counselors || []);
      }
    } catch (error) {
      console.error('Failed to fetch career details:', error);
      toast.error('Failed to load career details');
      navigate('/careers');
    } finally {
      setLoading(false);
    }
  };

  const handleBookAppointment = (counselor) => {
    if (!user) {
      toast.error('Please login to book an appointment');
      navigate('/login');
      return;
    }
    
    setSelectedCounselor(counselor);
    setShowBookingModal(true);
  };

  const handleConfirmBooking = () => {
    if (user && user.role === 'student') {
      navigate(`/student/appointments?counselor=${selectedCounselor.id}&career=${career.id}`);
    } else {
      toast.error('Only students can book appointments');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading career details...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!career) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <p className="text-gray-600 mb-4">Career not found</p>
            <Link to="/careers" className="btn-primary">
              Back to Careers
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary-600 to-blue-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => navigate(-1)}
            className="flex items-center space-x-2 text-white/90 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </motion.button>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl"
          >
            <div className="inline-block px-4 py-2 bg-white/20 rounded-full text-sm font-medium mb-4">
              {career.category || 'General'}
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">{career.title}</h1>
            {career.description && (
              <p className="text-xl text-white/90 leading-relaxed">{career.description}</p>
            )}
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Overview */}
            {career.description && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-xl shadow-sm p-6"
              >
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Overview</h2>
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">{career.description}</p>
              </motion.div>
            )}

            {/* Job Outlook */}
            {career.job_outlook && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-xl shadow-sm p-6"
              >
                <div className="flex items-center space-x-3 mb-4">
                  <TrendingUp className="w-6 h-6 text-primary-600" />
                  <h2 className="text-2xl font-bold text-gray-900">Job Outlook</h2>
                </div>
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">{career.job_outlook}</p>
              </motion.div>
            )}

            {/* Required Education */}
            {career.required_education && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white rounded-xl shadow-sm p-6"
              >
                <div className="flex items-center space-x-3 mb-4">
                  <GraduationCap className="w-6 h-6 text-primary-600" />
                  <h2 className="text-2xl font-bold text-gray-900">Required Education</h2>
                </div>
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">{career.required_education}</p>
              </motion.div>
            )}

            {/* Skills Required */}
            {career.skills_required && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white rounded-xl shadow-sm p-6"
              >
                <div className="flex items-center space-x-3 mb-4">
                  <Briefcase className="w-6 h-6 text-primary-600" />
                  <h2 className="text-2xl font-bold text-gray-900">Skills Required</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {career.skills_required.split(',').filter(s => s.trim()).map((skill, index) => (
                    <span
                      key={index}
                      className="px-4 py-2 bg-primary-50 text-primary-700 rounded-full text-sm font-medium"
                    >
                      {skill.trim()}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Universities */}
            {career.universities && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-white rounded-xl shadow-sm p-6"
              >
                <div className="flex items-center space-x-3 mb-4">
                  <BookOpen className="w-6 h-6 text-primary-600" />
                  <h2 className="text-2xl font-bold text-gray-900">Recommended Universities</h2>
                </div>
                <ul className="space-y-2">
                  {career.universities.split(',').filter(u => u.trim()).map((university, index) => (
                    <li key={index} className="flex items-center space-x-2 text-gray-700">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span>{university.trim()}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Salary Range */}
            {career.salary_range && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-xl shadow-sm p-6"
              >
                <div className="flex items-center space-x-3 mb-4">
                  <DollarSign className="w-6 h-6 text-primary-600" />
                  <h3 className="text-xl font-bold text-gray-900">Salary Range</h3>
                </div>
                <p className="text-2xl font-bold text-primary-600">{career.salary_range}</p>
              </motion.div>
            )}

            {/* Available Counselors */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-xl shadow-sm p-6"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-4">Available Counselors</h3>
              {counselors.length > 0 ? (
                <div className="space-y-4">
                  {counselors.slice(0, 3).map((counselor) => (
                    <div
                      key={counselor.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-primary-500 transition-colors"
                    >
                      <div className="flex items-start space-x-3">
                        <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-6 h-6 text-primary-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-gray-900 truncate">
                            {counselor.first_name} {counselor.last_name}
                          </h4>
                          <p className="text-sm text-gray-600 truncate">
                            {counselor.industry_specialty || 'General Counseling'}
                          </p>
                          {counselor.years_of_experience && (
                            <p className="text-xs text-gray-500 mt-1">
                              {counselor.years_of_experience} years experience
                            </p>
                          )}
                        </div>
                      </div>
                      {user && user.role === 'student' && (
                        <button
                          onClick={() => handleBookAppointment(counselor)}
                          className="mt-3 w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
                        >
                          Book Appointment
                        </button>
                      )}
                    </div>
                  ))}
                  {counselors.length > 3 && (
                    <Link
                      to={`/careers?category=${career.category}`}
                      className="block text-center text-primary-600 hover:text-primary-700 font-medium text-sm"
                    >
                      View all {counselors.length} counselors
                    </Link>
                  )}
                </div>
              ) : (
                <p className="text-gray-600 text-sm">No counselors available for this career at the moment.</p>
              )}
            </motion.div>

            {/* Quick Actions */}
            {user && user.role === 'student' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white rounded-xl shadow-sm p-6"
              >
                <h3 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <Link
                    to={`/student/appointments?career=${career.id}`}
                    className="block w-full px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-center font-medium"
                  >
                    Book Appointment
                  </Link>
                  <Link
                    to="/careers"
                    className="block w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-center font-medium"
                  >
                    Browse More Careers
                  </Link>
                </div>
              </motion.div>
            )}
          </div>
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
            <h3 className="text-xl font-bold mb-4">Book Appointment</h3>
            <div className="mb-4">
              <p className="text-gray-600 mb-2">
                <span className="font-medium">Counselor:</span> {selectedCounselor.first_name} {selectedCounselor.last_name}
              </p>
              <p className="text-gray-600 mb-2">
                <span className="font-medium">Career:</span> {career.title}
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
                Continue
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <Footer />
    </div>
  );
}

