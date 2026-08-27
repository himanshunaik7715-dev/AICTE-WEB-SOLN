import React, { useState } from 'react';
import { CertificateSubmission, Semester } from '../types';
import { SEMESTER_TARGETS, AICTE_CATEGORIES } from '../constants/aicteData';
import {
  extractDriveFileId,
  getDriveFilePreviewUrl,
  getDriveFileWebUrl,
} from '../services/driveService';
import { Upload, X, Info, HardDrive, Link, Eye, ExternalLink } from 'lucide-react';

interface UploadCertificateModalProps {
  defaultSemester?: Semester;
  existingSubmission?: CertificateSubmission | null;
  onClose: () => void;
  onSubmit: (submissionData: Omit<CertificateSubmission, 'id' | 'createdAt' | 'updatedAt' | 'isCheckedByCR' | 'isVerifiedByTGM' | 'status'>) => void;
  studentErpNo: string;
  studentName: string;
  studentRollNo: string;
  studentDepartment: string;
  studentDivision: string;
  assignedTgmName?: string;
  assignedCrName?: string;
}

export const UploadCertificateModal: React.FC<UploadCertificateModalProps> = ({
  defaultSemester = 'SEM_1',
  existingSubmission,
  onClose,
  onSubmit,
  studentErpNo,
  studentName,
  studentRollNo,
  studentDepartment,
  studentDivision,
  assignedTgmName,
  assignedCrName,
}) => {
  const [semester, setSemester] = useState<Semester>(
    existingSubmission ? existingSubmission.semester : defaultSemester
  );
  const [activityName, setActivityName] = useState(
    existingSubmission ? existingSubmission.activityName : ''
  );
  const [conductedBy, setConductedBy] = useState(
    existingSubmission ? existingSubmission.conductedBy : ''
  );
  const [categoryNo, setCategoryNo] = useState<number>(
    existingSubmission ? existingSubmission.activityCategoryNo : 1
  );
  const [hoursSpent, setHoursSpent] = useState<number>(
    existingSubmission ? existingSubmission.hoursSpent : 24
  );
  const [shortDescription, setShortDescription] = useState(
    existingSubmission ? existingSubmission.shortDescription : ''
  );
  const [fileName, setFileName] = useState(
    existingSubmission ? existingSubmission.fileName : 'AICTE_Activity_Certificate.pdf'
  );
  const [driveFileId, setDriveFileId] = useState(
    existingSubmission ? existingSubmission.currentFileDriveId : ''
  );

  const selectedCategory = AICTE_CATEGORIES.find((c) => c.id === categoryNo) || AICTE_CATEGORIES[0];
  const calculatedPoints = Math.floor(hoursSpent / selectedCategory.minHoursPerPoint);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!activityName.trim() || !conductedBy.trim()) {
      alert('Please fill out Activity Name and Conducting Body.');
      return;
    }

    if (!driveFileId.trim()) {
      alert('Please paste a valid Google Drive shareable link or file ID.');
      return;
    }

    const finalDriveId = extractDriveFileId(driveFileId);
    const history = existingSubmission
      ? Array.from(new Set([...(existingSubmission.fileDriveIdHistory || []), finalDriveId]))
      : [finalDriveId];

    onSubmit({
      studentId: `STU-${studentErpNo}`,
      studentName,
      studentRollNo,
      studentErpNo,
      studentDepartment,
      studentDivision,
      assignedTgmName,
      assignedCrName,
      semester,
      activityName: activityName.trim(),
      conductedBy: conductedBy.trim(),
      activityCategoryNo: categoryNo,
      shortDescription: shortDescription.trim(),
      hoursSpent,
      calculatedPoints,
      currentFileDriveId: finalDriveId,
      fileName,
      fileDriveIdHistory: history,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-xl w-full p-4 sm:p-7 shadow-2xl border border-slate-200 space-y-5 my-auto max-h-[calc(100dvh-1.5rem)] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-indigo-50 text-indigo-600 p-2 rounded-xl border border-indigo-100">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {existingSubmission ? 'Re-upload Certificate' : 'Upload Activity Certificate'}
              </h3>
              <p className="text-xs text-slate-500">
                Select Academic Semester and AICTE Activity Category (1-16)
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* TGM Routing Notice */}
          <div className="bg-indigo-50/80 border border-indigo-200/80 p-3 rounded-xl flex items-center justify-between gap-2 text-xs text-indigo-900">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>
                Routing to Assigned TGM: <strong className="font-bold text-indigo-950">{assignedTgmName}</strong>
              </span>
            </div>
            <span className="bg-indigo-200/70 text-indigo-900 font-semibold px-2 py-0.5 rounded text-[10px]">
              Stage-2 Evaluator
            </span>
          </div>

          {/* Semester Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Select Academic Semester *
            </label>
            <div className="grid grid-cols-2 min-[481px]:grid-cols-4 gap-2">
              {SEMESTER_TARGETS.map((st) => {
                const isSelected = semester === st.semester;
                return (
                  <button
                    type="button"
                    key={`upload-sem-${st.semester}`}
                    onClick={() => setSemester(st.semester)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all text-center ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>{st.semesterLabel}</div>
                    <div className="text-[10px] opacity-80 font-normal">
                      {st.targetHours}h/{st.targetPoints}p
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Activity Name */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Activity Name / Event Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Swachh Bharat Sanitation Drive & Tree Plantation"
              value={activityName}
              onChange={(e) => setActivityName(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3.5 py-3 text-xs sm:text-sm leading-snug text-slate-900 bg-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none shadow-2xs"
            />
          </div>

          {/* Conducted By */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Conducted By / Organizing Body *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. TCET NSS Unit / Rotaract Club / IEEE Bombay Section"
              value={conductedBy}
              onChange={(e) => setConductedBy(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3.5 py-3 text-xs sm:text-sm leading-snug text-slate-900 bg-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none shadow-2xs"
            />
          </div>

          {/* AICTE Category Dropdown */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              AICTE Activity Category (1 - 15) *
            </label>
            <select
              value={categoryNo}
              onChange={(e) => setCategoryNo(Number(e.target.value))}
              className="w-full border border-slate-200 rounded-xl px-3.5 py-3 text-xs sm:text-sm leading-snug text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none shadow-2xs cursor-pointer"
            >
              {AICTE_CATEGORIES.map((cat) => (
                <option key={`upload-cat-${cat.id}`} value={cat.id}>
                  Category {cat.id}: {cat.title} ({cat.shortCode})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1.5 italic">
              Scope: {selectedCategory.description}
            </p>
          </div>

          {/* Hours & Points Calculator */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 grid grid-cols-1 min-[481px]:grid-cols-2 gap-3 items-center">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Hours Spent *
              </label>
              <input
                type="number"
                min={1}
                max={200}
                value={hoursSpent}
                onChange={(e) => setHoursSpent(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none shadow-2xs"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Formula: Every {selectedCategory.minHoursPerPoint} Hours = 1 Point (e.g. 5h = 1pt, 8h = 2pts)
              </p>
            </div>

            <div className="bg-indigo-50/80 p-3.5 rounded-xl border border-indigo-100 text-center">
              <span className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wider">
                Calculated Points
              </span>
              <div className="text-2xl font-bold text-indigo-700 mt-0.5">
                {calculatedPoints} Points
              </div>
            </div>
          </div>

          {/* Short Description */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Short Summary of Contribution
            </label>
            <textarea
              rows={2.5}
              placeholder="Briefly describe key achievements or tasks performed during this activity..."
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none shadow-2xs"
            />
          </div>

          {/* Google Drive Link Document Attachment */}
          <div className="border border-indigo-100 bg-indigo-50/30 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4.5 h-4.5 text-indigo-600" />
              <span className="text-xs font-bold text-slate-900">Google Drive Document Attachment *</span>
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] font-semibold text-slate-700">
                Paste Google Drive Shareable Link (PDF / JPG / Document):
              </label>
              <div className="relative">
                <Link className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  placeholder="Paste a Google Drive file link or file ID"
                  value={driveFileId}
                  onChange={(e) => setDriveFileId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs sm:text-sm font-mono text-slate-900 bg-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none shadow-2xs"
                />
              </div>
              <p className="text-[10px] text-slate-500 flex items-center gap-1">
                <Info className="w-3 h-3 text-indigo-600 shrink-0" />
                Set Google Drive permissions to <strong className="text-slate-700">"Anyone with the link can view"</strong> so CR and Admin can verify your document.
              </p>
            </div>

            {/* Live View-Only Document Preview Box */}
            {driveFileId.trim() && (
              <div className="mt-3 bg-slate-900 rounded-xl p-3 text-slate-100 space-y-2 border border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-indigo-400" />
                    Live View-Only Preview
                  </span>
                  <a
                    href={getDriveFileWebUrl(driveFileId.trim())}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
                  >
                    Open in Drive <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="w-full bg-slate-950 rounded-lg overflow-hidden border border-slate-800 h-48">
                  <iframe
                    src={getDriveFilePreviewUrl(driveFileId.trim())}
                    className="w-full h-full border-0"
                    title="Google Drive Document View-Only Preview"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-all"
            >
              {existingSubmission ? 'Save Revision to Portfolio' : 'Save to Portfolio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
