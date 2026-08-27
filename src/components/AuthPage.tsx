import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { UserProfile, UserRole } from '../types';
import {
  loginWithGoogle,
  completeGoogleSignUp,
  loginWithManualCredentials,
  registerClubHeadAccount,
} from '../services/authService';
import { StudentProfileSetup } from './StudentProfileSetup';
import {
  GraduationCap,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Award,
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  Building,
  ShieldAlert,
} from 'lucide-react';

interface AuthPageProps {
  activeProfile: UserProfile;
  allUsers?: UserProfile[];
  onSelectProfile: (profile: UserProfile) => void;
  /** Role pre-selected from the Role Selection screen */
  preselectedRole?: 'student' | 'cr' | 'admin';
  /** Go back to the role selection screen */
  onBackToRoleSelection?: () => void;
}

// Role-specific copy
const ROLE_META: Record<
  'student' | 'cr' | 'admin',
  { label: string; icon: React.ReactNode; color: string; gradient: string }
> = {
  student: {
    label: 'Student',
    icon: <GraduationCap className="w-5 h-5" />,
    color: 'text-indigo-400',
    gradient: 'from-indigo-600 to-violet-600',
  },
  admin: {
    label: 'Teacher / Mentor (TGM)',
    icon: <BookOpen className="w-5 h-5" />,
    color: 'text-emerald-400',
    gradient: 'from-emerald-600 to-teal-600',
  },
  cr: {
    label: 'CR / Club Head',
    icon: <Award className="w-5 h-5" />,
    color: 'text-rose-400',
    gradient: 'from-rose-600 to-pink-600',
  },
};

export const AuthPage: React.FC<AuthPageProps> = ({
  activeProfile,
  allUsers = [],
  onSelectProfile,
  preselectedRole,
  onBackToRoleSelection,
}) => {
  const [step, setStep] = useState<'login' | 'onboarding'>('login');
  const [crTab, setCrTab] = useState<'signin' | 'register'>('signin');

  // CR Manual Login States
  const [crEmail, setCrEmail] = useState('');
  const [crPassword, setCrPassword] = useState('');
  const [showCrPassword, setShowCrPassword] = useState(false);

  // Club Head Registration States
  const [regClubName, setRegClubName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regShowPassword, setRegShowPassword] = useState(false);
  const [regDept, setRegDept] = useState('Internet of Things (IoT)');

  // Onboarding Data (for Google Users)
  const [onboardingEmail, setOnboardingEmail] = useState('');
  const [onboardingName, setOnboardingName] = useState('');
  const [existingProfile, setExistingProfile] = useState<UserProfile | undefined>();
  const [role, setRole] = useState<UserRole>(preselectedRole || 'student');
  const [rollNo, setRollNo] = useState('');
  const [erpNo, setErpNo] = useState('');
  const [department, setDepartment] = useState('Internet of Things (IoT)');
  const [division, setDivision] = useState('A');
  const [customRole, setCustomRole] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const roleMeta = ROLE_META[preselectedRole || 'student'];
  const isCR = preselectedRole === 'cr';

  // Handler for Google Success (Students & TGMs)
  const handleGoogleSuccess = async (credentialResponse: any) => {
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);
    try {
      if (!credentialResponse.credential) throw new Error('No credential received.');
      const result = await loginWithGoogle(credentialResponse.credential);

      if (result.profileNeeded === false) {
        onSelectProfile(result.profile);
        setSuccessMsg(`Signed in with Google as ${result.profile.name}`);
      } else {
        setOnboardingEmail(result.email);
        setOnboardingName(result.name);
        setExistingProfile(result.existingProfile);
        if (preselectedRole) setRole(preselectedRole);
        setStep('onboarding');
        setSuccessMsg('Google authentication successful! Please complete your profile to continue.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Google Sign-In failed.');
    } finally {
      setLoading(false);
    }
  };

  // Handler for Manual CR / Club Head Sign In
  const handleCrManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const profile = await loginWithManualCredentials(crEmail, crPassword, 'cr', allUsers);
      setSuccessMsg(`Authenticated successfully as ${profile.customRole || profile.name}!`);
      setTimeout(() => {
        onSelectProfile(profile);
      }, 600);
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  // Handler for Registering a New Club Head
  const handleRegisterClubHead = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const newProfile = await registerClubHeadAccount({
        clubName: regClubName,
        email: regEmail,
        password: regPassword,
        department: regDept,
      });

      setSuccessMsg(
        `Registration submitted for "${newProfile.name}"! Your account has been sent to the Superadmin waitlist. Once approved, you can sign in with your credentials.`
      );
      setRegClubName('');
      setRegEmail('');
      setRegPassword('');
      setCrTab('signin');
      setCrEmail(newProfile.email);
    } catch (err: any) {
      setErrorMsg(err.message || 'Club Head registration failed.');
    } finally {
      setLoading(false);
    }
  };

  // Handler for Onboarding Form Submit
  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const newProfile = await completeGoogleSignUp(onboardingEmail, onboardingName, {
        role,
        rollNo: rollNo || (role === 'admin' || role === 'superadmin' ? 'FAC-101' : '8'),
        erpNo: erpNo || '2023019999',
        department,
        division,
        academicBatch: '2023-2027',
        customRole: role === 'cr' && customRole.trim() ? customRole.trim() : undefined,
      });

      onSelectProfile(newProfile);
      setSuccessMsg(`Profile created successfully for ${newProfile.name}!`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Profile creation failed.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'onboarding' && (preselectedRole === 'student' || role === 'student')) {
    return (
      <StudentProfileSetup
        email={onboardingEmail}
        name={onboardingName}
        existingProfile={existingProfile}
        onComplete={(profile) => {
          onSelectProfile(profile);
        }}
        onBack={() => {
          setStep('login');
          setExistingProfile(undefined);
        }}
      />
    );
  }

  return (
    <div className="min-h-[85dvh] flex items-center justify-center p-3 sm:p-4">
      <div className="max-w-4xl w-full bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-12">
        {/* Left Side: TCET Branding Banner */}
        <div className="md:col-span-5 bg-gradient-to-br from-indigo-900 via-indigo-850 to-slate-950 p-5 sm:p-8 text-white flex flex-col justify-between relative overflow-hidden">
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
                Thakur College of Engineering &amp; Technology
              </h2>
              <p className="text-xs text-indigo-200/80 leading-relaxed">
                It is an independent, degree-granting Deemed-to-be University.
              </p>
            </div>

            {/* Role badge */}
            {preselectedRole && (
              <div
                className={`flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2 border border-white/10 text-xs font-semibold ${roleMeta.color}`}
              >
                {roleMeta.icon}
                Signing in as: {roleMeta.label}
              </div>
            )}

            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2 text-[11px] text-indigo-200/70">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                Restricted to @tcetmumbai.in accounts
              </div>
              <div className="flex items-center gap-2 text-[11px] text-indigo-200/70">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                CRs &amp; Club Heads require Super Admin approval
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-6">
            <p className="text-[11px] text-indigo-300/60 font-medium">
              Autonomous Student Activity Management System
            </p>
          </div>
        </div>

        {/* Right Side: Authentication / Registration Forms */}
        <div className="min-w-0 md:col-span-7 p-4 sm:p-8 flex flex-col justify-center space-y-5">
          {/* Back to role selection */}
          {onBackToRoleSelection && (
            <button
              onClick={onBackToRoleSelection}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer w-fit"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Change role
            </button>
          )}

          {errorMsg && (
            <div className="bg-rose-50 text-rose-700 p-3 rounded-xl border border-rose-100 text-xs font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMsg}</div>
            </div>
          )}
          {successMsg && (
            <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl border border-emerald-100 text-xs font-medium flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{successMsg}</div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* CR / CLUB HEAD MANUAL CREDENTIAL SECTION (No Google Login)        */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {isCR && step === 'login' && (
            <div className="space-y-5">
              {/* Tab Selector: Sign In vs Register Club Head */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setCrTab('signin');
                    setErrorMsg('');
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    crTab === 'signin'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  CR / Club Head Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCrTab('register');
                    setErrorMsg('');
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    crTab === 'register'
                      ? 'bg-white text-rose-600 shadow-xs border border-slate-200'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Register Club Head
                </button>
              </div>

              {/* TAB 1: MANUAL SIGN IN */}
              {crTab === 'signin' && (
                <form onSubmit={handleCrManualLogin} className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">CR / Club Head Manual Login</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Enter your manual credentials to access Stage-1 Verification. Only{' '}
                      <strong>@tcetmumbai.in</strong> accounts are allowed.
                    </p>
                  </div>

                  {/* Manual Login Email */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">Email ID</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        type="email"
                        required
                        placeholder="cr@tcetmumbai.in"
                        value={crEmail}
                        onChange={(e) => setCrEmail(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                      />
                    </div>
                  </div>

                  {/* Manual Login Password */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        type={showCrPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••••••"
                        value={crPassword}
                        onChange={(e) => setCrPassword(e.target.value)}
                        className="w-full pl-9 pr-10 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowCrPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showCrPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {loading ? 'Authenticating...' : 'Sign In as CR / Club Head'}
                    <LogIn className="w-4 h-4" />
                  </button>

                </form>
              )}

              {/* TAB 2: REGISTER CLUB HEAD (Sent to Waitlist for Superadmin Approval) */}
              {crTab === 'register' && (
                <form onSubmit={handleRegisterClubHead} className="space-y-3.5">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Request Club Head Role</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Create your Club Head account. Your request will be sent to the Superadmin and placed on the waitlist for approval.
                    </p>
                  </div>

                  {/* Club Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Club Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. ACM Student Chapter, NSS Head, Cultural Secretary"
                        value={regClubName}
                        onChange={(e) => setRegClubName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                      />
                    </div>
                  </div>

                  {/* Official Email */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Official Email (must end with @tcetmumbai.in) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        type="email"
                        required
                        placeholder="acmhead@tcetmumbai.in"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        type={regShowPassword ? 'text' : 'password'}
                        required
                        placeholder="Set a password for manual login"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="w-full pl-9 pr-10 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setRegShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {regShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Department */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">Department</label>
                    <select
                      value={regDept}
                      onChange={(e) => setRegDept(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl p-2 text-xs text-slate-900 focus:outline-none bg-white focus:ring-2 focus:ring-rose-500/20"
                    >
                      <option value="Internet of Things (IoT)">Internet of Things (IoT)</option>
                      <option value="Computer Science">Computer Science</option>
                      <option value="Mechanical Engineering">Mechanical Engineering</option>
                      <option value="Civil Engineering">Civil Engineering</option>
                      <option value="Electronics Engineering">Electronics Engineering</option>
                      <option value="Institutional Head Office">Institutional Head Office</option>
                    </select>
                  </div>

                  {/* Superadmin Waitlist Warning */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800 flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>⚠️ Approval Required:</strong> Your request to register as a Club Head will be sent to the <strong>Superadmin</strong>. You will be placed on the waitlist until approved.
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {loading ? 'Submitting Request...' : 'Submit Request to Superadmin'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* STANDARD GOOGLE LOGIN SECTION (Students & TGMs / Faculty)        */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {!isCR && step === 'login' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {preselectedRole
                    ? `Welcome, ${roleMeta.label}`
                    : 'Welcome to TCET Portal'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Sign in securely using your official TCET Google account. Only{' '}
                  <strong>@tcetmumbai.in</strong> emails are allowed.
                </p>
              </div>

              <div className="flex justify-center w-full py-8">
                {loading ? (
                  <p className="text-sm text-indigo-600 font-medium animate-pulse">
                    Authenticating with Google...
                  </p>
                ) : (
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setErrorMsg('Google Sign-In failed or was cancelled.')}
                    hosted_domain="tcetmumbai.in"
                    theme="outline"
                    size="large"
                    text="continue_with"
                    shape="pill"
                  />
                )}
              </div>

              <p className="text-[11px] text-slate-400 text-center">
                First-time users will be asked to complete a quick profile setup after signing in.
              </p>
            </div>
          )}

          {/* Step 2: Onboarding Form (for Google users) */}
          {step === 'onboarding' && (preselectedRole === 'student' || role === 'student') && (
            <StudentProfileSetup
              email={onboardingEmail}
              name={onboardingName}
              existingProfile={existingProfile}
              onComplete={(profile) => {
                onSelectProfile(profile);
                setSuccessMsg(`Profile created successfully for ${profile.name}!`);
              }}
              onBack={() => {
                setStep('login');
                setExistingProfile(undefined);
              }}
            />
          )}

          {step === 'onboarding' && preselectedRole !== 'student' && role !== 'student' && (
            <form onSubmit={handleOnboardingSubmit} className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Complete Your Profile</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Welcome, <strong>{onboardingName}</strong>! Provide your academic details to finish setup.
                </p>
              </div>

              <div className="grid grid-cols-1 min-[481px]:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    I am a...
                  </label>
                  {preselectedRole ? (
                    <div
                      className={`flex items-center gap-2 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold bg-slate-50 ${roleMeta.color}`}
                    >
                      {roleMeta.icon}
                      {roleMeta.label}
                    </div>
                  ) : (
                    <select
                      value={role}
                      onChange={(e) => {
                        const newRole = e.target.value as UserRole;
                        setRole(newRole);
                        if (newRole === 'admin') {
                          if (!rollNo || /^\d+$/.test(rollNo)) setRollNo('FAC-101');
                        } else {
                          if (rollNo.startsWith('FAC-')) setRollNo('');
                        }
                      }}
                      className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                    >
                      <option value="student">Student</option>
                      <option value="cr">Class Representative (CR)</option>
                      <option value="admin">Teacher / TGM (Faculty)</option>
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    {role === 'admin' ? 'Faculty ID' : 'Roll No'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={role === 'admin' ? 'e.g. FAC-102' : 'e.g. 15'}
                    value={rollNo}
                    onChange={(e) => setRollNo(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 min-[481px]:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">ERP No</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2023011245"
                    value={erpNo}
                    onChange={(e) => setErpNo(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Department</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none bg-white focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="Internet of Things (IoT)">Internet of Things (IoT)</option>
                    <option value="Computer Science">Computer Science</option>
                    <option value="Mechanical Engineering">Mechanical Engineering</option>
                    <option value="Civil Engineering">Civil Engineering</option>
                    <option value="Electronics Engineering">Electronics Engineering</option>
                    <option value="Institutional Head Office">Institutional Head Office</option>
                  </select>
                </div>
              </div>

              {role === 'admin' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                  <strong>⚠️ Approval Required:</strong> Faculty/TGM accounts require Super Admin
                  approval before full access is granted. You will be placed in the waitlist.
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? 'Saving Profile...' : 'Finish & Enter Portal'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
