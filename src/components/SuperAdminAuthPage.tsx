import React, { useState } from 'react';
import { UserProfile } from '../types';
import { loginWithEmail, signUpWithEmail, checkUserExistsInAuth } from '../services/authService';
import { EmailVerificationModal } from './EmailVerificationModal';
import {
  Crown,
  Shield,
  Lock,
  Mail,
  User,
  Building,
  CheckCircle2,
  ArrowLeft,
  KeyRound,
  ShieldCheck,
  AlertCircle,
  Clock,
} from 'lucide-react';

interface SuperAdminAuthPageProps {
  onSelectProfile: (profile: UserProfile) => void;
  onReturnToStandardAuth: () => void;
}

export const SuperAdminAuthPage: React.FC<SuperAdminAuthPageProps> = ({
  onSelectProfile,
  onReturnToStandardAuth,
}) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('Institutional Head Office');
  const [designation, setDesignation] = useState('Principal & Institutional Head');
  const [errorMsg, setErrorMsg] = useState('');
  const [emailError, setEmailError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [createdProfile, setCreatedProfile] = useState<UserProfile | null>(null);

  const handleSuperAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const { profile: matched } = await loginWithEmail(email, password);
      
      // Ensure user has superadmin role or seed superadmin email
      if (matched.role !== 'superadmin' && matched.email.toLowerCase() !== 'superadmin@tcetmumbai.in') {
        setErrorMsg('Access Restricted: This portal is exclusively for Super Admin / Principal accounts. Standard staff should sign in on the main portal.');
        setLoading(false);
        return;
      }

      onSelectProfile(matched);
      setSuccessMsg(`Authenticated successfully as Super Admin: ${matched.name}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Super Admin authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSuperAdminRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setEmailError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const { profile: newProfile } = await signUpWithEmail(email, password, {
        name,
        email,
        role: 'superadmin',
        rollNo: 'SA-01',
        erpNo: 'ERP-SA-001',
        department: department || 'Institutional Head Office',
        division: 'A',
        academicBatch: '2023-2027',
      });

      setCreatedProfile(newProfile);
      setShowVerifyModal(true);
      setSuccessMsg(
        `Super Admin request submitted for ${newProfile.name}! A 6-digit verification code has been dispatched to ${email} via Resend Email Service.`
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit Super Admin registration request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center px-4 py-8 relative">
      {/* Background Decorative Lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-96 bg-indigo-600/10 blur-3xl pointer-events-none rounded-full" />

      {/* Return Navigation Button */}
      <div className="w-full max-w-xl mb-4 flex items-center justify-between">
        <button
          onClick={onReturnToStandardAuth}
          className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 px-3.5 py-2 rounded-xl transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Student & Staff Portal
        </button>
        <span className="text-[11px] font-bold text-indigo-400 bg-indigo-950/80 border border-indigo-800/80 px-3 py-1 rounded-full flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" /> Super Admin Portal
        </span>
      </div>

      <div className="w-full max-w-xl bg-slate-800/90 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-md">
        {/* Header Branding Banner */}
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 p-6 text-center border-b border-slate-700 relative">
          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-violet-500 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg mb-3 border border-indigo-400/30">
            <Crown className="w-8 h-8 text-amber-300" />
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">
            TCET Super Admin & Principal Portal
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
            Thakur College of Engineering & Technology (Autonomous)
            <br />
            Institutional Head Office & Super Admin Decision Queue
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="p-6">
          <div className="flex bg-slate-900/80 p-1 rounded-2xl border border-slate-700/80 mb-6">
            <button
              onClick={() => {
                setTab('login');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                tab === 'login'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <KeyRound className="w-4 h-4" /> Super Admin Sign In
            </button>
            <button
              onClick={() => {
                setTab('register');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                tab === 'register'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Crown className="w-4 h-4 text-amber-300" /> Request Super Admin Account
            </button>
          </div>

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="mb-4 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs p-3.5 rounded-xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs p-3.5 rounded-xl flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{successMsg}</div>
            </div>
          )}

          {/* TAB 1: SIGN IN FORM */}
          {tab === 'login' && (
            <form onSubmit={handleSuperAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Super Admin Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    placeholder="superadmin@tcetmumbai.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-xl pl-9 pr-3 py-2.5 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    placeholder="super1234"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-xl pl-9 pr-3 py-2.5 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                {loading ? 'Authenticating...' : 'Sign In as Super Admin'}
              </button>
            </form>
          )}

          {/* TAB 2: REGISTER / APPLICATION FORM */}
          {tab === 'register' && (
            <form onSubmit={handleSuperAdminRegister} className="space-y-4">
              <div className="bg-amber-950/40 border border-amber-800/60 rounded-2xl p-3 text-[11px] text-amber-200 flex items-start gap-2">
                <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Note:</strong> New Super Admin applications are routed to the Super Admin Whitelist Decision Queue. An active Super Admin must approve your request before access is granted.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Full Name & Title
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. B. K. Mishra (Principal)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-xl pl-9 pr-3 py-2.5 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Official Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="principal@tcetmumbai.in"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError('');
                    }}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-xl p-2.5 text-xs focus:outline-none focus:border-indigo-500"
                  />
                  {emailError && (
                    <p className="text-red-500 text-xs mt-1 font-medium">{emailError}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Password (min 6 characters)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-xl p-2.5 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Department / Office
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="Institutional Head Office"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-xl pl-9 pr-3 py-2.5 text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Designation
                  </label>
                  <select
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-xl p-2.5 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Principal & Institutional Head">Principal & Institutional Head</option>
                    <option value="Vice Principal">Vice Principal</option>
                    <option value="Dean Academics">Dean Academics</option>
                    <option value="Head of Department (HOD)">Head of Department (HOD)</option>
                    <option value="Controller of Examinations">Controller of Examinations</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                {loading ? 'Submitting Application...' : 'Submit Super Admin Application Request'}
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
          setSuccessMsg(`Email address ${email} verified successfully via Resend Email Service! Request is pending Whitelist approval.`);
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
