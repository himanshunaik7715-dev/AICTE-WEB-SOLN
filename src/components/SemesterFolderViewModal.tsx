import React, { useState } from 'react';
import { CertificateSubmission, Semester, UserProfile, SubmissionStatus } from '../types';
import { SEMESTER_TARGETS, AICTE_CATEGORIES } from '../constants/aicteData';
import {
  Folder,
  FolderDown,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  ExternalLink,
  Send,
  Sparkles,
  AlertTriangle,
  FileQuestion,
  Loader2,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface SemesterFolderViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  semester: Semester;
  student: UserProfile;
  submissions: CertificateSubmission[];
  onUpdateStatusBatch: (ids: string[], newStatus: SubmissionStatus) => Promise<void> | void;
  onOpenDriveFetchModal: (semester: Semester) => void;
  onRunAiOnNamingError: (submissionId: string) => Promise<void> | void;
  onUpdateSubmissionHours?: (id: string, hours: number, points: number) => Promise<void> | void;
}

export const SemesterFolderViewModal: React.FC<SemesterFolderViewModalProps> = ({
  isOpen,
  onClose,
  semester,
  student,
  submissions,
  onUpdateStatusBatch,
  onOpenDriveFetchModal,
  onRunAiOnNamingError,
  onUpdateSubmissionHours,
}) => {
  const [activeTab, setActiveTab] = useState<'imported' | 'pending' | 'verified' | 'rejected' | 'naming_error' | 'skipped'>(
    'imported'
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiProcessingId, setAiProcessingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const semTarget = SEMESTER_TARGETS.find((s) => s.semester === semester) || SEMESTER_TARGETS[0];

  // Filter submissions belonging to this semester
  const semSubmissions = submissions.filter((s) => s.semester === semester);

  const importedList = semSubmissions.filter((s) => s.status === 'imported');
  const pendingList = semSubmissions.filter((s) => s.status === 'pending_cr' || s.status === 'pending_admin');
  const verifiedList = semSubmissions.filter((s) => s.status === 'approved');
  const rejectedList = semSubmissions.filter((s) => s.status === 'rejected' || s.status === 'resubmission_requested');
  const namingErrorList = semSubmissions.filter((s) => s.status === 'naming_error');
  const skippedList = semSubmissions.filter((s) => s.status === 'skipped_not_pdf');

  let currentTabList: CertificateSubmission[] = [];
  if (activeTab === 'imported') currentTabList = importedList;
  else if (activeTab === 'pending') currentTabList = pendingList;
  else if (activeTab === 'verified') currentTabList = verifiedList;
  else if (activeTab === 'rejected') currentTabList = rejectedList;
  else if (activeTab === 'naming_error') currentTabList = namingErrorList;
  else if (activeTab === 'skipped') currentTabList = skippedList;

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === importedList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(importedList.map((i) => i.id));
    }
  };

  const handleSendForVerification = async () => {
    if (selectedIds.length === 0) {
      alert('Please select at least one imported certificate to send for CR verification.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onUpdateStatusBatch(selectedIds, 'pending_cr');
      setSelectedIds([]);
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
      setActiveTab('pending');
    } catch (err: any) {
      alert(`Error submitting certificates: ${err?.message || 'Server error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAiCategorizeRow = async (subId: string) => {
    setAiProcessingId(subId);
    try {
      await onRunAiOnNamingError(subId);
    } finally {
      setAiProcessingId(null);
    }
  };

  const handleItemHoursChange = (item: CertificateSubmission, newHours: number) => {
    const category = AICTE_CATEGORIES.find((c) => c.id === item.activityCategoryNo) || AICTE_CATEGORIES[0];
    const safeHours = Math.max(0, newHours);
    const newPoints = Math.floor(safeHours / category.minHoursPerPoint);
    if (onUpdateSubmissionHours) {
      onUpdateSubmissionHours(item.id, safeHours, newPoints);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-4xl w-full min-w-0 max-h-[calc(100dvh-1.5rem)] shadow-2xl border border-slate-200 overflow-hidden my-2 sm:my-6 flex flex-col">
        {/* Top Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-6 relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors z-10"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:pr-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white border border-indigo-400/30 shrink-0">
                <Folder className="w-6 h-6 text-indigo-100" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-950 px-2.5 py-0.5 rounded border border-indigo-800">
                    {semTarget.academicYear} Folder
                  </span>
                  <span className="text-xs text-indigo-200 font-mono">
                    Path: Google Drive / {semTarget.semesterLabel}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mt-1">
                  {semTarget.semesterLabel} Certificates & Activity Record
                </h3>
              </div>
            </div>


          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="bg-slate-50 border-b border-slate-200 p-2 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('imported')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'imported'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <FolderDown className="w-3.5 h-3.5" />
            <span>Imported</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'imported' ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {importedList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'pending'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pending</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'pending' ? 'bg-amber-800 text-amber-100' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {pendingList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('verified')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'verified'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Verified</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'verified' ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {verifiedList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('rejected')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'rejected'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Rejected</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'rejected' ? 'bg-rose-800 text-rose-100' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {rejectedList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('naming_error')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'naming_error'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-purple-200" />
            <span>Naming Errors</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'naming_error' ? 'bg-purple-800 text-purple-100' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {namingErrorList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('skipped')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'skipped'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <FileQuestion className="w-3.5 h-3.5 text-slate-300" />
            <span>Skipped Non-PDF</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'skipped' ? 'bg-slate-900 text-slate-100' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {skippedList.length}
            </span>
          </button>
        </div>

        {/* Tab Body Content */}
        <div className="p-4 sm:p-6 space-y-4 min-h-0 overflow-y-auto flex-1">
          {/* Imported Tab Special Control Header */}
          {activeTab === 'imported' && importedList.length > 0 && (
            <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedIds.length === importedList.length && importedList.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <span className="text-xs font-bold text-slate-800">
                  Select All Imported Files ({selectedIds.length} of {importedList.length} selected)
                </span>
              </div>

              <button
                onClick={handleSendForVerification}
                disabled={selectedIds.length === 0 || isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-200" />
                    Submitting for CR Verification...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-indigo-200" />
                    Send {selectedIds.length} Certificate(s) for CR Verification
                  </>
                )}
              </button>
            </div>
          )}

          {/* List Empty State */}
          {currentTabList.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-6">
              <FolderDown className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-700">No Certificates in this Status</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                {activeTab === 'imported'
                  ? 'All fetched certificates have been sent for verification or no valid PDFs have been imported yet.'
                  : activeTab === 'naming_error'
                  ? 'Great! All fetched PDF files in this semester folder follow the CAT-XX_Title.pdf naming convention.'
                  : activeTab === 'skipped'
                  ? 'No non-PDF files detected in this Google Drive folder.'
                  : 'No certificate submissions found under this status.'}
              </p>

            </div>
          ) : (
            <div className="space-y-3">
              {currentTabList.map((item) => {
                const category =
                  AICTE_CATEGORIES.find((c) => c.id === item.activityCategoryNo) || AICTE_CATEGORIES[0];

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      activeTab === 'imported' && selectedIds.includes(item.id)
                        ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-400/20'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {activeTab === 'imported' && (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onChange={() => toggleSelectId(item.id)}
                          className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                        />
                      )}

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm">
                            {item.activityName || item.fileName}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded border uppercase">
                            {item.status === 'imported' && (
                              <span className="bg-indigo-100 text-indigo-800 border-indigo-200">
                                Imported (Not Sent)
                              </span>
                            )}
                            {item.status === 'pending_cr' && (
                              <span className="bg-amber-100 text-amber-800 border-amber-200">
                                Stage-1 Pending CR
                              </span>
                            )}
                            {item.status === 'pending_admin' && (
                              <span className="bg-blue-100 text-blue-800 border-blue-200">
                                Stage-2 Pending TGM
                              </span>
                            )}
                            {item.status === 'approved' && (
                              <span className="bg-emerald-100 text-emerald-800 border-emerald-200">
                                Verified
                              </span>
                            )}
                            {item.status === 'rejected' && (
                              <span className="bg-rose-100 text-rose-800 border-rose-200">
                                Rejected
                              </span>
                            )}
                            {item.status === 'naming_error' && (
                              <span className="bg-purple-100 text-purple-800 border-purple-200">
                                Naming Error
                              </span>
                            )}
                            {item.status === 'skipped_not_pdf' && (
                              <span className="bg-slate-200 text-slate-800 border-slate-300">
                                Skipped Non-PDF
                              </span>
                            )}
                          </span>
                        </div>

                        <p className="text-xs text-slate-500 font-mono truncate max-w-md">
                          📄 {item.fileName}
                        </p>

                        <div className="text-[11px] text-slate-600 flex items-center gap-3">
                          <span>
                            Category: <strong className="text-slate-800">{category.shortCode} - {category.title}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between shrink-0 gap-2 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100">
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-xl shadow-2xs">
                          <label className="text-[10px] font-bold text-slate-700 uppercase tracking-tight">Hours:</label>
                          <input
                            type="number"
                            min={1}
                            max={300}
                            value={item.hoursSpent}
                            onChange={(e) => handleItemHoursChange(item, parseInt(e.target.value) || 0)}
                            className="w-14 bg-white border border-slate-300 rounded-lg px-1.5 py-0.5 text-xs font-extrabold text-slate-900 text-center focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                          />
                        </div>
                        <span className="text-xs font-bold text-indigo-700 bg-indigo-100 border border-indigo-200 px-2 py-1 rounded-xl shrink-0">
                          = {item.calculatedPoints} Pts
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {item.status === 'naming_error' && (
                          <button
                            onClick={() => handleAiCategorizeRow(item.id)}
                            disabled={aiProcessingId === item.id}
                            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            {aiProcessingId === item.id ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Classifying...
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3 h-3 text-purple-200" />
                                Fix with Gemini AI
                              </>
                            )}
                          </button>
                        )}

                        <a
                          href={
                            item.currentFileDriveId?.startsWith('http')
                              ? item.currentFileDriveId
                              : `https://drive.google.com/file/d/${item.currentFileDriveId}/view`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-semibold text-slate-500 hover:text-indigo-600 flex items-center gap-1 hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View Drive File
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            Semester Goal: <strong className="text-slate-900">{semTarget.targetHours} Hours / {semTarget.targetPoints} Points</strong>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 rounded-xl bg-slate-200 hover:bg-slate-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
