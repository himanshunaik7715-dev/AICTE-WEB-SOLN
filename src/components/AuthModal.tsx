import React, { useState } from 'react';
import { UserProfile, UserRole } from '../types';
import { loginWithEmail, signUpWithEmail, loginWithGoogle, checkUserExistsInAuth } from '../services/authService';
import { EmailVerificationModal } from './EmailVerificationModal';
import {
  X,
  Lock,
  Mail,
  CheckCircle2,
  KeyRound,
} from 'lucide-react';

interface AuthModalProps {
  activeProfile: UserProfile;
  onSelectProfile: (profile: UserProfile) => void;
  onClose: () => void;
  onReseedDatabase: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  activeProfile,
  onSelectProfile,
  onClose,
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
  const [tgmName, setTgmName] = useState('Prof. S. K. Mehta (TGM)');
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
      setSuccessMsg(`Signed in as ${matched.name} (${matched.email})`);
      setTimeout(() => onClose(), 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please check your credentials.');
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
        erpNo: erpNo || '2023999999',
        department,
        division,
        academicBatch: '2023-2027',
        tgmName,
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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl text-white flex items-center justify-center font-bold shadow-xs">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                TCET AICTE Activity Portal
              </h3>
              <p className="text-xs text-slate-500">
                Thakur College of Engineering & Technology (Autonomous)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex items-center gap-2">
          <button
            onClick={() => setTab('login')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              tab === 'login'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Sign In (Email/Google)
          </button>
          <button
            onClick={() => setTab('register')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              tab === 'register'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Register Profile
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
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

          {tab === 'login' && (
            <form onSubmit={handleCustomLogin} className="space-y-3">
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
                    className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
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
                    className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
              >
                {loading ? 'Authenticating...' : 'Sign In'}
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
                onClick={async () => {
                  setErrorMsg('');
                  setLoading(true);
                  try {
                    const { profile } = await loginWithGoogle();
                    onSelectProfile(profile);
                    setSuccessMsg(`Logged in as ${profile.name}`);
                    setTimeout(() => onClose(), 1000);
                  } catch (err: any) {
                    setErrorMsg(err.message || 'Google Sign-In failed');
                  } finally {
                    setLoading(false);
                  }
                }}
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
            </form>
          )}

          {tab === 'register' && (
            <form onSubmit={handleCustomRegister} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Amit Patel"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2 text-xs text-slate-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Role</label>
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
                    className="w-full border border-slate-200 rounded-xl p-2 text-xs text-slate-900 focus:outline-none font-medium"
                  >
                    <option value="student">Student</option>
                    <option value="cr">Class Representative (CR)</option>
                    <option value="admin">Teacher / TGM (Requires Super Admin Approval)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">TCET Email</label>
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
                    {role === 'admin' || role === 'superadmin' ? 'Faculty ID / Employee ID' : 'Roll No (Simple number)'}
                  </label>
                  <input
                    type="text"
                    placeholder={role === 'admin' || role === 'superadmin' ? 'e.g. FAC-102' : 'e.g. 1, 2, 3...'}
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

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Select TGM Mentor</label>
                <select
                  value={tgmName}
                  onChange={(e) => setTgmName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2 text-xs text-slate-900 focus:outline-none bg-white font-medium"
                >
                  <option value="Prof. S. K. Mehta (Senior TGM)">Prof. S. K. Mehta (Senior TGM)</option>
                  <option value="Dr. Rajesh Patel (AICTE Head)">Dr. Rajesh Patel (AICTE Head)</option>
                  <option value="Rahul Sharma (TGM)">Rahul Sharma (TGM)</option>
                  <option value="Prof. Archana Salve (TGM)">Prof. Archana Salve (TGM)</option>
                  <option value="Prof. Nilesh Rana (TGM)">Prof. Nilesh Rana (TGM)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
              >
                {loading ? 'Registering...' : 'Create Account & Firestore Profile'}
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
            onClose();
          } else {
            setTab('login');
          }
        }}
      />
    </div>
  );
};
