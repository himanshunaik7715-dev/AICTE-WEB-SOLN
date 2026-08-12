import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { UserProfile, UserRole } from '../types';
import { loginWithGoogle, completeGoogleSignUp } from '../services/authService';
import {
  X,
  Lock,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
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
  const [step, setStep] = useState<'login' | 'onboarding'>('login');

  // Onboarding data
  const [onboardingEmail, setOnboardingEmail] = useState('');
  const [onboardingName, setOnboardingName] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [rollNo, setRollNo] = useState('');
  const [erpNo, setErpNo] = useState('');
  const [department, setDepartment] = useState('Internet of Things (IoT)');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);
    try {
      if (!credentialResponse.credential) throw new Error('No credential received.');
      const result = await loginWithGoogle(credentialResponse.credential);

      if (result.profileNeeded === false) {
        onSelectProfile(result.profile);
        setSuccessMsg(`Signed in as ${result.profile.name}`);
        setTimeout(() => onClose(), 1000);
      } else {
        setOnboardingEmail(result.email);
        setOnboardingName(result.name);
        setStep('onboarding');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Google Sign-In failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const newProfile = await completeGoogleSignUp(onboardingEmail, onboardingName, {
        role,
        rollNo: rollNo || (role === 'admin' ? 'FAC-101' : '8'),
        erpNo: erpNo || '2023019999',
        department,
        division: 'A',
        academicBatch: '2023-2027',
      });
      onSelectProfile(newProfile);
      setSuccessMsg(`Profile created for ${newProfile.name}!`);
      setTimeout(() => onClose(), 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'Profile creation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl text-white flex items-center justify-center font-bold shadow-xs">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {step === 'login' ? 'Sign In' : 'Complete Profile'}
              </h3>
              <p className="text-xs text-slate-500">TCET AICTE Activity Portal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="bg-rose-50 text-rose-700 p-3 rounded-xl border border-rose-100 text-xs font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl border border-emerald-100 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {successMsg}
            </div>
          )}

          {/* Step 1: Google Login */}
          {step === 'login' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Sign in with your official TCET Google account (<strong>@tcetmumbai.in</strong>).
              </p>
              <div className="flex justify-center py-4">
                {loading ? (
                  <p className="text-sm text-indigo-600 font-medium animate-pulse">Authenticating...</p>
                ) : (
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setErrorMsg('Google Sign-In failed or was cancelled.')}
                    theme="outline"
                    size="large"
                    text="signin_with"
                    shape="rectangular"
                  />
                )}
              </div>
            </div>
          )}

          {/* Step 2: Onboarding */}
          {step === 'onboarding' && (
            <form onSubmit={handleOnboardingSubmit} className="space-y-3">
              <p className="text-xs text-slate-500">
                Welcome, <strong>{onboardingName}</strong>! Fill in your details to complete registration.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">I am a...</label>
                <select
                  value={role}
                  onChange={(e) => {
                    const r = e.target.value as UserRole;
                    setRole(r);
                    if (r === 'admin') { if (!rollNo || /^\d+$/.test(rollNo)) setRollNo('FAC-101'); }
                    else { if (rollNo.startsWith('FAC-')) setRollNo(''); }
                  }}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                >
                  <option value="student">Student</option>
                  <option value="cr">Class Representative (CR)</option>
                  <option value="admin">Teacher / TGM (Faculty)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    {role === 'admin' ? 'Faculty ID' : 'Roll No'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={role === 'admin' ? 'FAC-102' : '15'}
                    value={rollNo}
                    onChange={(e) => setRollNo(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">ERP No</label>
                  <input
                    type="text"
                    required
                    placeholder="2023011245"
                    value={erpNo}
                    onChange={(e) => setErpNo(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
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
                  <option value="Electronics Engineering">Electronics Engineering</option>
                  <option value="Civil Engineering">Civil Engineering</option>
                  <option value="Institutional Head Office">Institutional Head Office</option>
                </select>
              </div>

              {(role === 'cr' || role === 'admin') && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                  <strong>⚠️ Approval Required:</strong> Your account will be placed in the Super Admin waitlist for approval.
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                {loading ? 'Saving...' : 'Finish & Enter Portal'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
