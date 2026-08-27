import React, { useState } from 'react';
import {
  CertificateSubmission,
  AdminUser,
  Semester,
  UserProfile,
} from '../types';
import { SEMESTER_TARGETS, AICTE_CATEGORIES } from '../constants/aicteData';
import { generateClassProgressExcel, generateStudentActivityExcel } from '../utils/excelGenerator';
import { getDriveFileWebUrl, getDriveFolderWebUrl } from '../services/driveService';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RotateCcw,
  BarChart3,
  Check,
  Search,
  ExternalLink,
  Clock,
  HardDrive,
  Filter,
  FileText,
  Eye,
  GraduationCap,
  Users,
} from 'lucide-react';

interface TGMDashboardProps {
  submissions: CertificateSubmission[];
  admins: AdminUser[];
  allUsers?: UserProfile[];
  onApproveByTGM: (id: string, remarks?: string) => void;
  onRejectByTGM: (id: string, remarks: string) => void;
  onRequestResubmissionByTGM: (id: string, remarks: string) => void;
  onViewDetails: (sub: CertificateSubmission) => void;
  activeProfile: UserProfile;
}

export const TGMDashboard: React.FC<TGMDashboardProps> = ({
  submissions,
  admins: _admins,
  allUsers = [],
  onApproveByTGM,
  onRejectByTGM,
  onRequestResubmissionByTGM,
  onViewDetails,
  activeProfile,
}) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'students'>('queue');
  const [selectedSem, setSelectedSem] = useState<Semester | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [matrixSearchQuery, setMatrixSearchQuery] = useState('');
  const [matrixBatchFilter, setMatrixBatchFilter] = useState('ALL');
  const [selectedStudentForModal, setSelectedStudentForModal] = useState<UserProfile | null>(null);

  const [actionSubModal, setActionSubModal] = useState<{
    sub: CertificateSubmission;
    type: 'approve' | 'reject' | 'resubmit';
  } | null>(null);
  const [tgmRemarksInput, setTgmRemarksInput] = useState('');

  // ---------- Approval guards ----------
  const isApprovedTgm = activeProfile.tgmApprovalStatus === 'approved';

  // ---------- OWN STUDENTS — filtered strictly by tgmId ----------
  const buildOwnStudentMap = () => {
    const map = new Map<string, UserProfile>();

    // From allUsers — students whose tgmId points to this TGM
    allUsers.forEach((u) => {
      if (u.role === 'student' && u.tgmId === activeProfile.id) {
        map.set(u.id, u);
      }
    });

    // From submissions — if a submission is in our queue (already filtered by App.tsx)
    submissions.forEach((sub) => {
      if (!map.has(sub.studentId)) {
        map.set(sub.studentId, {
          id: sub.studentId,
          name: sub.studentName,
          email: `${sub.studentErpNo}@tcetmumbai.in`,
          role: 'student',
          rollNo: sub.studentRollNo,
          erpNo: sub.studentErpNo,
          department: sub.studentDepartment || 'Internet of Things (IoT)',
          division: sub.studentDivision || 'A',
          academicBatch: '2023-2027',
          tgmName: sub.assignedTgmName,
          tgmId: activeProfile.id,
          driveRootFolderId: '',
        });
      }
    });

    return Array.from(map.values());
  };

  const ownStudentsList = buildOwnStudentMap();

  // Batch filter options derived from actual data
  const availableBatches = Array.from(
    new Set(ownStudentsList.map((s) => s.academicBatch).filter(Boolean))
  ).sort();

  // Filtered students for matrix
  const filteredStudents = ownStudentsList.filter((st) => {
    const q = matrixSearchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      st.name.toLowerCase().includes(q) ||
      st.rollNo.toLowerCase().includes(q) ||
      st.erpNo.toLowerCase().includes(q);
    const matchesBatch = matrixBatchFilter === 'ALL' || st.academicBatch === matrixBatchFilter;
    return matchesSearch && matchesBatch;
  });

  // ---------- Stage-2 queue (already pre-filtered by App.tsx to this TGM's students) ----------
  const stage2Queue = submissions.filter((s) => s.status === 'pending_admin');
  const approvedList = submissions.filter((s) => s.status === 'approved');

  const filteredQueue = stage2Queue.filter((s) => {
    const matchesSem = selectedSem === 'ALL' || s.semester === selectedSem;
    const matchesSearch =
      s.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.studentRollNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.activityName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSem && matchesSearch;
  });

  const handleConfirmAction = () => {
    if (!actionSubModal) return;
    const { sub, type } = actionSubModal;
    if (type === 'approve') {
      onApproveByTGM(sub.id, tgmRemarksInput);
    } else if (type === 'reject') {
      if (!tgmRemarksInput.trim()) { alert('Please enter remarks for rejection.'); return; }
      onRejectByTGM(sub.id, tgmRemarksInput);
    } else if (type === 'resubmit') {
      if (!tgmRemarksInput.trim()) { alert('Please enter resubmission instructions.'); return; }
      onRequestResubmissionByTGM(sub.id, tgmRemarksInput);
    }
    setActionSubModal(null);
    setTgmRemarksInput('');
  };

  // ---------- Pending approval screen ----------
  if (!isApprovedTgm) {
    return (
      <div className="bg-white rounded-3xl border border-amber-200 shadow-xl p-4 sm:p-8 max-w-2xl mx-3 sm:mx-auto my-6 sm:my-12 text-center space-y-6">
        <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto border border-amber-200 shadow-xs">
          <Clock className="w-8 h-8 animate-pulse" />
        </div>
        <div>
          <span className="bg-amber-100 text-amber-800 text-[11px] font-extrabold px-3 py-1 rounded-full border border-amber-200 uppercase tracking-wider">
            ⏳ TGM Registration Pending Approval
          </span>
          <h2 className="text-2xl font-extrabold text-slate-900 mt-3">Awaiting Super Admin Authorization</h2>
          <p className="text-xs text-slate-600 mt-2 max-w-md mx-auto leading-relaxed">
            Welcome, <strong>{activeProfile.name}</strong>. Your TGM registration is awaiting Super Admin approval.
          </p>
        </div>
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left text-xs space-y-2.5 max-w-md mx-auto">
          <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
            <span className="text-slate-500 font-medium">Faculty Name:</span>
            <span className="font-bold text-slate-900">{activeProfile.name}</span>
          </div>
          <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
            <span className="text-slate-500 font-medium">Email:</span>
            <span className="font-mono text-slate-800">{activeProfile.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Approval Status:</span>
            <span className="font-bold text-amber-600">Pending Decision</span>
          </div>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer inline-flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" /> Refresh Approval Status
        </button>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-screen-xl mx-auto space-y-4 sm:space-y-6 pt-3 sm:pt-4 px-3 pb-10 sm:px-6 lg:px-8">

      {/* TGM Identity Header */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-xs border border-slate-200 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1 rounded-md border border-indigo-100">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              Teacher Guardian Mentor (TGM) Portal
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{activeProfile.name}</h2>
            <p className="text-slate-500 text-xs">
              TGM — Stage-2 verification & live AICTE points authorization for your assigned students.
            </p>
          </div>

          <div className="grid w-full grid-cols-2 gap-2.5 md:w-auto md:grid-cols-3">
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl text-center min-w-0">
              <span className="text-2xl font-bold text-amber-600">{stage2Queue.length}</span>
              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Pending Stage-2</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl text-center min-w-0">
              <span className="text-2xl font-bold text-indigo-600">{approvedList.length}</span>
              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Live Approved</p>
            </div>
            <div className="col-span-2 md:col-span-1 bg-slate-50 border border-slate-200 p-3 rounded-2xl text-center min-w-0">
              <span className="text-2xl font-bold text-slate-900">{ownStudentsList.length}</span>
              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">My Students</p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'queue'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Stage-2 Review Queue ({stage2Queue.length})
          </button>
          <button
            onClick={() => setActiveTab('students')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'students'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
            }`}
          >
            <Users className="w-4 h-4" />
            My Students ({ownStudentsList.length})
          </button>
        </div>
      </div>

      {/* TAB 1: STAGE-2 QUEUE */}
      {activeTab === 'queue' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-base">Stage-2 Approval Queue (TGM Review)</h3>
              <span className="bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-emerald-100">
                {filteredQueue.length} Checked by CR
              </span>
            </div>

            <div className="flex w-full flex-col sm:flex-row sm:items-center gap-2 flex-wrap md:w-auto">
              <div className="relative w-full sm:min-w-40">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search student..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <select
                value={selectedSem}
                onChange={(e) => setSelectedSem(e.target.value as any)}
                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="ALL">All Semesters</option>
                {SEMESTER_TARGETS.map((st) => (
                  <option key={`tgm-sem-${st.semester}`} value={st.semester}>
                    {st.semesterLabel}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {filteredQueue.length === 0 ? (
              <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-60" />
                <p className="font-bold text-slate-800 text-sm">Stage-2 Queue Empty!</p>
                <p className="text-xs text-slate-500 mt-1">No CR-checked items awaiting TGM final approval.</p>
              </div>
            ) : (
              filteredQueue.map((sub, idx) => {
                const cat = AICTE_CATEGORIES.find((c) => c.id === sub.activityCategoryNo);
                const subStudentProfile = allUsers.find((u) => u.id === sub.studentId);
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-slate-900 text-sm">{sub.studentName}</h4>
                            <span className="bg-slate-100 text-slate-700 text-[11px] px-2 py-0.5 rounded font-mono">
                              {sub.studentRollNo}
                            </span>
                            <span className="bg-emerald-50 text-emerald-700 text-[11px] px-2 py-0.5 rounded font-semibold border border-emerald-100 flex items-center gap-1">
                              <Check className="w-3 h-3" /> Checked by CR ✓
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">
                            ERP: {sub.studentErpNo} | Dept: {sub.studentDepartment} | Div: {sub.studentDivision}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] bg-indigo-50 text-indigo-700 font-semibold px-2.5 py-1 rounded-lg border border-indigo-100">
                        Semester: {sub.semester.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="md:col-span-2 space-y-1">
                        <p className="text-slate-500 font-medium">Activity Title & Conducted By:</p>
                        <p className="font-bold text-slate-900 text-xs">{sub.activityName}</p>
                        <p className="text-slate-600">Body: {sub.conductedBy}</p>
                        {sub.crRemarks && (
                          <p className="text-amber-800 bg-amber-50 p-1.5 rounded-lg border border-amber-200 text-[11px] mt-1 font-medium">
                            CR Remarks: "{sub.crRemarks}"
                          </p>
                        )}
                      </div>
                      <div className="space-y-1 border-t md:border-t-0 md:border-l border-slate-200 pt-2 md:pt-0 md:pl-3">
                        <p className="text-slate-500 font-medium">Points Authorization:</p>
                        <p className="font-semibold text-indigo-700">Cat {sub.activityCategoryNo}: {cat?.title}</p>
                        <p className="text-slate-800">Hours: <strong>{sub.hoursSpent} Hours</strong></p>
                        <p className="text-emerald-700 font-bold text-sm">To Award: +{sub.calculatedPoints} Pts</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">File: {sub.fileName}</span>
                        <span className="text-[10px] text-slate-500 font-mono">(Versions: {sub.fileDriveIdHistory.length})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={getDriveFolderWebUrl(subStudentProfile?.driveRootFolderId || sub.studentId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <HardDrive className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Student Root Folder</span>
                        </a>
                        <button
                          onClick={() => onViewDetails(sub)}
                          className="text-indigo-700 hover:text-indigo-900 font-semibold text-xs underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Full Audit & History
                        </button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-700">
                          Certificate revision history
                        </span>
                        {sub.crRemarks && (
                          <span className="text-[10px] font-semibold text-amber-700">
                            Corrected after CR feedback
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Array.from(new Set(sub.fileDriveIdHistory || [])).map((driveId, versionIndex) => {
                          const isCurrent = driveId === sub.currentFileDriveId;
                          return (
                            <a
                              key={`${driveId}-${versionIndex}`}
                              href={getDriveFileWebUrl(driveId)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                                isCurrent
                                  ? 'border-indigo-300 bg-indigo-600 text-white hover:bg-indigo-700'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300'
                              }`}
                            >
                              <ExternalLink className="h-3 w-3" />
                              Version {versionIndex + 1}{isCurrent ? ' — Current corrected file' : ' — Previous file'}
                            </a>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => setActionSubModal({ sub, type: 'reject' })}
                        className="flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 px-3 py-1.5 rounded-lg text-xs font-semibold"
                      >
                        <XCircle className="w-3.5 h-3.5 text-rose-600" /> Reject Entry
                      </button>
                      <button
                        onClick={() => setActionSubModal({ sub, type: 'resubmit' })}
                        className="flex items-center gap-1 bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 px-3 py-1.5 rounded-lg text-xs font-semibold"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-orange-600" /> Request Correction
                      </button>
                      <button
                        onClick={() => setActionSubModal({ sub, type: 'approve' })}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02]"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Approve & Credit Live Points (✓)
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MY STUDENTS MATRIX */}
      {activeTab === 'students' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-xs font-semibold px-2.5 py-0.5 rounded-md mb-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
                My Assigned Students
              </div>
              <h3 className="font-bold text-slate-900 text-xl tracking-tight">
                Student Progress Matrix
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                AICTE activity points tracking for students assigned to you as TGM.
              </p>
            </div>
            <button
              onClick={() => generateClassProgressExcel(filteredStudents, submissions, activeProfile.department || 'Internet of Things (IoT)')}
              className="bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
            >
              <BarChart3 className="w-3.5 h-3.5 text-emerald-200" />
              Export Matrix (.xlsx)
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 min-[481px]:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'My Students', value: ownStudentsList.length, color: 'text-slate-900' },
              { label: 'Total Approved Pts', value: submissions.filter(s => s.status === 'approved').reduce((a, b) => a + b.calculatedPoints, 0), color: 'text-emerald-600' },
              { label: 'Pending Stage-2', value: stage2Queue.length, color: 'text-amber-600' },
              { label: 'Graduation Ready', value: ownStudentsList.filter(st => submissions.filter(s => s.studentId === st.id && s.status === 'approved').reduce((a, b) => a + b.calculatedPoints, 0) >= 25).length, color: 'text-purple-600' },
            ].map((card) => (
              <div key={card.label} className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block mb-1">{card.label}</span>
                <h4 className={`text-2xl font-bold ${card.color}`}>{card.value}</h4>
              </div>
            ))}
          </div>

          {/* Search + Batch Filter */}
          <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Search students by name, roll no, ERP..."
                  value={matrixSearchQuery}
                  onChange={(e) => setMatrixSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>
              <div className="text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-xl shrink-0">
                Showing <strong className="text-indigo-700">{filteredStudents.length}</strong> of{' '}
                <strong className="text-slate-900">{ownStudentsList.length}</strong> Students
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/60">
              <span className="text-xs font-bold text-slate-600 flex items-center gap-1 mr-1">
                <Filter className="w-3.5 h-3.5 text-indigo-600" /> Filter:
              </span>
              <select
                value={matrixBatchFilter}
                onChange={(e) => setMatrixBatchFilter(e.target.value)}
                className="bg-white border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
              >
                <option value="ALL">All Batches</option>
                {availableBatches.map((batch) => (
                  <option key={`batch-${batch}`} value={batch}>
                    Batch: {batch}
                  </option>
                ))}
              </select>
              {(matrixSearchQuery || matrixBatchFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => { setMatrixSearchQuery(''); setMatrixBatchFilter('ALL'); }}
                  className="text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer ml-auto"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* Student Table — exact same structure as AdminPortal */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-slate-200 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Student Info</th>
                    <th className="py-3.5 px-4">Department & Batch</th>
                    <th className="py-3.5 px-4">Approved AICTE Points</th>
                    <th className="py-3.5 px-4 text-center">Submissions Breakdown</th>
                    <th className="py-3.5 px-4 text-center">Graduation Standing</th>
                    <th className="py-3.5 px-4 text-right">Certificate Log</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500 text-xs">
                        <GraduationCap className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        No students assigned to you yet.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((st, idx) => {
                      const studentSubs = submissions.filter((s) => s.studentId === st.id);
                      const approvedSubs = studentSubs.filter((s) => s.status === 'approved');
                      const approvedPts = approvedSubs.reduce((a, b) => a + b.calculatedPoints, 0);
                      const approvedHrs = approvedSubs.reduce((a, b) => a + b.hoursSpent, 0);
                      const pendingStage2 = studentSubs.filter((s) => s.status === 'pending_admin').length;
                      const pendingStage1 = studentSubs.filter((s) => s.status === 'pending_cr').length;
                      const progressPercent = Math.min(100, Math.round((approvedPts / 100) * 100));

                      let standingLabel = 'On Track (Good Standing)';
                      let standingBadgeBg = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                      if (approvedPts >= 75) { standingLabel = 'High Achiever (75+ Pts)'; standingBadgeBg = 'bg-purple-50 text-purple-800 border-purple-200'; }
                      else if (approvedPts >= 40) { standingLabel = 'On Track (SE Milestone)'; standingBadgeBg = 'bg-emerald-50 text-emerald-800 border-emerald-200'; }
                      else if (approvedPts >= 20) { standingLabel = 'Steady Progress'; standingBadgeBg = 'bg-indigo-50 text-indigo-800 border-indigo-200'; }
                      else { standingLabel = 'Beginner / Action Needed'; standingBadgeBg = 'bg-amber-50 text-amber-800 border-amber-200'; }

                      return (
                        <tr key={`${st.id}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center justify-center shrink-0 border border-indigo-200">
                                {st.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <h4 className="font-bold text-slate-900 text-sm">{st.name}</h4>
                                <p className="text-[11px] text-slate-500 font-mono">
                                  Roll: <strong className="text-slate-700">{st.rollNo}</strong> • ERP: <strong className="text-slate-700">{st.erpNo}</strong>
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-slate-700">
                            <span className="font-semibold text-slate-800 block text-xs">{st.department}</span>
                            <div className="text-xs text-slate-500 font-medium">Div {st.division} | {st.academicBatch}</div>
                          </td>
                          <td className="py-4 px-4 min-w-[180px]">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-extrabold text-slate-900">{approvedPts} / 100 Pts</span>
                                <span className="text-[11px] font-semibold text-slate-500">{approvedHrs} / 400 Hrs</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/80">
                                <div
                                  className={`h-2 rounded-full transition-all duration-500 ${approvedPts >= 75 ? 'bg-purple-600' : approvedPts >= 40 ? 'bg-emerald-600' : approvedPts >= 20 ? 'bg-indigo-600' : 'bg-amber-500'}`}
                                  style={{ width: `${Math.max(5, progressPercent)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold">
                              <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-bold">✓ {approvedSubs.length} Approved</span>
                              {pendingStage2 > 0 && <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-bold">{pendingStage2} TGM</span>}
                              {pendingStage1 > 0 && <span className="bg-sky-100 text-sky-800 px-2 py-0.5 rounded-md font-bold">{pendingStage1} CR</span>}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full border ${standingBadgeBg}`}>
                              {standingLabel}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <a
                                href={getDriveFolderWebUrl(st.driveRootFolderId)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                              >
                                <HardDrive className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Drive</span>
                              </a>
                              <button
                                onClick={() => setSelectedStudentForModal(st)}
                                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                Log ({studentSubs.length})
                              </button>
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
        </div>
      )}

      {/* Student Certificate Log Modal */}
      {selectedStudentForModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[calc(100dvh-1.5rem)] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">{selectedStudentForModal.name}'s Activity Submissions</h3>
                <p className="text-xs text-slate-500 font-mono">
                  Roll: {selectedStudentForModal.rollNo} • ERP: {selectedStudentForModal.erpNo} • Dept: {selectedStudentForModal.department}
                </p>
              </div>
              <button onClick={() => setSelectedStudentForModal(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-900 text-slate-100 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
                  <HardDrive className="w-5 h-5 text-emerald-100" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Student Google Drive Root Folder</p>
                  <span className="text-indigo-400 font-mono text-sm break-all">{selectedStudentForModal.driveRootFolderId || 'Not Configured'}</span>
                </div>
              </div>
              <a href={getDriveFolderWebUrl(selectedStudentForModal.driveRootFolderId)} target="_blank" rel="noopener noreferrer"
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-xs justify-center">
                <ExternalLink className="w-3.5 h-3.5" /> Open Drive Folder
              </a>
            </div>

            <div className="space-y-3">
              {submissions.filter((s) => s.studentId === selectedStudentForModal.id).length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6 italic">No certificate submissions uploaded yet by this student.</p>
              ) : (
                submissions.filter((s) => s.studentId === selectedStudentForModal.id).map((sub, idx) => (
                  <div key={`${sub.id}-${idx}`} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">{sub.activityName}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sub.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : sub.status === 'pending_admin' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'}`}>
                        {sub.status === 'approved' ? 'Approved (Live Points)' : sub.status === 'pending_admin' ? 'Stage-2 Pending (TGM)' : 'Stage-1 Pending (CR)'}
                      </span>
                    </div>
                    <p className="text-slate-600 text-[11px]">{sub.shortDescription}</p>
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/80 font-mono">
                      <span>Semester: <strong className="text-indigo-700">{sub.semester}</strong></span>
                      <span>Hours: <strong className="text-slate-800">{sub.hoursSpent} Hrs</strong></span>
                      <span>Points: <strong className="text-emerald-700">+{sub.calculatedPoints} Pts</strong></span>
                      <button onClick={() => { setSelectedStudentForModal(null); onViewDetails(sub); }} className="text-indigo-600 hover:text-indigo-800 font-bold underline flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" /> Full Audit
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                onClick={() => generateStudentActivityExcel(selectedStudentForModal, submissions.filter((s) => s.studentId === selectedStudentForModal.id))}
                className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <BarChart3 className="w-3.5 h-3.5 text-emerald-200" />
                Download {selectedStudentForModal.name}'s Excel Report (.xlsx)
              </button>
              <button onClick={() => setSelectedStudentForModal(null)} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TGM Action Modal */}
      {actionSubModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">
              {actionSubModal.type === 'approve' && 'Approve Entry & Credit Live Points'}
              {actionSubModal.type === 'reject' && 'Reject Certificate Submission'}
              {actionSubModal.type === 'resubmit' && 'Request Corrections / Resubmission'}
            </h3>
            <p className="text-xs text-slate-600">
              Activity: <strong>{actionSubModal.sub.activityName}</strong> ({actionSubModal.sub.calculatedPoints} Points)
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">TGM Mentor Remarks / Approval Note:</label>
              <textarea
                rows={3}
                value={tgmRemarksInput}
                onChange={(e) => setTgmRemarksInput(e.target.value)}
                placeholder={actionSubModal.type === 'approve' ? 'Optional: Verified against official records.' : 'Required: Explain why entry is being rejected or corrected.'}
                className="w-full border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setActionSubModal(null)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer">Cancel</button>
              <button
                onClick={handleConfirmAction}
                className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-md cursor-pointer ${actionSubModal.type === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : actionSubModal.type === 'reject' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-orange-600 hover:bg-orange-700'}`}
              >
                Confirm {actionSubModal.type}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
