import React, { useState, useEffect } from 'react';
import { Mail, ShieldCheck, RefreshCw, CheckCircle2, AlertCircle, Sparkles, X } from 'lucide-react';
import { verifyEmailCodeResend, sendVerificationCodeResend } from '../services/emailClient';

interface EmailVerificationModalProps {
  isOpen: boolean;
  email: string;
  name?: string;
  onClose: () => void;
  onVerified: () => void;
}

export const EmailVerificationModal: React.FC<EmailVerificationModalProps> = ({
  isOpen,
  email,
  name,
  onClose,
  onVerified,
}) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  if (!isOpen) return null;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.trim().length < 6) {
      setErrorMsg('Please enter the full 6-digit verification code sent to your email.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await verifyEmailCodeResend(email, code);
      setSuccessMsg('Email verified successfully via Resend Email Verification Service!');
      setTimeout(() => {
        onVerified();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await sendVerificationCodeResend(email, name);
      setSuccessMsg('A new 6-digit verification code has been dispatched via Resend Email Service!');
      setCountdown(30);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resend verification code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden relative">
        {/* Top Branding Banner */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-900 p-6 text-white text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-14 h-14 bg-indigo-600/60 border border-indigo-400/40 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
            <Mail className="w-7 h-7 text-indigo-200" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-950/60 border border-indigo-500/40 rounded-full text-[11px] font-semibold text-indigo-200 mb-2">
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span>Resend Email Verification Service</span>
          </div>

          <h3 className="text-xl font-extrabold text-white tracking-tight">Verify Your Email Address</h3>
          <p className="text-xs text-indigo-200 mt-1">
            Thakur College of Engineering & Technology (Autonomous)
          </p>
        </div>

        {/* Form Content */}
        <div className="p-6 space-y-5">
          <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-3.5 text-center">
            <p className="text-xs text-slate-600">
              A 6-digit verification code was dispatched to:
            </p>
            <p className="text-sm font-bold text-indigo-900 mt-0.5 break-all">{email}</p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 text-center">
                Enter 6-Digit Verification Code
              </label>
              <div className="relative">
                <input
                  type="text"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 482915"
                  className="w-full text-center text-2xl font-mono tracking-[0.5em] font-bold py-3.5 px-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-indigo-600 focus:bg-white focus:outline-none transition-all placeholder:text-slate-300 placeholder:tracking-normal placeholder:font-sans placeholder:text-sm text-slate-900"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || code.length < 6}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying via Resend...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  <span>Verify Email & Continue</span>
                </>
              )}
            </button>
          </form>

          {/* Resend Helper Footer */}
          <div className="pt-2 border-t border-slate-100 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={handleResend}
              disabled={countdown > 0 || resending}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
              <span>
                {resending
                  ? 'Dispatching Resend Email...'
                  : countdown > 0
                  ? `Resend Code in ${countdown}s`
                  : 'Resend Verification Code via Resend'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
