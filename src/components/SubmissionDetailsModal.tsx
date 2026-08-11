import React, { useState } from 'react';
import { CertificateSubmission } from '../types';
import { AICTE_CATEGORIES } from '../constants/aicteData';
import { getDriveFileWebUrl, getDriveFilePreviewUrl } from '../services/driveService';
import {
  X,
  FileCheck2,
  FileText,
  CheckCircle2,
  Clock,
  UserCheck,
  ShieldCheck,
  History,
  ExternalLink,
  Award,
  AlertTriangle,
  HardDrive,
  Eye,
  GraduationCap,
  Building2,
  QrCode,
  Sparkles,
  Loader2,
} from 'lucide-react';

interface SubmissionDetailsModalProps {
  submission: CertificateSubmission | null;
  onClose: () => void;
}

export const SubmissionDetailsModal: React.FC<SubmissionDetailsModalProps> = ({
  submission,
  onClose,
}) => {
  const [previewTab, setPreviewTab] = useState<'document' | 'iframe'>('document');
  const [isAiClassifying, setIsAiClassifying] = useState(false);
  const [aiResult, setAiResult] = useState<{
    category: string;
    title: string | null;
    reason: string;
  } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  if (!submission) return null;

  const handleRunAiCategorization = async () => {
    setIsAiClassifying(true);
    setAiError(null);
    setAiResult(null);

    try {
      const res = await fetch('/api/gemini/classify-certificate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: submission.fileName,
          fileText: `Activity: ${submission.activityName}. Conducted By: ${submission.conductedBy}. Description: ${submission.shortDescription || 'N/A'}.`,
          certificateId: submission.id,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setAiResult(json.data);
      } else {
        setAiError(json.error || 'Failed to auto-classify certificate.');
      }
    } catch (err: any) {
      setAiError(err?.message || 'Error communicating with Gemini AI server endpoint.');
    } finally {
      setIsAiClassifying(false);
    }
  };

  const category = AICTE_CATEGORIES.find((c) => c.id === submission.activityCategoryNo);

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-indigo-50 text-indigo-600 p-2 rounded-xl border border-indigo-100">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Submission Audit & File Details
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                ID: {submission.id} | Semester: {submission.semester.replace('_', ' ')}
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

        {/* Student Info */}
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs grid grid-cols-2 gap-2">
          <div>
            <span className="text-slate-500">Student Name:</span>
            <p className="font-bold text-slate-900">{submission.studentName}</p>
          </div>
          <div>
            <span className="text-slate-500">Class Roll / ERP:</span>
            <p className="font-bold text-slate-900">
              {submission.studentRollNo} ({submission.studentErpNo})
            </p>
          </div>
          <div>
            <span className="text-slate-500">Department / Division:</span>
            <p className="font-bold text-slate-900">
              {submission.studentDepartment} (Div {submission.studentDivision})
            </p>
          </div>
          <div>
            <span className="text-slate-500">Submitted Date:</span>
            <p className="font-bold text-slate-900">
              {new Date(submission.createdAt).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Activity Details */}
        <div className="space-y-3">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Activity Title & Organization
            </span>
            <h4 className="text-base font-bold text-slate-900 mt-0.5">
              {submission.activityName}
            </h4>
            <p className="text-xs text-slate-600">Conducted by: {submission.conductedBy}</p>
          </div>

          <div className="grid grid-cols-3 gap-2 bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100 text-xs">
            <div>
              <span className="text-slate-500">AICTE Category:</span>
              <p className="font-bold text-indigo-900">Cat {submission.activityCategoryNo}</p>
              <p className="text-[10px] text-indigo-700">{category?.title}</p>
            </div>
            <div>
              <span className="text-slate-500">Hours Spent:</span>
              <p className="font-bold text-slate-900 text-sm">{submission.hoursSpent} Hours</p>
            </div>
            <div>
              <span className="text-slate-500">Awarded Points:</span>
              <p className="font-bold text-emerald-700 text-sm">+{submission.calculatedPoints} Pts</p>
            </div>
          </div>

          {submission.shortDescription && (
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
              <span className="font-bold text-slate-700 block mb-0.5">Summary Note:</span>
              <p className="text-slate-600 italic">"{submission.shortDescription}"</p>
            </div>
          )}

          {/* Certificate File View-Only Document Preview */}
          <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl space-y-3 border border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold flex items-center gap-1.5 text-indigo-300">
                  <Eye className="w-4 h-4 text-indigo-400" />
                  Attached Certificate (View-Only Preview)
                </span>
                <div className="bg-slate-800 p-0.5 rounded-lg flex items-center text-[10px] font-semibold border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('document')}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      previewTab === 'document' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    📄 Certificate Sheet
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('iframe')}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      previewTab === 'iframe' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🌐 Drive Frame
                  </button>
                </div>
              </div>

              <a
                href={getDriveFileWebUrl(submission.currentFileDriveId || submission.fileDataUrl || '')}
                target="_blank"
                rel="noreferrer"
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors self-start sm:self-auto"
              >
                <HardDrive className="w-3 h-3" />
                Open in Google Drive
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {previewTab === 'document' || (submission.fileDataUrl && submission.fileDataUrl.startsWith('data:image/')) ? (
              submission.fileDataUrl && submission.fileDataUrl.startsWith('data:image/') ? (
                <div className="rounded-xl overflow-hidden bg-black max-h-64 flex items-center justify-center p-2 border border-slate-800">
                  <img src={submission.fileDataUrl} alt="Certificate Preview" className="max-h-60 object-contain rounded" />
                </div>
              ) : (
                <div className="bg-gradient-to-br from-amber-50/10 via-slate-900 to-indigo-950/40 p-4 rounded-xl border-2 border-amber-500/40 text-slate-100 space-y-3 relative overflow-hidden shadow-inner">
                  {/* Decorative Watermark Header */}
                  <div className="flex items-center justify-between border-b border-amber-500/30 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-amber-500/20 text-amber-300 rounded-lg flex items-center justify-center border border-amber-500/40 font-bold">
                        <GraduationCap className="w-5 h-5" />
                      </div>
                      <div>
                        <h5 className="font-extrabold text-amber-200 text-xs tracking-wide">
                          THAKUR COLLEGE OF ENGINEERING & TECHNOLOGY
                        </h5>
                        <p className="text-[10px] text-amber-300/80 font-mono">
                          (Autonomous Institute • AICTE Activity Certificate)
                        </p>
                      </div>
                    </div>
                    <span className="bg-emerald-900/60 text-emerald-300 border border-emerald-500/40 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      VERIFIED • PORTFOLIO ATTACHED
                    </span>
                  </div>

                  {/* Certificate Body Text */}
                  <div className="text-center py-2 space-y-1.5">
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
                      Official Certificate of Completion
                    </p>
                    <h4 className="text-sm font-extrabold text-white">
                      {submission.studentName}
                    </h4>
                    <p className="text-[11px] text-slate-300 font-mono">
                      Roll No: <span className="text-amber-300 font-bold">{submission.studentRollNo}</span> | ERP: <span className="text-amber-300 font-bold">{submission.studentErpNo}</span>
                    </p>
                    <div className="my-2 bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80 text-left space-y-1 text-xs">
                      <p className="text-slate-300">
                        <strong className="text-indigo-300">Activity:</strong> {submission.activityName}
                      </p>
                      <p className="text-slate-400 text-[11px]">
                        <strong className="text-slate-300">Conducted By:</strong> {submission.conductedBy}
                      </p>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px]">
                        <span className="text-indigo-200 font-medium">Cat {submission.activityCategoryNo} ({category?.shortCode})</span>
                        <span className="text-emerald-400 font-bold">{submission.hoursSpent} Hours (+{submission.calculatedPoints} Points)</span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Verification Seal & Signatures */}
                  <div className="flex items-center justify-between pt-2 border-t border-amber-500/30 text-[10px]">
                    <div className="flex items-center gap-1.5 text-slate-400 font-mono">
                      <QrCode className="w-6 h-6 text-indigo-400 shrink-0" />
                      <div>
                        <span>HASH: {submission.id.substring(0, 12)}...</span>
                        <br />
                        <span className="text-emerald-400">Google Drive Linked</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-amber-200 font-bold block">Assigned TGM Evaluator:</span>
                      <span className="text-slate-300 font-mono">{submission.assignedTgmName || submission.tgmVerifiedBy || 'Prof. S. K. Mehta (TGM)'}</span>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="w-full bg-slate-950 rounded-xl overflow-hidden border border-slate-800 h-64 sm:h-72">
                <iframe
                  src={getDriveFilePreviewUrl(submission.currentFileDriveId || submission.fileDataUrl || '')}
                  className="w-full h-full border-0"
                  title="Google Drive Certificate Document View-Only Preview"
                />
              </div>
            )}

            <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-800/80">
              <span>File Name: <strong className="text-slate-200">{submission.fileName}</strong></span>
              <span>Drive ID: <strong className="text-amber-300">{submission.currentFileDriveId}</strong></span>
            </div>
          </div>

          {/* Gemini AI Certificate Auto-Categorizer (Naming-Convention Fallback) */}
          <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900 p-4 rounded-2xl border border-indigo-500/30 text-white space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-indigo-500/20 text-indigo-300 p-1.5 rounded-lg border border-indigo-400/30">
                  <Sparkles className="w-4 h-4 text-indigo-300" />
                </div>
                <div>
                  <h5 className="font-bold text-xs text-indigo-100">
                    Gemini AI Certificate Auto-Categorizer
                  </h5>
                  <p className="text-[10px] text-indigo-300/80">
                    Naming-Convention Fallback & Document Content AI Classification
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRunAiCategorization}
                disabled={isAiClassifying}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5"
              >
                {isAiClassifying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Classify Document
                  </>
                )}
              </button>
            </div>

            {aiResult && (
              <div className="bg-slate-950/80 p-3 rounded-xl border border-indigo-500/30 text-xs space-y-2 font-mono">
                <div className="flex items-center justify-between border-b border-indigo-900/60 pb-2">
                  <span className="text-slate-400">Assigned Category:</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                      aiResult.category === 'unrecognized'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-indigo-900 text-indigo-200 border border-indigo-700'
                    }`}
                  >
                    {aiResult.category}
                  </span>
                </div>

                {aiResult.title && (
                  <div className="flex items-center justify-between border-b border-indigo-900/60 pb-2">
                    <span className="text-slate-400">Extracted Title:</span>
                    <span className="font-bold text-white">{aiResult.title}</span>
                  </div>
                )}

                <div>
                  <span className="text-slate-400 block mb-0.5">AI Reason:</span>
                  <p className="text-indigo-200 text-[11px] italic font-sans">{aiResult.reason}</p>
                </div>

                <div className="text-[10px] text-slate-400 pt-1 border-t border-indigo-900/40">
                  {aiResult.category === 'unrecognized' ? (
                    <span className="text-amber-400">
                      ⚠️ Status: Document unrecognized — routed to faculty review queue (naming_error).
                    </span>
                  ) : (
                    <span className="text-emerald-400">
                      ✓ Status: Auto-categorized to {aiResult.category} and logged in Supabase ai_classifications.
                    </span>
                  )}
                </div>
              </div>
            )}

            {aiError && (
              <div className="bg-rose-950/80 border border-rose-800/80 p-2.5 rounded-xl text-rose-200 text-xs">
                ⚠️ {aiError}
              </div>
            )}
          </div>
        </div>

        {/* Two-Stage Approval Status */}
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Two-Stage Verification Status
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Stage 1 CR Check */}
            <div
              className={`p-3 rounded-xl border ${
                submission.isCheckedByCR
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold">
                <UserCheck className="w-4 h-4" />
                Stage 1: CR Verification
              </div>
              <p className="text-[11px] mt-1">
                {submission.isCheckedByCR
                  ? `Checked ✓ by ${submission.crCheckedBy || 'CR'} on ${
                      submission.crCheckedAt
                        ? new Date(submission.crCheckedAt).toLocaleDateString()
                        : 'Record'
                    }`
                  : 'Pending Class Representative Check'}
              </p>
              {submission.crRemarks && (
                <p className="text-[10px] italic mt-1 bg-white/80 p-1 rounded">
                  Remarks: "{submission.crRemarks}"
                </p>
              )}
            </div>

            {/* Stage 2 TGM Approval */}
            <div
              className={`p-3 rounded-xl border ${
                submission.isVerifiedByTGM
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold">
                <ShieldCheck className="w-4 h-4" />
                Stage 2: TGM Approval ({submission.assignedTgmName || 'Prof. S. K. Mehta'})
              </div>
              <p className="text-[11px] mt-1">
                {submission.isVerifiedByTGM
                  ? `Verified ✓ by ${submission.tgmVerifiedBy || submission.assignedTgmName || 'TGM Mentor'} on ${
                      submission.tgmVerifiedAt
                        ? new Date(submission.tgmVerifiedAt).toLocaleDateString()
                        : 'Record'
                    }`
                  : `Awaiting TGM Approval (${submission.assignedTgmName || 'Prof. S. K. Mehta'})`}
              </p>
              {submission.tgmRemarks && (
                <p className="text-[10px] italic mt-1 bg-white/80 p-1 rounded">
                  Remarks: "{submission.tgmRemarks}"
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Drive File Version History */}
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
              Google Drive Portfolio Files (fileDriveIdHistory)
            </h4>
            <span className="text-[11px] text-slate-500 font-mono">
              {submission.fileDriveIdHistory.length} Version(s)
            </span>
          </div>

          <div className="bg-slate-900 text-slate-200 p-3 rounded-2xl text-xs space-y-1.5 font-mono">
            {submission.fileDriveIdHistory.map((driveId, idx) => {
              const isCurrent = driveId === submission.currentFileDriveId;
              const webUrl = getDriveFileWebUrl(driveId);
              return (
                <div
                  key={`${driveId}-${idx}`}
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    isCurrent ? 'bg-indigo-900/60 text-indigo-200 font-bold border border-indigo-700/50' : 'text-slate-400'
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span>v{idx + 1}:</span>
                    <span className="truncate max-w-[180px] sm:max-w-xs">{driveId}</span>
                    {isCurrent && (
                      <span className="bg-indigo-500 text-white text-[9px] px-1.5 py-0.2 rounded font-sans font-semibold shrink-0">
                        Active
                      </span>
                    )}
                  </span>

                  <a
                    href={webUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[11px] text-indigo-300 hover:text-white font-sans font-medium bg-indigo-950/80 px-2 py-1 rounded border border-indigo-800/60 shrink-0 transition-colors"
                  >
                    <span>View in Drive</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Close */}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
          >
            Close Audit View
          </button>
        </div>
      </div>
    </div>
  );
};
