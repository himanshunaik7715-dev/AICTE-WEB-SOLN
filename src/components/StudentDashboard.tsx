import React, { useState, useEffect } from 'react';
import { ReviewerOption, getReviewerOptions } from '../services/scopeService';
import { CertificateSubmission, Semester, UserProfile, AdminUser } from '../types';
import { SEMESTER_TARGETS, AICTE_CATEGORIES } from '../constants/aicteData';
import { generateStudentActivityExcel } from '../utils/excelGenerator';
import { getDriveFileWebUrl, getDriveFolderWebUrl } from '../services/driveService';
import { DriveFetchModal } from './DriveFetchModal';
import { SemesterFolderViewModal } from './SemesterFolderViewModal';
import {
  FileText,
  Upload,
  Download,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Award,
  ChevronRight,
  Filter,
  Layers,
  Sparkles,
  Search,
  ExternalLink,
  History,
  Check,
  HardDrive,
  UserCheck,
  GraduationCap,
  ShieldCheck,
  X,
  Edit3,
  FolderDown,
  FolderSearch,
  RefreshCw,
  Undo2,
} from 'lucide-react';

interface StudentDashboardProps {
  student: UserProfile;
  submissions: CertificateSubmission[];
  onOpenUploadModal: (sem?: Semester) => void;
  onViewSubmissionDetails: (sub: CertificateSubmission) => void;
  onResubmitRequested: (sub: CertificateSubmission) => void;
  onSelectProfile?: (profile: UserProfile) => void;
  admins?: AdminUser[];
  allUsers?: UserProfile[];
  onUpdateProfile?: (updatedProfile: UserProfile) => Promise<void> | void;
  onImportSubmissions?: (submissions: CertificateSubmission[]) => void;
  onBatchUpdateStatus?: (ids: string[], newStatus: any) => Promise<void> | void;
  onRunAiOnNamingError?: (submissionId: string) => Promise<void> | void;
  onUpdateSubmissionHours?: (id: string, hours: number, points: number) => Promise<void> | void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  student,
  submissions,
  onOpenUploadModal,
  onViewSubmissionDetails,
  onResubmitRequested,
  onSelectProfile,
  admins = [],
  allUsers = [],
  onUpdateProfile,
  onImportSubmissions,
  onBatchUpdateStatus,
  onRunAiOnNamingError,
  onUpdateSubmissionHours,
}) => {
  const [selectedSemFilter, setSelectedSemFilter] = useState<Semester | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Semester Folder View Modal state
  const [isSemesterFolderModalOpen, setIsSemesterFolderModalOpen] = useState(false);
  const [selectedFolderSem, setSelectedFolderSem] = useState<Semester>('SEM_1');

  // Drive Fetch Modal state
  const [isDriveFetchModalOpen, setIsDriveFetchModalOpen] = useState(false);
  const [driveFetchModalSem, setDriveFetchModalSem] = useState<Semester>('SEM_1');

  // CR Selector Modal state
  const [isCrModalOpen, setIsCrModalOpen] = useState(false);
  const [selectedCr, setSelectedCr] = useState<string>(
    student.crId || ''
  );
  const [crSaveSuccess, setCrSaveSuccess] = useState(false);

  // TGM Selector Modal state
  const [isTgmModalOpen, setIsTgmModalOpen] = useState(false);
  const [selectedTgm, setSelectedTgm] = useState<string>(
    student.tgmId && student.tgGroup ? `${student.tgmId}|${student.tgGroup}` : ''
  );
  const [tgmSaveSuccess, setTgmSaveSuccess] = useState(false);
  useEffect(() => {
    setSelectedCr(student.crId || '');
    setSelectedTgm(student.tgmId && student.tgGroup ? `${student.tgmId}|${student.tgGroup}` : '');
  }, [student.crId, student.tgmId, student.tgGroup, student.division, student.course, student.department]);

  // Google Drive Root Folder Modal state
  const [isDriveFolderModalOpen, setIsDriveFolderModalOpen] = useState(false);
  const [driveFolderInput, setDriveFolderInput] = useState(
    student.driveRootFolderId || ''
  );
  const [driveFolderSaveSuccess, setDriveFolderSaveSuccess] = useState(false);

  useEffect(() => {
    if (student.driveRootFolderId) {
      setDriveFolderInput(student.driveRootFolderId);
    }
  }, [student.driveRootFolderId]);

  const handleSaveDriveFolder = async () => {
    const val = driveFolderInput.trim();
    if (!val) return;

    if (onUpdateProfile) {
      await onUpdateProfile({
        ...student,
        driveRootFolderId: val,
      });
    }
    setDriveFolderSaveSuccess(true);
    setTimeout(() => {
      setDriveFolderSaveSuccess(false);
      setIsDriveFolderModalOpen(false);
    }, 800);
  };

  const [reviewerOptions, setReviewerOptions] = useState<ReviewerOption[]>([]);
  const [reviewerError, setReviewerError] = useState('');
  useEffect(() => {
    let active = true;
    setReviewerOptions([]);
    getReviewerOptions().then(options => { if(active) { setReviewerOptions(options); setReviewerError(''); } }).catch(() => { if(active) setReviewerError('Reviewer options unavailable. Please refresh; do not select an unverified assignment.'); });
    return () => { active = false; };
  }, [student.id, student.academicBatch, student.department, student.course, student.division, student.crId, student.tgmId]);
  const studentDivision = student.division || '';
  const crUsersFromDb = reviewerOptions.filter(o => o.reviewer_role === 'cr').map(o => ({ id: o.reviewer_id, name: o.name, division: studentDivision }));
  const availableCrs = crUsersFromDb.length > 0
    ? crUsersFromDb.map((u) => ({
        id: u.id,
        name: student.academicBatch === '2025-2029' ? `${u.name} (Division ${u.division})` : u.name,
      }))
    : [{ id: '', name: `No CR found for batch ${student.academicBatch}` }];

  const handleSaveCr = async () => {
    if (!selectedCr) return;
    const selectedCrObj = availableCrs.find(c => c.id === selectedCr);
    if (!selectedCrObj) return;

    if (onUpdateProfile) {
      await onUpdateProfile({
        ...student,
        crId: selectedCrObj.id,
        crName: selectedCrObj.name,
      });
    }
    setCrSaveSuccess(true);
    setTimeout(() => {
      setCrSaveSuccess(false);
      setIsCrModalOpen(false);
    }, 800);
  };

  // Approved TGMs and their groups come from the users table. `customRole`
  // stores one or more comma-separated TG groups for faculty profiles.
  const availableTgms = reviewerOptions.filter(o => o.reviewer_role === 'admin').map(o => ({ value: `${o.reviewer_id}|${o.tg_group}`, id: o.reviewer_id, tgGroup: o.tg_group, name: `${o.tg_group} — ${o.name}` }));
  const tgmOptions = availableTgms.length > 0
    ? availableTgms
    : [{ value: '', id: '', tgGroup: '', name: `No approved TGM found for batch ${student.academicBatch}` }];

  const handleSaveTgm = async () => {
    if (!selectedTgm) return;
    const selectedTgmObj = tgmOptions.find(t => t.value === selectedTgm);
    if (!selectedTgmObj) return;

    if (onUpdateProfile) {
      await onUpdateProfile({
        ...student,
        tgmId: selectedTgmObj.id,
        tgmName: selectedTgmObj.name,
        tgGroup: selectedTgmObj.tgGroup,
      });
    }
    setTgmSaveSuccess(true);
    setTimeout(() => {
      setTgmSaveSuccess(false);
      setIsTgmModalOpen(false);
    }, 800);
  };

  // Calculation Metrics
  const approvedSubmissions = submissions.filter((s) => s.status === 'approved');
  const totalApprovedHours = approvedSubmissions.reduce((acc, s) => acc + s.hoursSpent, 0);
  const totalApprovedPoints = approvedSubmissions.reduce((acc, s) => acc + s.calculatedPoints, 0);
  const overallProgressPct = Math.min(100, Math.round((totalApprovedPoints / 100) * 100));

  // Filter Submissions Table
  const filteredSubmissions = submissions.filter((s) => {
    const matchesSem = selectedSemFilter === 'ALL' || s.semester === selectedSemFilter;
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    const matchesSearch =
      s.activityName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.conductedBy.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSem && matchesStatus && matchesSearch;
  });

  const getStatusBadge = (sub: CertificateSubmission) => {
    switch (sub.status) {
      case 'imported':
        return (
          <span className="inline-flex items-center gap-1 bg-sky-100 text-sky-800 text-xs px-2.5 py-1 rounded-md font-semibold">
            Saved — Not Sent for Verification
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs px-2.5 py-1 rounded-md font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Verified (TGM Approved)
          </span>
        );
      case 'pending_admin':
        return (
          <span className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 text-xs px-2.5 py-1 rounded-md font-semibold">
            <Check className="w-3.5 h-3.5 text-indigo-600" />
            CR Checked ✓ (Awaiting TGM)
          </span>
        );
      case 'pending_cr':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-md font-semibold">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Stage-1 Pending (CR Review)
          </span>
        );
      case 'resubmission_requested':
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onResubmitRequested(sub);
            }}
            className="inline-flex items-center gap-1 bg-orange-600 hover:bg-orange-700 text-white text-xs px-2.5 py-1 rounded-md font-semibold shadow-xs transition-colors cursor-pointer"
            title="Click to open the re-upload modal"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Resubmission Needed
          </button>
        );
      case 'rejected':
        return (
          <span
            className="inline-flex items-center gap-1 bg-rose-100 text-rose-700 border border-rose-200 text-xs px-2.5 py-1 rounded-md font-semibold"
            title="This certificate was rejected by the TGM"
          >
            <Undo2 className="w-3.5 h-3.5" />
            Rejected by TGM
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full min-w-0 max-w-7xl mx-auto space-y-4 sm:space-y-6 pt-3 sm:pt-4 px-3 pb-10 sm:px-6 lg:px-8">
      {reviewerError && <p role="alert" className="text-sm text-red-700">{reviewerError}</p>}
      {/* Hero Overview Card - Clean Minimalism Style */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-xs border border-slate-200 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2.5 max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Student Portfolio & Points Progress
            </h2>
            <p className="text-slate-500 text-sm leading-relaxed">
              Track your semester-wise targets (48h/12pt for Odd Sems, 52h/13pt for Even Sems). Submissions undergo two-stage verification: Class Representative (CR) check followed by Teacher Guardian Mentor (TGM) approval.
            </p>

            <div className="pt-2 flex items-center gap-3 text-xs text-slate-600 flex-wrap">
              <span className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 font-medium">
                Odd Sem Target: <strong className="text-indigo-600">48 Hours / 12 Points</strong>
              </span>
              <span className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 font-medium">
                Even Sem Target: <strong className="text-emerald-600">52 Hours / 13 Points</strong>
              </span>
              <span className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 font-medium">
                4-Year Total: <strong className="text-slate-900">400 Hours / 100 Points</strong>
              </span>
            </div>
          </div>

          {/* Cumulative Gauge */}
          <div className="w-full lg:w-auto lg:min-w-60 bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200 flex flex-col items-center justify-center">
            <div className="text-center">
              <span className="text-4xl font-bold text-slate-900">{totalApprovedPoints}</span>
              <span className="text-slate-400 font-medium text-base"> / 100 Pts</span>
              <p className="text-xs text-slate-500 font-medium mt-1">
                ({totalApprovedHours} / 400 Hours Approved)
              </p>
            </div>

            <div className="w-full bg-slate-200 h-2 rounded-full mt-4 overflow-hidden">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${overallProgressPct}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Assigned Evaluators: Stage-1 CR & Stage-2 TGM */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stage 1: Assigned CR Card */}
        <div className="bg-linear-to-r from-slate-900 via-amber-950 to-slate-900 text-white rounded-2xl p-5 shadow-sm border border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-11 h-11 bg-amber-600/80 rounded-xl flex items-center justify-center shrink-0 border border-amber-400/30 text-white shadow-xs">
              <UserCheck className="w-6 h-6 text-amber-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/80">
                  Stage-1 Evaluator
                </span>
                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                  <Check className="w-3 h-3" /> CR Verification Active
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white mt-1 flex flex-wrap items-center gap-2">
                <span className="text-slate-300 font-medium">Assigned CR:</span>
                <span className="text-amber-300 font-extrabold">{student.crName || 'Not Assigned'}</span>
              </h3>
              <p className="text-xs text-amber-200/80 mt-0.5">
                Submissions go to <strong className="text-white">{student.crName || 'your CR'}</strong> for Stage-1 verification.
              </p>
            </div>
          </div>

          <button
            id="btn-change-cr"
            onClick={() => {
              setSelectedCr(student.crId || availableCrs[0]?.id || '');
              setIsCrModalOpen(true);
            }}
            className="bg-amber-600/90 hover:bg-amber-600 text-white border border-amber-400/40 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-xs"
          >
            <UserCheck className="w-4 h-4 text-amber-200" />
            <span>Select / Change CR</span>
          </button>
        </div>

        {/* Stage 2: Assigned TGM Card */}
        <div className="bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 shadow-sm border border-indigo-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-11 h-11 bg-indigo-600/80 rounded-xl flex items-center justify-center shrink-0 border border-indigo-400/30 text-white shadow-xs">
              <ShieldCheck className="w-6 h-6 text-indigo-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800/80">
                  Stage-2 Evaluator
                </span>
                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                  <Check className="w-3 h-3" /> Auto-Routing Active
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white mt-1 flex flex-wrap items-center gap-2">
                <span className="text-slate-300 font-medium">Assigned TGM:</span>
                <span className="text-amber-300 font-extrabold">{student.tgmName || 'Not Assigned'}</span>
              </h3>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                Submissions go to <strong className="text-white">{student.tgmName || 'your TGM'}</strong> for Stage-2 verification.
              </p>
            </div>
          </div>

          <button
            id="btn-change-tgm"
            onClick={() => {
              const currentValue = student.tgmId && student.tgGroup ? `${student.tgmId}|${student.tgGroup}` : '';
              setSelectedTgm(currentValue || tgmOptions[0]?.value || '');
              setIsTgmModalOpen(true);
            }}
            className="bg-indigo-600/90 hover:bg-indigo-600 text-white border border-indigo-400/40 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-xs"
          >
            <UserCheck className="w-4 h-4 text-amber-300" />
            <span>Select / Change TGM</span>
          </button>
        </div>
      </div>

      {/* Student's Personal Google Drive Root Folder Link Banner */}
      <div className="bg-slate-900 text-slate-100 rounded-2xl p-5 shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start md:items-center gap-3.5">
          <div className="w-11 h-11 bg-emerald-600/80 rounded-xl flex items-center justify-center shrink-0 border border-emerald-400/30 text-white shadow-xs">
            <HardDrive className="w-6 h-6 text-emerald-200" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/80">
                Official Certificate Repository
              </span>
              <span className="text-xs text-amber-300 font-semibold flex items-center gap-1">
                ⭐ Access Link for TGM & CR
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white flex flex-wrap items-center gap-2">
              <span className="text-slate-300 font-medium">Google Drive Root Folder:</span>
              <span className="text-emerald-300 font-mono text-xs sm:text-sm truncate max-w-xs sm:max-w-md bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
                {student.driveRootFolderId || 'Not Configured'}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Paste the link to your personal Google Drive folder where you store all activity certificates. Your assigned TGM <strong className="text-white">({student.tgmName || 'TGM'})</strong> can open and verify this repository directly.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">


          <a
            href={getDriveFolderWebUrl(student.driveRootFolderId)}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Open Folder</span>
          </a>

          <button
            id="btn-edit-drive-folder"
            onClick={() => {
              setDriveFolderInput(student.driveRootFolderId || '');
              setIsDriveFolderModalOpen(true);
            }}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Edit3 className="w-4 h-4 text-indigo-400" />
            <span>Link</span>
          </button>
        </div>
      </div>

      {/* Action Buttons Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-600" />
          <h3 className="font-semibold text-slate-900 text-base">Semester Target Tracker (Sem I - Sem VIII)</h3>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
          <button
            id="btn-fetch-files-action-bar"
            onClick={() => {
              setDriveFetchModalSem(selectedSemFilter !== 'ALL' ? selectedSemFilter : 'SEM_1');
              setIsDriveFetchModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-linear-to-r from-slate-900 to-indigo-950 hover:from-slate-800 hover:to-indigo-900 text-white px-4 py-2.5 rounded-lg text-sm font-bold shadow-xs transition-colors border border-indigo-500/30 cursor-pointer"
          >
            <FolderDown className="w-4 h-4 text-indigo-300" />
            <span>Fetch Files</span>
          </button>



          <button
            id="btn-export-excel"
            onClick={() => generateStudentActivityExcel(student, submissions)}
            className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-2.5 rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-200" />
            Export Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* Semester Progress Grid (Sem I - Sem VIII) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {SEMESTER_TARGETS.map((target, idx) => {
          const semSubmissions = submissions.filter((s) => s.semester === target.semester);
          const approvedSemSubs = semSubmissions.filter((s) => s.status === 'approved');
          const semHours = approvedSemSubs.reduce((acc, s) => acc + s.hoursSpent, 0);
          const semPoints = approvedSemSubs.reduce((acc, s) => acc + s.calculatedPoints, 0);
          const isTargetMet = semPoints >= target.targetPoints;
          const progressPct = Math.min(100, Math.round((semPoints / target.targetPoints) * 100));

          const pendingCrInSem = semSubmissions.filter((s) => s.status === 'pending_cr').length;
          const pendingAdminInSem = semSubmissions.filter((s) => s.status === 'pending_admin').length;

          const isSelected = selectedSemFilter === target.semester;

          return (
            <div
              key={`target-${target.semester}-${idx}`}
              onClick={() => {
                setSelectedFolderSem(target.semester);
                setIsSemesterFolderModalOpen(true);
              }}
              className={`bg-white rounded-2xl p-4 border transition-all cursor-pointer relative overflow-hidden hover:shadow-md ${
                isSelected
                  ? 'border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                  : 'border-slate-200 hover:border-indigo-300 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {target.academicYear}
                  </span>
                  <h4 className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                    {target.semesterLabel}
                    {isTargetMet && (
                      <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Met
                      </span>
                    )}
                  </h4>
                </div>

                <div
                  className={`text-xs px-2.5 py-1 rounded-md font-semibold ${
                    target.isOdd
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                  }`}
                >
                  {target.targetHours}h / {target.targetPoints}p
                </div>
              </div>

              {/* Stats */}
              <div className="mt-3 flex items-baseline justify-between text-xs">
                <span className="text-slate-500 font-medium">Earned:</span>
                <span className="font-bold text-slate-900">
                  {semHours}h / <span className="text-indigo-600">{semPoints} Pts</span>
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isTargetMet ? 'bg-emerald-500' : 'bg-indigo-600'
                  }`}
                  style={{ width: `${progressPct}%` }}
                ></div>
              </div>

              {/* Pending Indicators */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <div className="flex items-center gap-2">
                  {pendingCrInSem > 0 && (
                    <span className="text-amber-700 font-medium flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      {pendingCrInSem} CR
                    </span>
                  )}
                  {pendingAdminInSem > 0 && (
                    <span className="text-indigo-600 font-medium flex items-center gap-0.5">
                      <Check className="w-3 h-3" />
                      {pendingAdminInSem} TGM
                    </span>
                  )}
                  {pendingCrInSem === 0 && pendingAdminInSem === 0 && (
                    <span>{semSubmissions.length} Submissions</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDriveFetchModalSem(target.semester);
                      setIsDriveFetchModalOpen(true);
                    }}
                    className="text-indigo-600 hover:text-indigo-800 font-bold text-[11px] hover:underline flex items-center gap-0.5 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100"
                  >
                    <FolderDown className="w-3 h-3 text-indigo-500" />
                    Fetch
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Semester Drive Preview & Action Alert */}
      {selectedSemFilter !== 'ALL' && (
        <div className="bg-linear-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white p-4 rounded-2xl border border-indigo-500/30 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600/80 rounded-xl flex items-center justify-center shrink-0 border border-indigo-400/30 text-white">
              <FolderSearch className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800">
                  Active Semester Filter
                </span>
                <span className="text-xs text-emerald-400 font-medium">
                  Showing {filteredSubmissions.length} record(s)
                </span>
              </div>
              <h4 className="text-sm sm:text-base font-bold text-white mt-0.5">
                {SEMESTER_TARGETS.find((s) => s.semester === selectedSemFilter)?.semesterLabel} ({SEMESTER_TARGETS.find((s) => s.semester === selectedSemFilter)?.academicYear})
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setDriveFetchModalSem(selectedSemFilter);
                setIsDriveFetchModalOpen(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <FolderDown className="w-4 h-4 text-indigo-200" />
              <span>Fetch Files for {SEMESTER_TARGETS.find((s) => s.semester === selectedSemFilter)?.semesterLabel}</span>
            </button>

            <button
              onClick={() => setSelectedSemFilter('ALL')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Show All
            </button>
          </div>
        </div>
      )}

      {/* TGM Rejection Recovery Banner */}
      {submissions.some(
        (s) => s.status === 'rejected' && s.resubmissionRequestedBy === 'tgm'
      ) && (
        <div className="bg-linear-to-r from-rose-50 via-amber-50 to-rose-50 border-2 border-rose-200 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-rose-600 rounded-xl flex items-center justify-center text-white shrink-0 border border-rose-400/40 shadow-xs">
                <Undo2 className="w-5 h-5 text-rose-100" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-200">
                    Action Required
                  </span>
                  <span className="text-xs text-rose-700 font-semibold">
                    {submissions.filter(
                      (s) =>
                        s.status === 'rejected' &&
                        s.resubmissionRequestedBy === 'tgm'
                    ).length}{' '}
                    TGM-rejected file(s) need re-submission
                  </span>
                </div>
                <h4 className="text-sm sm:text-base font-bold text-rose-900">
                  How to recover a TGM-rejected file
                </h4>
                <p className="text-xs text-rose-800/80 leading-relaxed max-w-2xl">
                  Fix the certificate on Google Drive, then either click{' '}
                  <strong className="text-rose-900">Re-fetch</strong> to pull
                  the updated file from your Drive folder, or use{' '}
                  <strong className="text-rose-900">Re-upload</strong> to attach
                  a different shareable link. After the file is back in your
                  portfolio, click the new{' '}
                  <strong className="text-rose-900">Apply for CR</strong> button
                  to send it to your CR for Stage-1 verification. After CR
                  approval, it advances to Stage-2{' '}
                  <strong>TGM verification</strong>.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  const firstRejected = submissions.find(
                    (s) =>
                      s.status === 'rejected' &&
                      s.resubmissionRequestedBy === 'tgm'
                  );
                  if (firstRejected) {
                    setDriveFetchModalSem(firstRejected.semester);
                    setIsDriveFetchModalOpen(true);
                  }
                }}
                className="bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <FolderDown className="w-4 h-4 text-rose-200" />
                <span>Open Drive Re-fetch</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submissions Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Controls */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-base">Activity Certificate Records</h3>
            <span className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-indigo-100">
              {filteredSubmissions.length}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative w-full md:w-auto md:min-w-50">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search activity..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>

            {/* Semester Filter */}
            <select
              value={selectedSemFilter}
              onChange={(e) => setSelectedSemFilter(e.target.value as any)}
              className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="ALL">All Semesters (I - VIII)</option>
              {SEMESTER_TARGETS.map((st) => (
                <option key={`stu-sem-${st.semester}`} value={st.semester}>
                  {st.semesterLabel} ({st.targetHours}h / {st.targetPoints}p)
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="ALL">All Statuses</option>
              <option value="approved">Approved (TGM)</option>
              <option value="pending_admin">CR Checked ✓ (Pending TGM)</option>
              <option value="pending_cr">Pending CR Check</option>
              <option value="resubmission_requested">Resubmission Needed</option>
              <option value="rejected">Rejected by TGM (Re-submit via CR)</option>
            </select>
          </div>
        </div>

        {/* Submissions Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-4xl text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 font-bold border-b border-slate-100 uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Semester</th>
                <th className="py-3.5 px-4">Activity Title & Conducted By</th>
                <th className="py-3.5 px-4">AICTE Cat</th>
                <th className="py-3.5 px-4 text-center">Hours</th>
                <th className="py-3.5 px-4 text-center">Points</th>
                <th className="py-3.5 px-4 text-center">Stage 1 (CR)</th>
                <th className="py-3.5 px-4 text-center">Stage 2 (TGM)</th>
                <th className="py-3.5 px-4">Overall Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No activity submissions found matching selected filters.
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((sub, idx) => {
                  const category = AICTE_CATEGORIES.find((c) => c.id === sub.activityCategoryNo);

                  return (
                    <tr
                      key={`${sub.id}-${idx}`}
                      className="hover:bg-slate-50/60 transition-colors border-b border-slate-50"
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded-md text-[11px]">
                          {sub.semester.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="font-semibold text-slate-900 line-clamp-1">{sub.activityName}</p>
                        <p className="text-[11px] text-slate-500">Conducted by: {sub.conductedBy}</p>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 font-semibold px-2 py-0.5 rounded text-[11px]" title={category?.title}>
                          Cat {sub.activityCategoryNo}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center font-semibold text-slate-800">
                        {sub.hoursSpent}h
                      </td>

                      <td className="py-3.5 px-4 text-center font-bold text-indigo-600">
                        {sub.calculatedPoints} Pts
                      </td>

                      {/* Stage 1 CR Check tick */}
                      <td className="py-3.5 px-4 text-center">
                        {sub.isCheckedByCR ? (
                          <span
                            className="inline-flex items-center gap-0.5 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold text-[11px]"
                            title={`Checked by ${sub.crCheckedBy || 'CR'}`}
                          >
                            <Check className="w-3.5 h-3.5" /> CR ✓
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Stage 2 TGM Verification tick */}
                      <td className="py-3.5 px-4 text-center">
                        {sub.isVerifiedByTGM || sub.status === 'rejected' ? (
                          <span
                            className={
                              sub.status === 'rejected'
                                ? "inline-flex items-center gap-0.5 text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md font-semibold text-[11px]"
                                : "inline-flex items-center gap-0.5 text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full font-semibold text-[11px]"
                            }
                            title={
                              sub.status === 'rejected'
                                ? `Rejected by ${sub.tgmVerifiedBy || sub.assignedTgmName || student.tgmName || 'TGM'}`
                                : `Verified by ${sub.tgmVerifiedBy || sub.assignedTgmName || student.tgmName || 'TGM'}`
                            }
                          >
                            {sub.status === 'rejected' ? (
                              <>
                                <X className="w-3 h-3 text-rose-600" /> TGM ✓
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" /> TGM ✓
                              </>
                            )}
                          </span>
                        ) : (
                          <span
                            className="text-slate-500 text-[11px] font-medium bg-slate-100 px-2 py-0.5 rounded-md"
                            title={`Assigned to TGM: ${sub.assignedTgmName || student.tgmName || 'TGM'}`}
                          >
                            Awaiting {sub.assignedTgmName || student.tgmName || 'TGM'}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {getStatusBadge(sub)}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={getDriveFileWebUrl(sub.currentFileDriveId)}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-semibold"
                            title="Open Certificate in Google Drive"
                          >
                            <HardDrive className="w-3.5 h-3.5" />
                            <span className="hidden lg:inline">Drive</span>
                          </a>

                          <button
                            onClick={() => onViewSubmissionDetails(sub)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="View Submission Details & File History"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>

                          {sub.status === 'resubmission_requested' && (
                            <button
                              onClick={() => onResubmitRequested(sub)}
                              className="flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 rounded-md text-[11px] font-semibold shadow-xs transition-colors"
                            >
                              <History className="w-3 h-3" /> Re-upload
                            </button>
                          )}

                          {sub.status === 'rejected' && (
                            <button
                              onClick={() => onResubmitRequested(sub)}
                              className="flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 rounded-md text-[11px] font-semibold shadow-xs transition-colors"
                              title="Re-upload a different file"
                            >
                              <History className="w-3 h-3" /> Re-upload
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Select / Change CR Modal */}
      {isCrModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-5 relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="bg-amber-50 text-amber-600 p-2 rounded-xl border border-amber-100">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Select Your Class Representative (CR)</h3>
                  <p className="text-xs text-slate-500">
                    Assign CR for Stage-1 Submission Verification
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCrModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-900 leading-relaxed">
                <strong>Stage-1 Evaluation:</strong> Your activity certificate submissions will first be checked by your selected Class Representative (CR) before being forwarded to your TGM.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Choose Registered Class Representative (CR) *
                </label>
                <select
                  value={selectedCr}
                  onChange={(e) => setSelectedCr(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 focus:outline-none shadow-2xs cursor-pointer"
                >
                  {availableCrs.map((cr) => (
                    <option key={`cr-opt-${cr.id}`} value={cr.id}>
                      {cr.name}
                    </option>
                  ))}
                </select>
              </div>

              {crSaveSuccess && (
                <div className="bg-emerald-50 text-emerald-800 text-xs p-2.5 rounded-xl border border-emerald-200 font-semibold text-center flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Assigned CR updated successfully!
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setIsCrModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCr}
                className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                <span>Save Assigned CR</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Select / Change TGM Modal */}
      {isTgmModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-5 relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="bg-indigo-50 text-indigo-600 p-2 rounded-xl border border-indigo-100">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Select Your TGM Mentor</h3>
                  <p className="text-xs text-slate-500">
                    Assign Teacher Guardian Mentor for Stage-2 Verification
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsTgmModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-900 leading-relaxed">
                <strong>Note:</strong> All your current & future activity certificate submissions will automatically be routed directly to this Teacher Guardian Mentor (TGM).
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Choose Registered TGM Faculty *
                </label>
                <select
                  value={selectedTgm}
                  onChange={(e) => setSelectedTgm(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none shadow-2xs cursor-pointer"
                >
                  {tgmOptions.map((tgm) => (
                    <option key={`tgm-opt-${tgm.value}`} value={tgm.value}>
                      {tgm.name}
                    </option>
                  ))}
                </select>
              </div>

              {tgmSaveSuccess && (
                <div className="bg-emerald-50 text-emerald-800 text-xs p-2.5 rounded-xl border border-emerald-200 font-semibold text-center flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Assigned TGM updated successfully!
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setIsTgmModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTgm}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
              >
                <UserCheck className="w-4 h-4" />
                <span>Save Assigned TGM</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Google Drive Root Folder Update Modal */}
      {isDriveFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center font-bold">
                  <HardDrive className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    Link Your Google Drive Root Folder
                  </h4>
                  <p className="text-xs text-slate-500">
                    TCET AICTE Certificate Repository
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDriveFolderModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-xl text-xs text-indigo-900 leading-relaxed">
                <strong>Why is this required?</strong> Your assigned TGM <strong className="text-indigo-950">({student.tgmName || 'your TGM'})</strong> needs a single direct link to your master Google Drive folder where you store all original activity certificates, completion letters, and grade cards.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Google Drive Folder Link / ID *
                </label>
                <input
                  type="text"
                  placeholder="Paste a Google Drive folder link or folder ID"
                  value={driveFolderInput}
                  onChange={(e) => setDriveFolderInput(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Paste the share link from Google Drive (Make sure access permissions are set to "Anyone with the link can view").
                </p>
              </div>

              {driveFolderSaveSuccess && (
                <div className="bg-emerald-50 text-emerald-800 text-xs p-2.5 rounded-xl border border-emerald-200 font-semibold text-center flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Google Drive Root Folder link saved successfully!
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <a
                href={getDriveFolderWebUrl(driveFolderInput)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Test / Verify Link
              </a>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDriveFolderModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveDriveFolder}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <HardDrive className="w-4 h-4" />
                  <span>Save Folder Link</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Google Drive Auto-Sync & File Fetch Modal */}
      <DriveFetchModal
        isOpen={isDriveFetchModalOpen}
        onClose={() => setIsDriveFetchModalOpen(false)}
        student={student}
        defaultSemester={driveFetchModalSem}
        onImportSubmissions={(newSubs) => {
          if (onImportSubmissions) {
            onImportSubmissions(newSubs);
          }
        }}
      />

      {/* Semester Folder View & Verification Submission Modal */}
      <SemesterFolderViewModal
        isOpen={isSemesterFolderModalOpen}
        onClose={() => setIsSemesterFolderModalOpen(false)}
        semester={selectedFolderSem}
        student={student}
        submissions={submissions}
        onUpdateStatusBatch={(ids, newStatus) => {
          if (onBatchUpdateStatus) {
            onBatchUpdateStatus(ids, newStatus);
          }
        }}
        onOpenDriveFetchModal={(sem) => {
          setDriveFetchModalSem(sem);
          setIsDriveFetchModalOpen(true);
        }}
        onRunAiOnNamingError={(subId) => {
          if (onRunAiOnNamingError) {
            return onRunAiOnNamingError(subId);
          }
        }}
        onUpdateSubmissionHours={(id, hours, points) => {
          if (onUpdateSubmissionHours) {
            return onUpdateSubmissionHours(id, hours, points);
          }
        }}
      />
    </div>
  );
};
