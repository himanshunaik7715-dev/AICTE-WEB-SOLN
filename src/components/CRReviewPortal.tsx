import React, { useState } from 'react';
import { CertificateSubmission, Semester, UserProfile } from '../types';
import { SEMESTER_TARGETS, AICTE_CATEGORIES } from '../constants/aicteData';
import {
  UserCheck,
  Check,
  RotateCcw,
  Clock,
  Filter,
  Search,
  FileCheck2,
  ExternalLink,
  MessageSquare,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

interface CRReviewPortalProps {
  submissions: CertificateSubmission[];
  activeProfile?: UserProfile;
  onValidateByCR: (id: string) => void;
  onRequestResubmission: (id: string, remarks: string) => void;
  onViewDetails: (sub: CertificateSubmission) => void;
}

export const CRReviewPortal: React.FC<CRReviewPortalProps> = ({
  submissions,
  activeProfile,
  onValidateByCR,
  onRequestResubmission,
  onViewDetails,
}) => {
  const [selectedSem, setSelectedSem] = useState<Semester | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [resubmitModalSub, setResubmitModalSub] = useState<CertificateSubmission | null>(null);
  const [crRemarksInput, setCrRemarksInput] = useState('');

  // Queue Items
  const pendingCrQueue = submissions.filter((s) => s.status === 'pending_cr');
  const validatedByCrList = submissions.filter((s) => s.isCheckedByCR);

  // Filtered Queue
  const filteredQueue = pendingCrQueue.filter((s) => {
    const matchesSem = selectedSem === 'ALL' || s.semester === selectedSem;
    const matchesSearch =
      s.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.studentRollNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.activityName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSem && matchesSearch;
  });

  const handleSendResubmissionRequest = () => {
    if (!resubmitModalSub) return;
    if (!crRemarksInput.trim()) {
      alert('Please enter remarks explaining why resubmission is required.');
      return;
    }
    onRequestResubmission(resubmitModalSub.id, crRemarksInput);
    setResubmitModalSub(null);
    setCrRemarksInput('');
  };

  return (
    <div className="w-full max-w-screen-xl mx-auto space-y-6 pt-4 px-4 pb-12 sm:px-6 lg:px-8">
      {/* CR Portal Banner */}
      <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1 rounded-md border border-indigo-100">
              <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
              Stage-1 Review Queue — {activeProfile?.customRole || activeProfile?.name || 'Class Representative (CR)'}
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Student Activity Verification Portal
            </h2>
            <p className="text-slate-500 text-xs leading-relaxed">
              Verify certificate authenticity for your assigned division. Validating entries sets <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 font-mono">isCheckedByCR = true</code>, rendering tick mark [v] in the official TCET Activity Diary PDF before forwarding to TGM for points award.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-center min-w-[120px]">
              <span className="text-3xl font-bold text-amber-600">{pendingCrQueue.length}</span>
              <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Pending Check</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-center min-w-[120px]">
              <span className="text-3xl font-bold text-emerald-600">{validatedByCrList.length}</span>
              <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Checked (✓)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Review Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-slate-900 text-base">Stage-1 Verification Queue</h3>
            <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {filteredQueue.length} Items Awaiting Check
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Filter by student or roll no..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {/* Semester Filter */}
            <select
              value={selectedSem}
              onChange={(e) => setSelectedSem(e.target.value as any)}
              className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="ALL">All Semesters</option>
              {SEMESTER_TARGETS.map((st) => (
                <option key={`cr-sem-${st.semester}`} value={st.semester}>
                  {st.semesterLabel}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Queue Items */}
        <div className="p-4 space-y-4">
          {filteredQueue.length === 0 ? (
            <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <FileCheck2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-60" />
              <p className="font-bold text-slate-800 text-sm">Stage-1 Queue Clear!</p>
              <p className="text-xs text-slate-500 mt-1">
                All submitted student certificates have been checked by CR.
              </p>
            </div>
          ) : (
            filteredQueue.map((sub, idx) => {
              const cat = AICTE_CATEGORIES.find((c) => c.id === sub.activityCategoryNo);

              return (
                <div
                  key={`${sub.id}-${idx}`}
                  className="bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl p-4 shadow-xs transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-indigo-50 text-indigo-700 font-bold w-10 h-10 rounded-xl flex items-center justify-center text-xs border border-indigo-100">
                        {sub.studentRollNo.split('-').pop() || 'STU'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-sm">{sub.studentName}</h4>
                          <span className="bg-slate-100 text-slate-700 text-[11px] px-2 py-0.5 rounded font-mono">
                            {sub.studentRollNo}
                          </span>
                          <span className="bg-indigo-50 text-indigo-700 text-[11px] px-2 py-0.5 rounded font-semibold border border-indigo-100">
                            Sem: {sub.semester.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          ERP: {sub.studentErpNo} | Division: {sub.studentDivision}
                        </p>
                      </div>
                    </div>

                    <span className="text-[11px] text-slate-400 font-medium">
                      Submitted: {new Date(sub.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Submission Info */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="md:col-span-2 space-y-1">
                      <p className="text-slate-500 font-medium">Activity Title & Conducted By:</p>
                      <p className="font-bold text-slate-900 text-xs">{sub.activityName}</p>
                      <p className="text-slate-600">Body: {sub.conductedBy}</p>
                      {sub.shortDescription && (
                        <p className="text-slate-500 text-[11px] italic mt-1">"{sub.shortDescription}"</p>
                      )}
                    </div>

                    <div className="space-y-1 border-t md:border-t-0 md:border-l border-slate-200 pt-2 md:pt-0 md:pl-3">
                      <p className="text-slate-500 font-medium">Category & Duration:</p>
                      <p className="font-semibold text-indigo-700">Cat {sub.activityCategoryNo}: {cat?.title}</p>
                      <p className="text-slate-800">Hours Claimed: <strong>{sub.hoursSpent} Hours</strong></p>
                      <p className="text-emerald-700 font-bold">Calculated Points: {sub.calculatedPoints} Pts</p>
                    </div>
                  </div>

                  {/* Attached Document Info */}
                  <div className="flex items-center justify-between text-xs bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100">
                    <div className="flex items-center gap-2">
                      <FileCheck2 className="w-4 h-4 text-indigo-600" />
                      <span className="font-semibold text-slate-800">{sub.fileName}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        (Drive ID: {sub.currentFileDriveId})
                      </span>
                    </div>

                    <button
                      onClick={() => onViewDetails(sub)}
                      className="text-indigo-700 hover:text-indigo-900 font-semibold text-xs underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Inspect File & History
                    </button>
                  </div>

                  {/* CR Actions */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => setResubmitModalSub(sub)}
                      className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                      Request Resubmission
                    </button>

                    <button
                      onClick={() => onValidateByCR(sub.id)}
                      className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-all"
                    >
                      <Check className="w-4 h-4" />
                      Validate & Mark Checked (✓)
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Resubmission Request Modal */}
      {resubmitModalSub && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-orange-600">
              <div className="bg-orange-100 p-2 rounded-xl">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Request Resubmission (CR)</h3>
                <p className="text-xs text-slate-500">Student: {resubmitModalSub.studentName}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Enter feedback notes explaining why this certificate submission requires correction (e.g. low resolution scan, missing seal, incorrect semester tag).
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                CR Feedback & Correction Instructions:
              </label>
              <textarea
                rows={3}
                value={crRemarksInput}
                onChange={(e) => setCrRemarksInput(e.target.value)}
                placeholder="e.g. Please re-upload a clear scanned copy showing the official seal and coordinator signature."
                className="w-full border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setResubmitModalSub(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSendResubmissionRequest}
                className="px-4 py-2 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-md"
              >
                Send Resubmission Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
