import React, { useState } from 'react';
import { UserProfile } from '../types';
import {
  Crown,
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Lock,
  Mail,
  Eye,
  EyeOff,
  LogIn,
} from 'lucide-react';

// ── Hardcoded Super Admin credentials ──────────────────────────────────────
const SUPER_ADMIN_EMAIL = 'admin@tcetmumbai.in';
const SUPER_ADMIN_PASSWORD = '2026@tcetadmin';

const SUPER_ADMIN_PROFILE: UserProfile = {
  id: 'SUPERADMIN-TCET-2026',
  name: 'TCET Super Admin',
  email: SUPER_ADMIN_EMAIL,
  role: 'superadmin',
  rollNo: 'SA-01',
  erpNo: 'ERP-SA-001',
  department: 'Institutional Head Office',
  division: 'All Departments',
  academicBatch: 'Principal / Head',
  tgmApprovalStatus: 'approved',
};
// ───────────────────────────────────────────────────────────────────────────

interface SuperAdminAuthPageProps {
  onSelectProfile: (profile: UserProfile) => void;
  onReturnToStandardAuth: () => void;
}

export const SuperAdminAuthPage: React.FC<SuperAdminAuthPageProps> = ({
  onSelectProfile,
  onReturnToStandardAuth,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setLoading(true);

    // Simulate a brief network delay for UX realism
    await new Promise((r) => setTimeout(r, 600));

    const emailMatch = email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    const passMatch = password === SUPER_ADMIN_PASSWORD;

    if (emailMatch && passMatch) {
      setSuccessMsg('Authentication successful. Welcome, Super Admin!');
      setTimeout(() => {
        onSelectProfile(SUPER_ADMIN_PROFILE);
      }, 700);
    } else {
      setErrorMsg(
        'Invalid credentials. Access is restricted to the authorised Super Admin account only.'
      );
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-indigo-700/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] bg-violet-700/8 blur-[100px] rounded-full pointer-events-none" />

      {/* Return Button */}
      <div className="w-full max-w-md mb-5 flex items-center justify-between">
        <button
          onClick={onReturnToStandardAuth}
          className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 px-3.5 py-2 rounded-xl transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Return to Portal
        </button>
        <span className="text-[11px] font-bold text-indigo-400 bg-indigo-950/80 border border-indigo-800/80 px-3 py-1 rounded-full flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          Super Admin Portal
        </span>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-md">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 p-7 text-center border-b border-slate-800 relative">
          {/* Crown icon */}
          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/30 mb-4 border border-indigo-400/20">
            <Crown className="w-8 h-8 text-amber-300" />
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">
            TCET Super Admin Login
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            Thakur College of Engineering &amp; Technology (Autonomous)
            <br />
            Institutional Head Office — Restricted Access
          </p>
        </div>

        {/* Body */}
        <div className="p-7 space-y-5">
          {/* Alerts */}
          {errorMsg && (
            <div className="bg-rose-950/80 border border-rose-800 text-rose-200 text-xs p-3.5 rounded-xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMsg}</div>
            </div>
          )}
          {successMsg && (
            <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs p-3.5 rounded-xl flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{successMsg}</div>
            </div>
          )}

          {/* Security notice */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-500 leading-relaxed">
              This login is reserved for the authorised Super Admin only. There is no
              Google Sign-In option for this portal.
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Admin Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  id="superadmin-email"
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="admin@tcetmumbai.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading || !!successMsg}
                  className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/60 transition-all disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  id="superadmin-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading || !!successMsg}
                  className="w-full pl-10 pr-11 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/60 transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              id="superadmin-login-btn"
              type="submit"
              disabled={loading || !!successMsg}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-500/20 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verifying...
                </>
              ) : successMsg ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Redirecting...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Sign In as Super Admin
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Footer note */}
      <p className="mt-6 text-[11px] text-slate-700 text-center max-w-sm">
        © 2026 Thakur College of Engineering &amp; Technology (Autonomous)
      </p>
    </div>
  );
};
