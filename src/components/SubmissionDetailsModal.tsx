import React, { useState, useEffect, useRef } from 'react';
import { CertificateSubmission } from '../types';
import { AICTE_CATEGORIES } from '../constants/aicteData';
import { getDriveFileWebUrl } from '../services/driveService';
import { updateSubmissionInDb } from '../services/dbService';
import {
  X,
  FileCheck2,
  UserCheck,
  ShieldCheck,
  ExternalLink,
  Award,
  HardDrive,
  Building2,
  Save,
  Check,
} from 'lucide-react';

interface SubmissionDetailsModalProps {
  submission: CertificateSubmission | null;
  onClose: () => void;
}

export const SubmissionDetailsModal: React.FC<SubmissionDetailsModalProps> = ({
  submission,
  onClose,
}) => {
  const [conductedBy, setConductedBy] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (submission) {
      setConductedBy(submission.conductedBy || '');
    }
  }, [submission?.id]);

  if (!submission) return null;

  const handleConductedByChange = (val: string) => {
    setConductedBy(val);
    setSaveSuccess(false);
    
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    
    debounceTimer.current = setTimeout(async () => {
      if (val.trim() !== submission.conductedBy) {
        setIsSaving(true);
        try {
          await updateSubmissionInDb(submission.id, { conductedBy: val.trim() });
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 2000);
        } catch (error) {
          console.error("Failed to update conductedBy", error);
        } finally {
          setIsSaving(false);
        }
      }
    }, 800); // Auto-save after 800ms of typing
  };

  const category = AICTE_CATEGORIES.find((c) => c.id === submission.activityCategoryNo);

  const headerGradient = submission.isVerifiedByTGM
    ? 'from-emerald-600 via-emerald-700 to-teal-700'
    : submission.isCheckedByCR
    ? 'from-indigo-600 via-indigo-700 to-violet-700'
    : 'from-amber-500 via-orange-500 to-orange-600';

  const statusLabel = submission.isVerifiedByTGM
    ? '✓ TGM Verified'
    : submission.isCheckedByCR
    ? '⏳ CR Checked – Awaiting TGM'
    : '⏳ Pending CR Verification';

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">

        {/* Colorful Header */}
        <div className={`bg-gradient-to-r ${headerGradient} p-5 relative`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/60 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 pr-10">
            <div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center border border-white/30 shrink-0">
              <FileCheck2 className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <span className="text-white/70 text-[10px] font-bold uppercase tracking-widest block">
                Submission Details
              </span>
              <h3 className="font-extrabold text-white text-base leading-tight truncate">
                {submission.activityName}
              </h3>
              <p className="text-white/60 text-[11px] font-mono mt-0.5">
                {submission.semester.replace('_', ' ')}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="bg-white/20 border border-white/30 text-white text-[11px] font-bold px-3 py-1 rounded-full">
              {statusLabel}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">

          {/* Activity Info Card */}
          <div className="bg-gradient-to-br from-indigo-50 to-slate-50 rounded-2xl border border-indigo-100 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <Award className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Activity</p>
                <p className="font-bold text-slate-900 text-sm leading-snug">{submission.activityName}</p>
              </div>
            </div>

            {/* Conducted By Input */}
            <div className="flex items-start gap-2">
              <Building2 className="w-4 h-4 text-indigo-500 mt-2.5 shrink-0" />
              <div className="flex-1 relative">
                <label className="text-[10px] text-indigo-500 font-extrabold uppercase tracking-wider block mb-1">
                  Conducted By (Optional)
                </label>
                <input
                  type="text"
                  value={conductedBy}
                  onChange={(e) => handleConductedByChange(e.target.value)}
                  placeholder="e.g. IIT Bombay, Google, TCET…"
                  className="w-full text-xs bg-white border border-indigo-200 rounded-xl pl-3 pr-8 py-2 text-indigo-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400 placeholder:text-indigo-300/50"
                />
                <div className="absolute right-2.5 top-[23px] flex items-center justify-center">
                  {isSaving ? (
                    <Save className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                  ) : saveSuccess ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : null}
                </div>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="bg-white rounded-xl border border-indigo-100 p-2.5 text-center">
                <p className="text-[10px] text-slate-400 font-semibold">Category</p>
                <p className="font-extrabold text-indigo-700 text-sm">CAT-{String(submission.activityCategoryNo).padStart(2, '0')}</p>
                <p className="text-[9px] text-indigo-400 leading-tight truncate">{category?.title}</p>
              </div>
              <div className="bg-white rounded-xl border border-amber-100 p-2.5 text-center">
                <p className="text-[10px] text-slate-400 font-semibold">Hours</p>
                <p className="font-extrabold text-amber-600 text-sm">{submission.hoursSpent}h</p>
                <p className="text-[9px] text-amber-400">Spent</p>
              </div>
              <div className="bg-white rounded-xl border border-emerald-100 p-2.5 text-center">
                <p className="text-[10px] text-slate-400 font-semibold">Points</p>
                <p className="font-extrabold text-emerald-600 text-sm">+{submission.calculatedPoints}</p>
                <p className="text-[9px] text-emerald-400">Awarded</p>
              </div>
            </div>
          </div>

          {/* Two-Stage Verification */}
          <div className="grid grid-cols-2 gap-2">
            <div className={`rounded-2xl border p-3 ${submission.isCheckedByCR ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className={`flex items-center gap-1.5 font-bold text-xs ${submission.isCheckedByCR ? 'text-emerald-800' : 'text-amber-800'}`}>
                <UserCheck className="w-3.5 h-3.5" />
                Stage 1: CR
              </div>
              <p className={`text-[11px] mt-1 font-medium ${submission.isCheckedByCR ? 'text-emerald-700' : 'text-amber-700'}`}>
                {submission.isCheckedByCR
                  ? `✓ ${submission.crCheckedBy || 'CR'}`
                  : 'Pending CR check'}
              </p>
              {submission.crRemarks && (
                <p className="text-[10px] italic mt-1 text-emerald-600 bg-white/70 p-1.5 rounded-lg">
                  "{submission.crRemarks}"
                </p>
              )}
            </div>

            <div className={`rounded-2xl border p-3 ${submission.isVerifiedByTGM ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className={`flex items-center gap-1.5 font-bold text-xs ${submission.isVerifiedByTGM ? 'text-emerald-800' : 'text-slate-700'}`}>
                <ShieldCheck className="w-3.5 h-3.5" />
                Stage 2: TGM
              </div>
              <p className={`text-[11px] mt-1 font-medium ${submission.isVerifiedByTGM ? 'text-emerald-700' : 'text-slate-500'}`}>
                {submission.isVerifiedByTGM
                  ? `✓ ${submission.tgmVerifiedBy || submission.assignedTgmName || 'TGM'}`
                  : `Awaiting ${submission.assignedTgmName || 'TGM'}`}
              </p>
              {submission.tgmRemarks && (
                <p className="text-[10px] italic mt-1 text-emerald-600 bg-white/70 p-1.5 rounded-lg">
                  "{submission.tgmRemarks}"
                </p>
              )}
            </div>
          </div>

          {/* Drive File History */}
          <div className="bg-slate-900 rounded-2xl p-3.5 space-y-1.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                Drive File History
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {submission.fileDriveIdHistory.length} version(s)
              </span>
            </div>
            {submission.fileDriveIdHistory.map((driveId, idx) => {
              const isCurrent = driveId === submission.currentFileDriveId;
              return (
                <div
                  key={`${driveId}-${idx}`}
                  className={`flex items-center justify-between p-2.5 rounded-xl ${
                    isCurrent
                      ? 'bg-indigo-900/60 border border-indigo-700/40'
                      : 'bg-slate-800/50'
                  }`}
                >
                  <span className={`text-[11px] font-mono truncate max-w-[180px] ${isCurrent ? 'text-indigo-200 font-bold' : 'text-slate-500'}`}>
                    v{idx + 1}: {driveId}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {isCurrent && (
                      <span className="bg-indigo-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold">
                        Active
                      </span>
                    )}
                    <a
                      href={getDriveFileWebUrl(driveId)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:text-white transition-colors"
                      title="View in Drive"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-2xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

