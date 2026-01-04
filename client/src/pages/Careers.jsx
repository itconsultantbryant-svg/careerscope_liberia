import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { BookOpen, Search, TrendingUp, MapPin, Briefcase, Star, Filter, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Careers() {
  const { user } = useAuth();
  const [careers, setCareers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('title');

  useEffect(() => {
    fetchCareers();
  }, []);

  const fetchCareers = async () => {
    try {
      const res = await api.get('/careers');
      setCareers(res.data.careers || []);
    } catch (error) {
      toast.error('Failed to load careers');
    } finally {
      setLoading(false);
    }
  };

  // Extract unique categories
  const categories = ['all', ...new Set(careers.map(c => c.category).filter(Boolean))];

  // Filter and sort careers
  const filteredCareers = careers
    .filter(career => {
      const matchesSearch = 
        career.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        career.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        career.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = selectedCategory === 'all' || career.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return (a.title || '').localeCompare(b.title || '');
        case 'category':
          return (a.category || '').localeCompare(b.category || '');
        default:
          return 0;
      }
    });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="rounded-full h-16 w-16 border-4 border-primary-200 border-t-primary-600"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <Navbar />
      
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-600 via-blue-600 to-primary-700 text-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <h1 className="text-4xl md:text-6xl font-bold mb-4">
              Career Explorer
            </h1>
            <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto">
              Discover career paths available in Liberia and find the perfect match for your interests and skills
            </p>
          </motion.div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filter Bar */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8 space-y-4"
        >
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search careers by name, category, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-lg shadow-sm hover:shadow-md"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Filter and Sort Controls */}
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg border-2 transition-all ${
                  showFilters
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-primary-500'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
              </button>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-2">
                {categories.slice(0, 5).map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      selectedCategory === category
                        ? 'bg-primary-600 text-white shadow-md'
                        : 'bg-white text-gray-700 border border-gray-300 hover:border-primary-500 hover:bg-primary-50'
                    }`}
                  >
                    {category === 'all' ? 'All Careers' : category}
                  </button>
                ))}
                {categories.length > 5 && (
                  <span className="px-4 py-2 text-sm text-gray-600">
                    +{categories.length - 5} more
                  </span>
                )}
              </div>
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 rounded-lg border-2 border-gray-300 bg-white text-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              <option value="title">Sort by Name</option>
              <option value="category">Sort by Category</option>
            </select>
          </div>

          {/* Expanded Filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-white p-6 rounded-xl border-2 border-gray-200 shadow-lg space-y-4"
              >
                <h3 className="font-semibold text-gray-900 mb-3">All Categories</h3>
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => {
                        setSelectedCategory(category);
                        setShowFilters(false);
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        selectedCategory === category
                          ? 'bg-primary-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-primary-100 hover:text-primary-700'
                      }`}
                    >
                      {category === 'all' ? 'All Careers' : category}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Results Count */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-6"
        >
          <p className="text-gray-600">
            Found <span className="font-bold text-primary-600">{filteredCareers.length}</span> career{filteredCareers.length !== 1 ? 's' : ''}
            {selectedCategory !== 'all' && (
              <span> in <span className="font-semibold">{selectedCategory}</span></span>
            )}
          </p>
        </motion.div>

        {/* Careers Grid */}
        {filteredCareers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            <AnimatePresence>
              {filteredCareers.map((career, index) => (
                <motion.div
                  key={career.id}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                  whileHover={{ y: -8, scale: 1.02 }}
                  className="group relative"
                >
                  <Link to={`/careers/${career.id}`}>
                    <div className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6 h-full border-2 border-gray-100 hover:border-primary-300 cursor-pointer">
                    {/* Icon and Header */}
                    <div className="flex items-start space-x-4 mb-4">
                      <motion.div
                        whileHover={{ rotate: 360, scale: 1.1 }}
                        transition={{ duration: 0.5 }}
                        className="bg-gradient-to-br from-primary-100 to-blue-100 p-4 rounded-xl flex-shrink-0"
                      >
                        <BookOpen className="w-8 h-8 text-primary-600" />
                      </motion.div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors">
                          {career.title}
                        </h3>
                        {career.category && (
                          <span className="inline-block px-3 py-1 bg-primary-100 text-primary-700 text-xs font-semibold rounded-full mb-2">
                            {career.category}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3 leading-relaxed">
                      {career.description}
                    </p>

                    {/* Additional Info */}
                    <div className="space-y-2 pt-4 border-t border-gray-100">
                      {career.job_outlook && (
                        <div className="flex items-center text-sm text-gray-600">
                          <TrendingUp className="w-4 h-4 mr-2 text-green-600" />
                          <span><span className="font-medium">Outlook:</span> {career.job_outlook}</span>
                        </div>
                      )}
                      {career.salary_range && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Briefcase className="w-4 h-4 mr-2 text-blue-600" />
                          <span><span className="font-medium">Salary:</span> {career.salary_range}</span>
                        </div>
                      )}
                      {career.location && (
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPin className="w-4 h-4 mr-2 text-red-600" />
                          <span>{career.location}</span>
                        </div>
                      )}
                    </div>

                    {/* Hover Effect Overlay */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      whileHover={{ opacity: 1 }}
                      className="absolute inset-0 bg-gradient-to-br from-primary-600/10 to-blue-600/10 rounded-2xl pointer-events-none"
                    />
                  </div>
                    </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 bg-white rounded-2xl shadow-lg border-2 border-gray-100"
          >
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium mb-2">No careers found</p>
            <p className="text-gray-400 text-sm">
              Try adjusting your search or filter criteria
            </p>
            {(searchTerm || selectedCategory !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                }}
                className="mt-4 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </motion.div>
        )}
      </div>

      <Footer />
    </div>
  );
}
