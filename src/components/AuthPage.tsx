import React, { useState } from 'react';
import { UserProfile, UserRole } from '../types';
import { loginWithEmail, signUpWithEmail, loginWithGoogle, checkUserExistsInAuth } from '../services/authService';
import { EmailVerificationModal } from './EmailVerificationModal';
import {
  Lock,
  Mail,
  Shield,
  GraduationCap,
  CheckCircle2,
  KeyRound,
  ArrowRight,
  School,
  FileCheck2,
  MailCheck,
} from 'lucide-react';

interface AuthPageProps {
  activeProfile: UserProfile;
  onSelectProfile: (profile: UserProfile) => void;
  onReseedDatabase: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  activeProfile,
  onSelectProfile,
  onReseedDatabase,
}) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [rollNo, setRollNo] = useState('');
  const [erpNo, setErpNo] = useState('');
  const [department, setDepartment] = useState('Internet of Things (IoT)');
  const [division, setDivision] = useState('A');
  const [errorMsg, setErrorMsg] = useState('');
  const [emailError, setEmailError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [createdProfile, setCreatedProfile] = useState<UserProfile | null>(null);

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const { profile: matched } = await loginWithEmail(email, password);
      onSelectProfile(matched);
      setSuccessMsg(`Logged in successfully as ${matched.name}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const { profile } = await loginWithGoogle();
      onSelectProfile(profile);
      setSuccessMsg(`Signed in with Google as ${profile.name}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Google Sign-In cancelled or failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setEmailError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const { profile: newProfile } = await signUpWithEmail(email, password, {
        name,
        email,
        role,
        rollNo: rollNo || (role === 'admin' || role === 'superadmin' ? 'FAC-101' : '8'),
        erpNo: erpNo || '2023019999',
        department,
        division,
        academicBatch: '2023-2027',
      });

      setCreatedProfile(newProfile);
      setShowVerifyModal(true);
      setSuccessMsg(
        `Account created for ${newProfile.name}! A 6-digit verification code has been dispatched to ${email} via Resend Email Service.`
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-12">
        {/* Left Side: TCET Branding Banner */}
        <div className="md:col-span-5 bg-gradient-to-br from-indigo-900 via-indigo-850 to-slate-950 p-8 text-white flex flex-col justify-between relative overflow-hidden">
          {/* Subtle Ambient Background Decorative Shapes */}
          <div className="absolute -right-12 -top-12 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -left-12 -bottom-12 w-40 h-40 bg-indigo-400/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 space-y-6">
            <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shadow-inner">
              <GraduationCap className="w-7 h-7 text-indigo-300" />
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/20 px-3 py-1 rounded-full border border-indigo-400/20 inline-block">
                AICTE Activity Portal
              </span>
              <h2 className="text-2xl font-bold leading-tight tracking-tight text-white">
                Thakur College of Engineering & Technology
              </h2>
              <p className="text-xs text-indigo-200/80 leading-relaxed">
                Autonomous Institute Affiliated to University of Mumbai
              </p>
            </div>
          </div>

          <div className="relative z-10 pt-6">
            <p className="text-[11px] text-indigo-300/60 font-medium">
              Autonomous Student Activity Management System
            </p>
          </div>
        </div>

        {/* Right Side: Authentication Forms */}
        <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-6">
          {/* Form Tabs */}
          <div className="flex items-center gap-2 bg-slate-100/80 p-1 rounded-2xl border border-slate-200/80">
            <button
              onClick={() => setTab('login')}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                tab === 'login'
                  ? 'bg-white text-indigo-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setTab('register')}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                tab === 'register'
                  ? 'bg-white text-indigo-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Alert Messages */}
          {errorMsg && (
            <div className="bg-rose-50 text-rose-700 p-3 rounded-xl border border-rose-100 text-xs font-medium">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl border border-emerald-100 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {successMsg}
            </div>
          )}

          {/* TAB 1: LOGIN */}
          {tab === 'login' && (
            <form onSubmit={handleCustomLogin} className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Welcome Back</h3>
                <p className="text-xs text-slate-500">Sign in with your TCET student or teacher account</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. 1032230434@tcetmumbai.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Password</label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="relative my-3">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-2 text-slate-400">or</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={loading}
                  className="w-full py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  Sign in with Google
                </button>

              </div>
            </form>
          )}

          {/* TAB 2: REGISTER */}
          {tab === 'register' && (
            <form onSubmit={handleCustomRegister} className="space-y-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Create Account</h3>
                <p className="text-xs text-slate-500">Register profile in Supabase Database</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Priyanshu Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2 text-xs text-slate-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Role / Account Type</label>
                  <select
                    value={role}
                    onChange={(e) => {
                      const newRole = e.target.value as UserRole;
                      setRole(newRole);
                      if (newRole === 'admin' || newRole === 'superadmin') {
                        if (!rollNo || /^\d+$/.test(rollNo)) {
                          setRollNo('FAC-101');
                        }
                      } else {
                        if (rollNo.startsWith('FAC-') || rollNo.startsWith('TGM-') || rollNo === 'SA-01') {
                          setRollNo('');
                        }
                      }
                    }}
                    className="w-full border border-slate-200 rounded-xl p-2 text-xs text-slate-900 focus:outline-none"
                  >
                    <option value="student">Student</option>
                    <option value="cr">Class Representative (CR)</option>
                    <option value="admin">Teacher / TGM (Requires Super Admin Approval)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    placeholder="student@tcetmumbai.in"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError('');
                    }}
                    className="w-full border border-slate-200 rounded-xl p-2 text-xs text-slate-900 focus:outline-none"
                  />
                  {emailError && (
                    <p className="text-red-600 text-xs mt-1 font-medium">{emailError}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Password (min 6 characters)</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2 text-xs text-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    {role === 'admin' || role === 'superadmin' ? 'Faculty ID / Employee ID' : 'Roll No (1, 2, 3...)'}
                  </label>
                  <input
                    type="text"
                    placeholder={role === 'admin' || role === 'superadmin' ? 'e.g. FAC-102' : 'e.g. 1'}
                    value={rollNo}
                    onChange={(e) => setRollNo(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2 text-xs text-slate-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">ERP No</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2023011245"
                    value={erpNo}
                    onChange={(e) => setErpNo(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2 text-xs text-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Department</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2 text-xs text-slate-900 focus:outline-none bg-white font-medium cursor-pointer"
                >
                  <option value="Internet of Things (IoT)">Internet of Things (IoT)</option>
                  <option value="Computer Science and Engineering (IoT)">Computer Science and Engineering (IoT)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors mt-2 cursor-pointer"
              >
                {loading ? 'Creating Account...' : 'Sign Up & Create Profile'}
              </button>
            </form>
          )}
        </div>
      </div>

      <EmailVerificationModal
        isOpen={showVerifyModal}
        email={email}
        name={name}
        onClose={() => setShowVerifyModal(false)}
        onVerified={() => {
          setShowVerifyModal(false);
          setSuccessMsg(`Email address ${email} verified successfully via Resend Email Service!`);
          if (createdProfile) {
            onSelectProfile(createdProfile);
          } else {
            setTab('login');
          }
        }}
      />
    </div>
  );
};
