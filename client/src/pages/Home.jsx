import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, GraduationCap, Users, BookOpen, Heart, Target, TrendingUp, Award, MessageCircle, Calendar, CheckCircle, Sparkles } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ImageCarousel from '../components/ImageCarousel';
import api from '../utils/api';

// Import images
import headerBackground from '../assets/header_background1.jpeg';
import sliding1 from '../assets/sliding1.jpeg';
import sliding2 from '../assets/sliding2.jpg';
import sliding3 from '../assets/sliding3.jpg';
import sliding4 from '../assets/sliding4.jpg';
import sliding5 from '../assets/sliding5.jpg';
import sliding6 from '../assets/sliding6.jpg';
import sliding7 from '../assets/sliding7.jpg';
import sliding8 from '../assets/sliding8.jpg';
import sliding10 from '../assets/sliding10.jpg';

const slidingImages = [sliding1, sliding2, sliding3, sliding4, sliding5, sliding6, sliding7, sliding8, sliding10];

// Icon mapping for career categories
const getCareerIcon = (category) => {
  const iconMap = {
    'Healthcare': '🏥',
    'Technology': '💻',
    'Education': '📚',
    'Agriculture': '🌾',
    'Business': '💼',
    'Legal': '⚖️',
    'Law': '⚖️',
    'Engineering': '⚙️',
    'Media': '📺',
    'Arts': '🎨',
    'Social Services': '🤝',
    'Trades': '🔧',
    'Transportation': '🚗',
    'Tourism': '✈️',
    'Sports': '⚽'
  };
  return iconMap[category] || '💼';
};

// Color mapping for career categories
const getCareerColor = (category) => {
  const colorMap = {
    'Healthcare': { bg: 'bg-red-100', hover: 'hover:bg-red-200' },
    'Technology': { bg: 'bg-purple-100', hover: 'hover:bg-purple-200' },
    'Education': { bg: 'bg-green-100', hover: 'hover:bg-green-200' },
    'Agriculture': { bg: 'bg-yellow-100', hover: 'hover:bg-yellow-200' },
    'Business': { bg: 'bg-indigo-100', hover: 'hover:bg-indigo-200' },
    'Legal': { bg: 'bg-gray-100', hover: 'hover:bg-gray-200' },
    'Law': { bg: 'bg-gray-100', hover: 'hover:bg-gray-200' },
    'Engineering': { bg: 'bg-blue-100', hover: 'hover:bg-blue-200' },
    'Media': { bg: 'bg-pink-100', hover: 'hover:bg-pink-200' },
    'Arts': { bg: 'bg-orange-100', hover: 'hover:bg-orange-200' },
    'Social Services': { bg: 'bg-teal-100', hover: 'hover:bg-teal-200' },
    'Trades': { bg: 'bg-amber-100', hover: 'hover:bg-amber-200' },
    'Transportation': { bg: 'bg-cyan-100', hover: 'hover:bg-cyan-200' },
    'Tourism': { bg: 'bg-sky-100', hover: 'hover:bg-sky-200' },
    'Sports': { bg: 'bg-emerald-100', hover: 'hover:bg-emerald-200' }
  };
  return colorMap[category] || { bg: 'bg-gray-100', hover: 'hover:bg-gray-200' };
};

const testimonials = [
  {
    name: 'Sarah Johnson',
    school: 'St. Mary\'s High School',
    text: 'CareerScope helped me discover my passion for medicine. The counselors are amazing!',
    rating: 5,
  },
  {
    name: 'James Kollie',
    school: 'BWI High School',
    text: 'I found my dream career in IT through this platform. Highly recommend!',
    rating: 5,
  },
  {
    name: 'Mary Doe',
    school: 'Cuttington University Prep',
    text: 'The community support here is incredible. Thank you CareerScope!',
    rating: 5,
  },
];

const features = [
  {
    icon: Target,
    title: 'Career Assessment',
    description: 'Discover your strengths and interests with our comprehensive career quiz',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    icon: Users,
    title: 'Expert Counselors',
    description: 'Connect with experienced career counselors who understand the Liberian job market',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  {
    icon: BookOpen,
    title: 'Career Resources',
    description: 'Access extensive resources about various career paths and opportunities',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  {
    icon: Calendar,
    title: 'One-on-One Sessions',
    description: 'Schedule personalized counseling sessions to plan your career journey',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
  {
    icon: MessageCircle,
    title: 'Community Support',
    description: 'Join a vibrant community of students and professionals sharing experiences',
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
  },
  {
    icon: TrendingUp,
    title: 'Career Growth',
    description: 'Track your progress and set goals for your professional development',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
  },
];

const stats = [
  { number: '10,000+', label: 'Active Students', icon: Users },
  { number: '500+', label: 'Career Paths', icon: BookOpen },
  { number: '200+', label: 'Expert Counselors', icon: Award },
  { number: '95%', label: 'Success Rate', icon: CheckCircle },
];

export default function Home() {
  const [popularCareers, setPopularCareers] = useState([]);
  const [loadingCareers, setLoadingCareers] = useState(true);

  useEffect(() => {
    fetchPopularCareers();
  }, []);

  const fetchPopularCareers = async () => {
    try {
      const res = await api.get('/careers');
      if (res.data && res.data.careers) {
        // Get top 8 careers (can be sorted by popularity or just first 8)
        const careers = res.data.careers.slice(0, 8);
        setPopularCareers(careers);
      }
    } catch (error) {
      console.error('Failed to fetch careers:', error);
    } finally {
      setLoadingCareers(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero Section with Background Image */}
      <section 
        className="relative min-h-[90vh] flex items-center justify-center text-white py-20 overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.4)), url(${headerBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-primary-900/80 via-primary-800/70 to-primary-900/80" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="flex justify-center mb-8"
            >
              <img 
                src="/assets/careerscope_logo.jpeg" 
                alt="CareerScope Logo" 
                className="h-32 w-auto object-contain drop-shadow-2xl"
                style={{ display: 'block', maxHeight: '128px' }}
                onError={(e) => {
                  console.error('Failed to load logo:', e.target.src);
                  e.target.style.display = 'none';
                }}
              />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-5xl md:text-7xl font-bold mb-6 leading-tight"
            >
              Your Future Starts{' '}
              <span className="text-gold-400 inline-block">
                <motion.span
                  animate={{ 
                    rotate: [0, 10, -10, 0],
                  }}
                  transition={{ 
                    duration: 2,
                    repeat: Infinity,
                    repeatDelay: 3
                  }}
                  className="inline-block"
                >
                  Here
                </motion.span>
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="text-xl md:text-3xl mb-8 text-white/95 font-light"
            >
              Discover Your Career Path in Liberia
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="text-lg md:text-xl mb-10 text-white/90 max-w-3xl mx-auto"
            >
              Empowering Liberian students to make informed career decisions through expert guidance, 
              comprehensive resources, and a supportive community.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <Link 
                to="/login" 
                className="group relative px-8 py-4 bg-white text-primary-600 font-semibold rounded-full shadow-2xl hover:bg-gray-100 transition-all duration-300 inline-flex items-center space-x-2 overflow-hidden"
              >
                <span className="relative z-10">Get Started</span>
                <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-primary-600 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  initial={false}
                />
                <span className="absolute inset-0 bg-gradient-to-r from-primary-600 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity text-white flex items-center justify-center">
                  <span className="relative z-10">Get Started</span>
                  <ArrowRight className="w-5 h-5 relative z-10 ml-2 group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
              <Link 
                to="/careers" 
                className="px-8 py-4 bg-transparent border-2 border-white text-white font-semibold rounded-full hover:bg-white hover:text-primary-600 transition-all duration-300"
              >
                Explore Careers
              </Link>
            </motion.div>
          </motion.div>
        </div>
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
        >
          <ArrowRight className="w-6 h-6 rotate-90 text-white/80" />
        </motion.div>
      </section>

      {/* Image Carousel Section */}
      <section className="py-16 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Success Stories & Opportunities
            </h2>
            <p className="text-gray-600 text-lg md:text-xl max-w-2xl mx-auto">
              See how CareerScope is transforming lives and opening doors to amazing career opportunities
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <ImageCarousel images={slidingImages} autoPlayInterval={5000} />
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-primary-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  className="inline-block mb-4"
                >
                  <stat.icon className="w-12 h-12 mx-auto mb-2 text-gold-400" />
                </motion.div>
                <motion.div
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 + 0.2, type: 'spring' }}
                  className="text-4xl md:text-5xl font-bold mb-2 text-gold-400"
                >
                  {stat.number}
                </motion.div>
                <p className="text-white/90 text-sm md:text-base">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Why Choose CareerScope?
            </h2>
            <p className="text-gray-600 text-lg md:text-xl max-w-2xl mx-auto">
              Comprehensive tools and resources to guide your career journey
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -10, scale: 1.02 }}
                className="group relative"
              >
                <div className={`${feature.bgColor} p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 h-full border-2 border-transparent hover:border-primary-200`}>
                  <motion.div
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.6 }}
                    className={`${feature.color} mb-4 inline-block`}
                  >
                    <feature.icon className="w-12 h-12" />
                  </motion.div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: '100%' }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 + 0.3, duration: 0.5 }}
                    className="mt-4 h-1 bg-gradient-to-r from-primary-600 to-blue-600 rounded-full"
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Career Paths */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Popular Career Paths in Liberia
            </h2>
            <p className="text-gray-600 text-lg md:text-xl max-w-2xl mx-auto">
              Explore opportunities that match your interests and aspirations
            </p>
          </motion.div>

          {loadingCareers ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {popularCareers.map((career, index) => {
                const colors = getCareerColor(career.category || 'General');
                const icon = getCareerIcon(career.category || 'General');
                return (
                  <Link key={career.id} to={`/careers/${career.id}`}>
                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      whileInView={{ opacity: 1, y: 0, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ y: -10, scale: 1.05 }}
                      className="group cursor-pointer"
                    >
                      <div className={`${colors.bg} ${colors.hover} p-6 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 text-center h-full border-2 border-transparent group-hover:border-primary-300`}>
                        <motion.div
                          whileHover={{ scale: 1.2, rotate: 10 }}
                          transition={{ type: 'spring', stiffness: 300 }}
                          className={`${colors.bg} w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl shadow-lg`}
                        >
                          {icon}
                        </motion.div>
                        <h3 className="font-bold text-gray-900 mb-2 text-lg">{career.title}</h3>
                        <p className="text-sm text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300 line-clamp-2">
                          {career.description || `${career.category} career path`}
                        </p>
                      </div>
                    </motion.div>
                  </Link>
                );
              })}
            </div>
          )}
          
          {/* Explore More Careers Link */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mt-12"
          >
            <Link
              to="/careers"
              className="inline-flex items-center space-x-2 px-8 py-4 bg-gradient-to-r from-primary-600 to-blue-600 text-white font-semibold rounded-full hover:from-primary-700 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <span>Explore More Careers</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
            <p className="mt-4 text-gray-600">
              Discover 150+ career paths available in Liberia
            </p>
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              What Students Say
            </h2>
            <p className="text-gray-600 text-lg md:text-xl">
              Real stories from students who found their path
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -5, scale: 1.02 }}
                className="bg-gradient-to-br from-gray-50 to-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-200"
              >
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ scale: 0 }}
                      whileInView={{ scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 + i * 0.1 }}
                    >
                      <Heart className="w-5 h-5 text-red-500 fill-red-500" />
                    </motion.div>
                  ))}
                </div>
                <motion.p
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 + 0.2 }}
                  className="text-gray-700 mb-6 italic text-lg leading-relaxed"
                >
                  "{testimonial.text}"
                </motion.p>
                <div className="border-t border-gray-200 pt-4">
                  <p className="font-bold text-gray-900 text-lg">{testimonial.name}</p>
                  <p className="text-sm text-gray-600">{testimonial.school}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary-600 via-blue-600 to-primary-700 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url(${headerBackground})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(10px)',
          }} />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ 
                duration: 4,
                repeat: Infinity,
                repeatDelay: 2
              }}
              className="inline-block mb-6"
            >
              <Sparkles className="w-16 h-16 text-gold-400" />
            </motion.div>
            <h2 className="text-4xl md:text-6xl font-bold mb-6">
              Ready to Start Your Career Journey?
            </h2>
            <p className="text-xl md:text-2xl mb-10 text-white/95 max-w-3xl mx-auto">
              Join thousands of Liberian students discovering their future through expert guidance and comprehensive resources
            </p>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link 
                to="/login" 
                className="inline-flex items-center space-x-3 px-10 py-5 bg-white text-primary-600 font-bold text-lg rounded-full shadow-2xl hover:bg-gray-100 transition-all duration-300"
              >
                <span>Get Started Today</span>
                <ArrowRight className="w-6 h-6" />
              </Link>
            </motion.div>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="mt-6 text-white/80"
            >
              Free to join • Expert guidance • Community support
            </motion.p>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
