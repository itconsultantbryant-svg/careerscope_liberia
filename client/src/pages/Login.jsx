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
  email: z.string().email().optional().or(z.literal('')),
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
  phone: z.string().trim().regex(/^(?:(?:077|088)\d{7}|\+[1-9]\d{7,14})$/, 'Use a Liberian number or international format, e.g. +231…'),
  email: z.string().email().optional().or(z.literal('')),
  county: z.string().min(1, 'County is required'),
  country: z.string().min(1, 'Country is required'),
  schoolName: z.string().min(1, 'School name is required'),
  gradeLevel: z.number().min(7).max(12),
  dreamCareers: z.array(z.number()).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
});


const counties = [
  'Montserrado', 'Grand Bassa', 'Lofa', 'Nimba', 'Bong', 'Grand Cape Mount',
  'Grand Gedeh', 'Grand Kru', 'Gbarpolu', 'Margibi', 'Maryland', 'River Cess',
  'River Gee', 'Sinoe', 'Bomi'
];

export default function Login() {
  const [activeTab, setActiveTab] = useState('login');
  const [loginRole, setLoginRole] = useState('student');
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { role: 'student' },
  });

  const studentForm = useForm({
    resolver: zodResolver(studentSchema),
    defaultValues: { gradeLevel: 7, dreamCareers: [], country: 'Liberia' },
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
                <div className="grid grid-cols-3 gap-2 mb-6" role="group" aria-label="Choose account type">
                  {['student', 'counselor', 'admin'].map((role) => (
                    <button
                      key={role}
                      onClick={() => setLoginRole(role)}
                      type="button"
                      aria-pressed={loginRole === role}
                      className={`min-h-11 px-2 py-2 rounded-lg font-medium capitalize ${
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
                    {loginForm.formState.errors.email && <p role="alert" className="text-red-600 text-sm mt-1">{loginForm.formState.errors.email.message}</p>}
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
                
                <div className="mb-6 rounded-lg bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800">
                  Student registration is available here. Counselors are created by admins and receive login credentials.
                </div>

                {/* Student Registration */}
                <form onSubmit={studentForm.handleSubmit(onStudentRegister, (errors) => toast.error(Object.values(errors)[0]?.message || 'Please check the registration fields'))} className="space-y-4">
                  <div>
                    <label htmlFor="registration-country" className="block text-sm font-medium text-gray-700 mb-2">Country *</label>
                    <input id="registration-country" {...studentForm.register('country')} autoComplete="country-name" className="input-field" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      Phone Number * (local or +country code)
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
                      State / County *
                    </label>
                    <input {...studentForm.register('county')} list="registration-counties" autoComplete="address-level1" placeholder="State or county" className="input-field" />
                    <datalist id="registration-counties">
                      {counties.map((county) => (
                        <option key={county} value={county}>{county}</option>
                      ))}
                    </datalist>
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
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <Footer />
    </div>
  );
}
