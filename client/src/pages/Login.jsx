import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const loginSchema = z.object({
  phone: z.string().optional(),
  email: z.string().email().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['student', 'counselor', 'admin']),
}).refine((data) => data.phone || data.email, {
  message: 'Either phone or email is required',
  path: ['phone'],
});

const studentSchema = z.object({
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  phone: z.string().regex(/^(077|088)\d{7}$/, 'Invalid Liberian phone number (077xxxxxx or 088xxxxxx)'),
  email: z.string().email().optional().or(z.literal('')),
  county: z.string().min(1, 'County is required'),
  schoolName: z.string().min(1, 'School name is required'),
  gradeLevel: z.number().min(7).max(12),
  dreamCareers: z.array(z.number()).optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const counselorSchema = z.object({
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  phone: z.string().regex(/^(077|088)\d{7}$/, 'Invalid Liberian phone number'),
  email: z.string().email().optional().or(z.literal('')),
  county: z.string().min(1, 'County is required'),
  qualification: z.string().optional(),
  yearsOfExperience: z.number().optional(),
  industrySpecialty: z.string().optional(),
  organization: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const counties = [
  'Montserrado', 'Grand Bassa', 'Lofa', 'Nimba', 'Bong', 'Grand Cape Mount',
  'Grand Gedeh', 'Grand Kru', 'Gbarpolu', 'Margibi', 'Maryland', 'River Cess',
  'River Gee', 'Sinoe', 'Bomi'
];

export default function Login() {
  const [activeTab, setActiveTab] = useState('login');
  const [loginRole, setLoginRole] = useState('student');
  const [registerRole, setRegisterRole] = useState('student');
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { role: 'student' },
  });

  const studentForm = useForm({
    resolver: zodResolver(studentSchema),
    defaultValues: { gradeLevel: 7, dreamCareers: [] },
  });

  const counselorForm = useForm({
    resolver: zodResolver(counselorSchema),
  });

  const onLogin = async (data) => {
    const result = await login({ ...data, role: loginRole });
    if (result.success) {
      toast.success('Login successful!');
      navigate(`/${result.data.user.role}/dashboard`);
    } else {
      toast.error(result.error);
    }
  };

  const onStudentRegister = async (data) => {
    const result = await register(data, 'student');
    if (result.success) {
      toast.success('Registration successful! Please login.');
      setActiveTab('login');
    } else {
      toast.error(result.error);
    }
  };

  const onCounselorRegister = async (data) => {
    const result = await register(data, 'counselor');
    if (result.success) {
      toast.success('Registration submitted! Awaiting admin approval.');
      setActiveTab('login');
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-50">
      <Navbar />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl overflow-hidden"
        >
          {/* Tabs */}
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('login')}
              className={`flex-1 py-4 px-6 font-semibold ${
                activeTab === 'login'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-600 hover:text-primary-600'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setActiveTab('register')}
              className={`flex-1 py-4 px-6 font-semibold ${
                activeTab === 'register'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-600 hover:text-primary-600'
              }`}
            >
              Register
            </button>
          </div>

          <div className="p-8">
            {activeTab === 'login' ? (
              <div>
                <div className="flex flex-col items-center mb-6">
                  <img 
                    src="/assets/careerscope_logo.jpeg" 
                    alt="CareerScope Logo" 
                    className="h-16 w-auto mb-4 object-contain"
                    style={{ display: 'block', maxHeight: '64px' }}
                    onError={(e) => {
                      console.error('Failed to load logo image');
                      e.target.style.display = 'none';
                    }}
                  />
                  <h2 className="text-2xl font-bold">Login to CareerScope</h2>
                </div>
                
                {/* Role Selection */}
                <div className="flex space-x-4 mb-6">
                  {['student', 'counselor', 'admin'].map((role) => (
                    <button
                      key={role}
                      onClick={() => setLoginRole(role)}
                      className={`px-4 py-2 rounded-lg font-medium capitalize ${
                        loginRole === role
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>

                <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      {...loginForm.register('phone')}
                      type="tel"
                      placeholder="077xxxxxx or 088xxxxxx"
                      className="input-field"
                    />
                    {loginForm.formState.errors.phone && (
                      <p className="text-red-500 text-sm mt-1">
                        {loginForm.formState.errors.phone.message}
                      </p>
                    )}
                  </div>

                  <div className="text-center text-gray-500">OR</div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      {...loginForm.register('email')}
                      type="email"
                      placeholder="your@email.com"
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password
                    </label>
                    <input
                      {...loginForm.register('password')}
                      type="password"
                      className="input-field"
                    />
                    {loginForm.formState.errors.password && (
                      <p className="text-red-500 text-sm mt-1">
                        {loginForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>

                  <button type="submit" className="btn-primary w-full">
                    Login
                  </button>
                </form>
              </div>
            ) : (
              <div>
                <div className="flex flex-col items-center mb-6">
                  <img 
                    src="/assets/careerscope_logo.jpeg" 
                    alt="CareerScope Logo" 
                    className="h-16 w-auto mb-4 object-contain"
                    style={{ display: 'block', maxHeight: '64px' }}
                    onError={(e) => {
                      console.error('Failed to load logo image');
                      e.target.style.display = 'none';
                    }}
                  />
                  <h2 className="text-2xl font-bold">Create Account</h2>
                </div>
                
                <div className="flex space-x-4 mb-6">
                  <button
                    type="button"
                    onClick={() => setRegisterRole('student')}
                    className={`px-4 py-2 rounded-lg font-medium ${
                      registerRole === 'student'
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Student
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegisterRole('counselor')}
                    className={`px-4 py-2 rounded-lg font-medium ${
                      registerRole === 'counselor'
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Counselor
                  </button>
                </div>

                {/* Student Registration */}
                {registerRole === 'student' && (
                <form onSubmit={studentForm.handleSubmit(onStudentRegister)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        First Name *
                      </label>
                      <input {...studentForm.register('firstName')} className="input-field" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Last Name *
                      </label>
                      <input {...studentForm.register('lastName')} className="input-field" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number * (077xxxxxx or 088xxxxxx)
                    </label>
                    <input {...studentForm.register('phone')} className="input-field" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email (Optional)
                    </label>
                    <input {...studentForm.register('email')} type="email" className="input-field" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      County *
                    </label>
                    <select {...studentForm.register('county')} className="input-field">
                      <option value="">Select County</option>
                      {counties.map((county) => (
                        <option key={county} value={county}>{county}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      School Name *
                    </label>
                    <input {...studentForm.register('schoolName')} className="input-field" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Grade Level *
                    </label>
                    <input
                      {...studentForm.register('gradeLevel', { 
                        valueAsNumber: true,
                        setValueAs: (v) => v === '' ? undefined : Number(v)
                      })}
                      type="number"
                      min="7"
                      max="12"
                      className="input-field"
                      defaultValue={7}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password *
                    </label>
                    <input
                      {...studentForm.register('password')}
                      type="password"
                      className="input-field"
                    />
                  </div>

                  <button type="submit" className="btn-primary w-full">
                    Register as Student
                  </button>
                </form>
                )}

                {/* Counselor Registration */}
                {registerRole === 'counselor' && (
                <form onSubmit={counselorForm.handleSubmit(onCounselorRegister)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        First Name *
                      </label>
                      <input {...counselorForm.register('firstName')} className="input-field" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Last Name *
                      </label>
                      <input {...counselorForm.register('lastName')} className="input-field" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number * (077xxxxxx or 088xxxxxx)
                    </label>
                    <input {...counselorForm.register('phone')} className="input-field" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email (Optional)
                    </label>
                    <input {...counselorForm.register('email')} type="email" className="input-field" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      County *
                    </label>
                    <select {...counselorForm.register('county')} className="input-field">
                      <option value="">Select County</option>
                      {counties.map((county) => (
                        <option key={county} value={county}>{county}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Qualification
                    </label>
                    <input {...counselorForm.register('qualification')} className="input-field" placeholder="e.g., BSc in Psychology" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Years of Experience
                    </label>
                    <input
                      {...counselorForm.register('yearsOfExperience', { 
                        valueAsNumber: true,
                        setValueAs: (v) => v === '' ? undefined : Number(v)
                      })}
                      type="number"
                      min="0"
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Industry/Specialty
                    </label>
                    <input {...counselorForm.register('industrySpecialty')} className="input-field" placeholder="e.g., Career Counseling, Education" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Organization/School
                    </label>
                    <input {...counselorForm.register('organization')} className="input-field" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password *
                    </label>
                    <input
                      {...counselorForm.register('password')}
                      type="password"
                      className="input-field"
                    />
                  </div>

                  <button type="submit" className="btn-primary w-full">
                    Register as Counselor
                  </button>
                </form>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <Footer />
    </div>
  );
}

