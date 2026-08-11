import React, { useState } from 'react';
import { CertificateSubmission, Semester, UserProfile, SubmissionStatus } from '../types';
import { SEMESTER_TARGETS, AICTE_CATEGORIES } from '../constants/aicteData';
import { fetchGoogleDriveFolderFiles, parseFileNameConvention } from '../services/driveService';
import {
  HardDrive,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  ExternalLink,
  FolderDown,
  Check,
  FileText,
  Clock,
  Award,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface DriveFetchModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: UserProfile;
  defaultSemester?: Semester;
  onImportSubmissions: (newSubmissions: CertificateSubmission[]) => void;
}

interface FetchedFileItem {
  id: string;
  driveFileId: string;
  name: string;
  categoryNo: number; // 1-15
  categoryCode: string; // e.g. 'CAT-06'
  title: string;
  hoursSpent: number;
  calculatedPoints: number;
  webViewLink: string;
  hasNamingConvention: boolean;
  aiClassified?: boolean;
  selected: boolean;
  semester: Semester;
  mimeType?: string;
  subfolderPath?: string;
}

export const DriveFetchModal: React.FC<DriveFetchModalProps> = ({
  isOpen,
  onClose,
  student,
  defaultSemester = 'SEM_1',
  onImportSubmissions,
}) => {
  const [folderLink, setFolderLink] = useState(
    student.driveRootFolderId || `https://drive.google.com/drive/folders/tcet_portfolio_${student.erpNo || student.rollNo}`
  );
  const [targetSemester, setTargetSemester] = useState<Semester>(defaultSemester);
  const [isFetching, setIsFetching] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [fetchedItems, setFetchedItems] = useState<FetchedFileItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFetchFiles = async () => {
    if (!folderLink.trim()) {
      setErrorMsg('Please enter a valid public Google Drive folder link or folder ID.');
      return;
    }

    setIsFetching(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setFetchedItems([]);

    try {
      const result = await fetchGoogleDriveFolderFiles(folderLink.trim(), targetSemester);

      if (result.success && result.files.length > 0) {
        const items: FetchedFileItem[] = result.files.map((file) => {
          const parsed = parseFileNameConvention(file.name);
          let catCode = parsed.categoryCode || file.categoryCode || 'CAT-06';
          let catNum = parseInt(catCode.replace('CAT-', ''), 10);
          if (isNaN(catNum) || catNum < 1 || catNum > 15) {
            catNum = 6;
            catCode = 'CAT-06';
          }

          const catObj = AICTE_CATEGORIES.find((c) => c.id === catNum) || AICTE_CATEGORIES[0];
          const hours = 24;
          const points = Math.floor(hours / catObj.minHoursPerPoint);

          const autoSem: Semester = (parsed.semesterCode as Semester) || (file.semester as Semester) || 'SEM_1';

          return {
            id: `FETCH-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            driveFileId: file.driveFileId || file.id,
            name: file.name,
            categoryNo: catNum,
            categoryCode: catCode,
            title: parsed.title || file.title || 'Activity Certificate',
            hoursSpent: hours,
            calculatedPoints: points,
            webViewLink: file.webViewLink,
            hasNamingConvention: parsed.hasNamingConvention || file.hasNamingConvention,
            selected: true,
            semester: autoSem,
            mimeType: file.mimeType || 'application/pdf',
            subfolderPath: (file as any).subfolderPath || '',
          };
        });

        setFetchedItems(items);
        setSuccessMsg(`Successfully fetched ${items.length} files from Google Drive! Each file has been automatically categorized and assigned to its target semester.`);
      } else {
        setErrorMsg(result.error || 'No files found in the specified Google Drive folder.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error connecting to Google Drive.');
    } finally {
      setIsFetching(false);
    }
  };

  const handleUpdateItemHours = (id: string, newHours: number) => {
    setFetchedItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const category = AICTE_CATEGORIES.find((c) => c.id === item.categoryNo) || AICTE_CATEGORIES[0];
          const safeHours = Math.max(0, newHours);
          const newPoints = Math.floor(safeHours / category.minHoursPerPoint);
          return {
            ...item,
            hoursSpent: safeHours,
            calculatedPoints: newPoints,
          };
        }
        return item;
      })
    );
  };

  const handleRunAiFallbackOnUnmatched = async () => {
    const unmatched = fetchedItems.filter((i) => !i.hasNamingConvention);
    if (unmatched.length === 0) {
      alert('All fetched files already follow the naming convention!');
      return;
    }

    setIsAiProcessing(true);
    try {
      const updatedList = [...fetchedItems];
      for (let idx = 0; idx < updatedList.length; idx++) {
        const item = updatedList[idx];
        if (!item.hasNamingConvention) {
          try {
            const res = await fetch('/api/gemini/classify-certificate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileName: item.name,
                fileText: `Certificate document name: ${item.name}.`,
              }),
            });
            const json = await res.json();
            if (json.success && json.data && json.data.category !== 'unrecognized') {
              const aiCatCode = json.data.category;
              let aiCatNum = parseInt(aiCatCode.replace('CAT-', ''), 10);
              if (isNaN(aiCatNum) || aiCatNum < 1 || aiCatNum > 15) aiCatNum = 6;

              const catObj = AICTE_CATEGORIES.find((c) => c.id === aiCatNum) || AICTE_CATEGORIES[0];
              const hours = 24;
              const points = Math.max(1, Math.round(hours / catObj.minHoursPerPoint));

              updatedList[idx] = {
                ...item,
                categoryNo: aiCatNum,
                categoryCode: aiCatCode,
                title: json.data.title || item.title,
                hoursSpent: hours,
                calculatedPoints: points,
                aiClassified: true,
              };
            }
          } catch (e) {
            console.warn('Gemini auto-classification notice for file:', item.name, e);
          }
        }
      }
      setFetchedItems(updatedList);
      setSuccessMsg('Gemini AI classification completed for non-standard file names!');
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleImportSelected = () => {
    const selectedFiles = fetchedItems.filter((i) => i.selected);
    if (selectedFiles.length === 0) {
      alert('Please select at least one certificate file to import.');
      return;
    }

    const newSubmissions: CertificateSubmission[] = selectedFiles.map((file) => {
      const category = AICTE_CATEGORIES.find((c) => c.id === file.categoryNo) || AICTE_CATEGORIES[0];

      const defaultStatus: SubmissionStatus = file.hasNamingConvention
        ? 'imported'
        : file.aiClassified
        ? 'imported'
        : file.mimeType !== 'application/pdf'
        ? 'skipped_not_pdf'
        : 'naming_error';

      return {
        id: `SUB-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 5)}`,
        studentId: student.id || `STU-${student.erpNo || student.rollNo}`,
        studentName: student.name,
        studentRollNo: student.rollNo,
        studentErpNo: student.erpNo,
        studentDepartment: student.department,
        studentDivision: student.division,
        assignedTgmName: student.tgmName || 'Prof. S. K. Mehta (TGM)',
        assignedCrName: student.crName || 'Ananya Verma (CR)',
        semester: file.semester || 'SEM_1',
        activityName: file.title,
        conductedBy: 'Google Drive Public Sync',
        activityCategoryNo: file.categoryNo,
        shortDescription: file.hasNamingConvention
          ? `Auto-synced from public Drive folder under category ${file.categoryCode} (${category.title}).`
          : file.aiClassified
          ? `Auto-classified by Gemini AI under category ${file.categoryCode} (${category.title}).`
          : `Synced from public Drive folder (${file.name}).`,
        hoursSpent: file.hoursSpent,
        calculatedPoints: file.calculatedPoints,
        currentFileDriveId: file.driveFileId,
        fileName: file.name,
        fileDriveIdHistory: [file.driveFileId],
        isCheckedByCR: false,
        isVerifiedByTGM: false,
        status: defaultStatus,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    onImportSubmissions(newSubmissions);

    confetti({
      particleCount: 70,
      spread: 60,
      origin: { y: 0.6 },
    });

    onClose();
  };

  const toggleSelectItem = (id: string) => {
    setFetchedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const toggleSelectAll = () => {
    const allSelected = fetchedItems.every((i) => i.selected);
    setFetchedItems((prev) => prev.map((item) => ({ ...item, selected: !allSelected })));
  };

  const activeSemObj = SEMESTER_TARGETS.find((s) => s.semester === targetSemester) || SEMESTER_TARGETS[0];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white border border-indigo-400/30">
              <FolderDown className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-950/80 px-2.5 py-0.5 rounded border border-indigo-800">
                Google Drive Auto-Sync Engine
              </span>
              <h3 className="text-xl font-bold text-white">
                Fetch Files from Public Google Drive Folder
              </h3>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
            Automatically scans certificate files, extracts semester & category from filenames (<code className="text-amber-300 bg-slate-950/80 px-1.5 py-0.5 rounded">SEM-01_CAT-06_Title.pdf</code>) or Google Drive subfolders, and files them directly under their target semesters.
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Inputs Section */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            {/* Drive Folder Link */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
                Public Google Drive Folder Link or Folder ID
              </label>
              <input
                type="text"
                value={folderLink}
                onChange={(e) => setFolderLink(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
                className="w-full bg-white text-slate-900 text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>

            {/* Auto Routing Info Badge */}
            <div className="bg-indigo-50/80 border border-indigo-200/80 p-3 rounded-xl flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shrink-0 shadow-2xs">
                <Sparkles className="w-4 h-4 text-indigo-200" />
              </div>
              <div className="text-xs">
                <span className="font-bold text-indigo-950">
                  Automatic Semester & Category Routing Active
                </span>
                <p className="text-slate-600 text-[11px] leading-tight">
                  No manual semester selection required! Files are automatically placed into <strong className="text-indigo-900">SEM 1 – SEM 8</strong> based on filename prefixes (<code className="font-mono text-indigo-800">SEM-01_...</code>) or subfolders (<code className="font-mono text-indigo-800">Sem 1/</code>).
                </p>
              </div>
            </div>
          </div>

          {/* Action Trigger Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              onClick={handleFetchFiles}
              disabled={isFetching}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold px-6 py-3 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isFetching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-200" />
                  Fetching Files from Drive...
                </>
              ) : (
                <>
                  <FolderDown className="w-4 h-4 text-indigo-200" />
                  Fetch Files Now
                </>
              )}
            </button>

            {fetchedItems.length > 0 && (
              <button
                onClick={handleRunAiFallbackOnUnmatched}
                disabled={isAiProcessing}
                className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-indigo-300 border border-indigo-700 text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isAiProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Running Gemini AI Categorization...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    Run Gemini AI on Non-Standard File Names
                  </>
                )}
              </button>
            )}
          </div>

          {/* Alerts */}
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-2xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-2xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Fetched Files Table & Preview */}
          {fetchedItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">
                    Fetched Certificates ({fetchedItems.length})
                  </span>
                  <span className="text-[11px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span>⚡</span> Auto-Routed Across Semesters
                  </span>
                </div>

                <button
                  onClick={toggleSelectAll}
                  className="text-xs font-semibold text-indigo-600 hover:underline"
                >
                  {fetchedItems.every((i) => i.selected) ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {fetchedItems.map((item) => {
                  const category = AICTE_CATEGORIES.find((c) => c.id === item.categoryNo) || AICTE_CATEGORIES[0];

                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleSelectItem(item.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        item.selected
                          ? 'bg-indigo-50/60 border-indigo-300 ring-1 ring-indigo-400/20'
                          : 'bg-white border-slate-200 hover:border-slate-300 opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() => toggleSelectItem(item.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                        />

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-xs sm:text-sm">
                              {item.title}
                            </span>
                            {item.semester && (
                              <span className="bg-indigo-950 text-indigo-200 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-800 flex items-center gap-1">
                                <span className="text-indigo-400">🎓</span>
                                {item.semester.replace('_', ' ')}
                                {item.subfolderPath && item.subfolderPath !== 'Root' ? ` (${item.subfolderPath})` : ''}
                              </span>
                            )}
                            {item.hasNamingConvention ? (
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                                <Check className="w-3 h-3 text-emerald-600" />
                                Naming Convention Matched ({item.categoryCode})
                              </span>
                            ) : item.aiClassified ? (
                              <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-200 flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-indigo-600" />
                                Gemini AI Classified ({item.categoryCode})
                              </span>
                            ) : (
                              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-200">
                                Default Category ({item.categoryCode})
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-500 font-mono truncate max-w-md">
                            📄 {item.name}
                          </p>

                          <div className="text-[11px] text-slate-600 flex items-center gap-3">
                            <span>
                              Category: <strong className="text-slate-800">{category.shortCode} - {category.title}</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between shrink-0 gap-1.5 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100">
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-xl shadow-2xs">
                            <label className="text-[10px] font-bold text-slate-700 uppercase tracking-tight">Hours:</label>
                            <input
                              type="number"
                              min={1}
                              max={300}
                              value={item.hoursSpent}
                              onChange={(e) => handleUpdateItemHours(item.id, parseInt(e.target.value) || 0)}
                              className="w-14 bg-white border border-slate-300 rounded-lg px-1.5 py-0.5 text-xs font-extrabold text-slate-900 text-center focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                            />
                          </div>
                          <span className="text-xs font-bold text-indigo-700 bg-indigo-100 border border-indigo-200 px-2 py-1 rounded-xl shrink-0">
                            = {item.calculatedPoints} Pts
                          </span>
                        </div>
                        <a
                          href={item.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[11px] font-semibold text-slate-500 hover:text-indigo-600 flex items-center gap-1 hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Preview
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-slate-600 font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
            Files will be automatically placed into their target Semesters (SEM 1 – SEM 8) as Pending CR Submissions.
          </span>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>

            {fetchedItems.length > 0 && (
              <button
                onClick={handleImportSelected}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                Auto-Import {fetchedItems.filter((i) => i.selected).length} Certificates
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
