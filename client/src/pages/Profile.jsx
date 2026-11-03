import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api, { assetUrl } from '../utils/api';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Sidebar from '../components/Sidebar';
import { User, Camera, Save } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Profile() {
  const { user, checkAuth } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    bio: '',
    county: '',
    schoolName: '',
    gradeLevel: '',
    qualification: '',
    yearsOfExperience: '',
    industrySpecialty: '',
    organization: '',
  });
  const [profileImage, setProfileImage] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const counties = [
    'Montserrado', 'Grand Bassa', 'Lofa', 'Nimba', 'Bong', 'Grand Cape Mount',
    'Grand Gedeh', 'Grand Kru', 'Gbarpolu', 'Margibi', 'Maryland', 'River Cess',
    'River Gee', 'Sinoe', 'Bomi'
  ];

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        email: user.email || '',
        phone: user.phone || '',
        bio: user.bio || '',
        county: user.county || '',
        schoolName: user.school_name || '',
        gradeLevel: user.grade_level || '',
        qualification: user.qualification || '',
        yearsOfExperience: user.years_of_experience || '',
        industrySpecialty: user.industry_specialty || '',
        organization: user.organization || '',
        country: user.country || 'Liberia',
        city: user.city || '',
        address: user.address || '',
        guardianName: user.guardian_name || '',
        guardianPhone: user.guardian_phone || '',
        studentNumber: user.student_number || '',
        learningGoals: user.learning_goals || '',
      });
      if (user.profile_image) {
        // Ensure profile image URL is absolute
        setPreviewImage(assetUrl(user.profile_image));
      }
    }
  }, [user]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        toast.error('Image size must be less than 3MB');
        return;
      }
      setProfileImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formDataToSend = new FormData();
      
      // Add text fields - map to backend field names
      if (formData.firstName) formDataToSend.append('firstName', formData.firstName);
      if (formData.lastName) formDataToSend.append('lastName', formData.lastName);
      formDataToSend.append('phone', formData.phone);
      formDataToSend.append('email', formData.email);
      for (const key of ['country', 'city', 'address', 'guardianName', 'guardianPhone', 'studentNumber', 'learningGoals']) {
        formDataToSend.append(key, formData[key] || '');
      }
      if (formData.bio !== undefined) formDataToSend.append('bio', formData.bio);
      if (formData.county) formDataToSend.append('county', formData.county);
      if (formData.schoolName) formDataToSend.append('schoolName', formData.schoolName);
      if (formData.gradeLevel) formDataToSend.append('gradeLevel', formData.gradeLevel);
      if (formData.qualification) formDataToSend.append('qualification', formData.qualification);
      if (formData.yearsOfExperience) formDataToSend.append('yearsOfExperience', formData.yearsOfExperience);
      if (formData.industrySpecialty) formDataToSend.append('industrySpecialty', formData.industrySpecialty);
      if (formData.organization) formDataToSend.append('organization', formData.organization);

      // Add image if selected
      if (profileImage) {
        formDataToSend.append('profileImage', profileImage);
      }

      const res = await api.put('/users/profile', formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Update preview image with absolute URL if profile image was updated
      if (res.data.user && res.data.user.profile_image) {
        setPreviewImage(assetUrl(res.data.user.profile_image));
      }

      toast.success('Profile updated successfully!');
      await checkAuth(); // Refresh user data
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar
        showSidebarToggle
        sidebarOpen={sidebarOpen}
        onSidebarToggle={() => setSidebarOpen((prev) => !prev)}
      />
      <Sidebar role={user.role} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="ml-0 md:ml-64 p-4 sm:p-6 md:p-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-lg p-8"
          >
            <h1 className="text-3xl font-bold mb-8">Edit Profile</h1>

            {/* Profile Image Section */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-4">
                Profile Picture
              </label>
              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-6 space-y-4 sm:space-y-0">
                <div className="relative">
                  {previewImage ? (
                    <img
                      src={previewImage}
                      alt="Profile"
                      className="w-32 h-32 rounded-full object-cover border-4 border-primary-200"
                    />
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-primary-100 flex items-center justify-center">
                      <User className="w-16 h-16 text-primary-600" />
                    </div>
                  )}
                  <label className="absolute bottom-0 right-0 bg-primary-600 text-white p-2 rounded-full cursor-pointer hover:bg-primary-700 transition-colors">
                    <Camera className="w-5 h-5" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-2">
                    Upload a profile picture (max 3MB)
                  </p>
                  <p className="text-xs text-gray-500">
                    JPG, PNG or GIF. Recommended size: 400x400px
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  ['country', 'Country', 'country-name'], ['city', 'City / Town', 'address-level2'],
                  ['address', 'Address', 'street-address'],
                  ...(user.role === 'student' ? [['studentNumber', 'Student number', 'off'], ['guardianName', 'Parent / Guardian name', 'off'], ['guardianPhone', 'Parent / Guardian phone', 'off'], ['learningGoals', 'Learning and career goals', 'off']] : []),
                ].map(([key, label, autoComplete]) => (
                  <div key={key}>
                    <label htmlFor={`profile-${key}`} className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
                    <input id={`profile-${key}`} value={formData[key] || ''} autoComplete={autoComplete} maxLength={1000} className="input-field" onChange={(event) => setFormData({ ...formData, [key]: event.target.value })} />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  State / County
                </label>
                <input
                  value={formData.county}
                  onChange={(e) => setFormData({ ...formData, county: e.target.value })}
                  className="input-field"
                  list="profile-counties"
                  autoComplete="address-level1"
                />
                <datalist id="profile-counties">
                  {counties.map((county) => (
                    <option key={county} value={county}>{county}</option>
                  ))}
                </datalist>
              </div>

              {/* Student-specific fields */}
              {user.role === 'student' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      School Name
                    </label>
                    <input
                      type="text"
                      value={formData.schoolName}
                      onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Grade Level
                    </label>
                    <input
                      type="number"
                      min="7"
                      max="12"
                      value={formData.gradeLevel}
                      onChange={(e) => setFormData({ ...formData, gradeLevel: e.target.value })}
                      className="input-field"
                    />
                  </div>
                </>
              )}

              {/* Counselor-specific fields */}
              {user.role === 'counselor' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Qualification
                    </label>
                    <input
                      type="text"
                      value={formData.qualification}
                      onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                      className="input-field"
                      placeholder="e.g., BSc in Psychology"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Years of Experience
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.yearsOfExperience}
                        onChange={(e) => setFormData({ ...formData, yearsOfExperience: e.target.value })}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Industry/Specialty
                      </label>
                      <input
                        type="text"
                        value={formData.industrySpecialty}
                        onChange={(e) => setFormData({ ...formData, industrySpecialty: e.target.value })}
                        className="input-field"
                        placeholder="e.g., Career Counseling"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Organization/School
                    </label>
                    <input
                      type="text"
                      value={formData.organization}
                      onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                      className="input-field"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bio
                </label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="input-field"
                  rows="4"
                  placeholder="Tell us about yourself..."
                />
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex items-center space-x-2"
                >
                  <Save className="w-5 h-5" />
                  <span>{loading ? 'Saving...' : 'Save Changes'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.history.back()}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
