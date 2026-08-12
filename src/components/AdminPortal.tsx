import React, { useState } from 'react';
import {
  CertificateSubmission,
  AdminUser,
  Semester,
  UserProfile,
} from '../types';
import { SEMESTER_TARGETS, AICTE_CATEGORIES } from '../constants/aicteData';
import { SEEDED_PROFILES } from '../services/dbService';
import { generateClassProgressExcel, generateStudentActivityExcel } from '../utils/excelGenerator';
import { getDriveFolderWebUrl } from '../services/driveService';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Users,
  Shield,
  Plus,
  Trash2,
  Search,
  ExternalLink,
  Award,
  BarChart3,
  Check,
  Building,
  Mail,
  UserPlus,
  GraduationCap,
  Clock,
  ChevronRight,
  HardDrive,
  Filter,
  FileText,
  AlertCircle,
  Eye,
  CheckCircle,
  UserCheck,
  UserX,
  Crown,
  X,
} from 'lucide-react';

interface AdminPortalProps {
  submissions: CertificateSubmission[];
  admins: AdminUser[];
  allUsers?: UserProfile[];
  onApproveByTGM: (id: string, remarks?: string) => void;
  onRejectByTGM: (id: string, remarks: string) => void;
  onRequestResubmissionByTGM: (id: string, remarks: string) => void;
  onAddAdmin: (newAdmin: Omit<AdminUser, 'id' | 'addedAt'>) => void;
  onRemoveAdmin: (id: string) => void;
  onApproveTgmUser?: (userIdOrEmail: string) => void;
  onRejectTgmUser?: (userIdOrEmail: string) => void;
  onViewDetails: (sub: CertificateSubmission) => void;
  studentProfile: UserProfile;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  submissions,
  admins,
  allUsers = [],
  onApproveByTGM,
  onRejectByTGM,
  onRequestResubmissionByTGM,
  onAddAdmin,
  onRemoveAdmin,
  onApproveTgmUser,
  onRejectTgmUser,
  onViewDetails,
  studentProfile,
}) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'whitelist' | 'reports'>('queue');
  const [selectedSem, setSelectedSem] = useState<Semester | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Class Progress Matrix States
  const [matrixSearchQuery, setMatrixSearchQuery] = useState('');
  const [matrixDeptFilter, setMatrixDeptFilter] = useState('ALL');
  const [matrixDivFilter, setMatrixDivFilter] = useState('ALL');
  const [matrixStandingFilter, setMatrixStandingFilter] = useState('ALL');
  const [matrixTgmFilter, setMatrixTgmFilter] = useState('ALL');
  const [selectedStudentForModal, setSelectedStudentForModal] = useState<UserProfile | null>(null);

  // TGM Approval Modal state
  const [actionSubModal, setActionSubModal] = useState<{
    sub: CertificateSubmission;
    type: 'approve' | 'reject' | 'resubmit';
  } | null>(null);
  const [tgmRemarksInput, setTgmRemarksInput] = useState('');

  // New Admin Form state
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminDesignation, setNewAdminDesignation] = useState('Teacher Guardian Mentor (TGM)');
  const [newAdminDept, setNewAdminDept] = useState('Internet of Things (IoT)');

  // Stage 2 Queue: Checked by CR, awaiting TGM approval
  const [selectedTgmFilter, setSelectedTgmFilter] = useState<string>('MY_MENTEES');

  const tgmOptions = Array.from(
    new Set([
      ...admins.map((a) => a.name),
      ...submissions.map((s) => s.assignedTgmName).filter(Boolean) as string[],
      'Prof. S. K. Mehta',
      'Dr. Rajesh Patel',
    ])
  );

  const stage2Queue = submissions.filter((s) => s.status === 'pending_admin');
  const approvedList = submissions.filter((s) => s.status === 'approved');

  const filteredQueue = stage2Queue.filter((s) => {
    const matchesSem = selectedSem === 'ALL' || s.semester === selectedSem;
    const matchesSearch =
      s.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.studentRollNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.activityName.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesTgm = true;
    const subTgm = (s.assignedTgmName || 'Prof. S. K. Mehta').toLowerCase();

    if (selectedTgmFilter === 'MY_MENTEES') {
      const activeName = studentProfile.name.toLowerCase();
      matchesTgm = subTgm.includes(activeName) || activeName.includes(subTgm);
    } else if (selectedTgmFilter !== 'ALL') {
      const filterName = selectedTgmFilter.toLowerCase();
      matchesTgm = subTgm.includes(filterName) || filterName.includes(subTgm);
    }

    return matchesSem && matchesSearch && matchesTgm;
  });

  const handleConfirmAction = () => {
    if (!actionSubModal) return;
    const { sub, type } = actionSubModal;

    if (type === 'approve') {
      onApproveByTGM(sub.id, tgmRemarksInput);
    } else if (type === 'reject') {
      if (!tgmRemarksInput.trim()) {
        alert('Please enter remarks for rejection.');
        return;
      }
      onRejectByTGM(sub.id, tgmRemarksInput);
    } else if (type === 'resubmit') {
      if (!tgmRemarksInput.trim()) {
        alert('Please enter resubmission instructions.');
        return;
      }
      onRequestResubmissionByTGM(sub.id, tgmRemarksInput);
    }

    setActionSubModal(null);
    setTgmRemarksInput('');
  };

  const handleCreateAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim() || !newAdminName.trim()) {
      alert('Please fill out email and name.');
      return;
    }

    onAddAdmin({
      email: newAdminEmail.trim(),
      name: newAdminName.trim(),
      designation: newAdminDesignation,
      department: newAdminDept,
      addedBy: 'System Admin (Current Session)',
      isWhitelisted: true,
    });

    setNewAdminEmail('');
    setNewAdminName('');
    setShowAddAdminModal(false);
  };

  const isSeedSuperAdmin = studentProfile.email.toLowerCase() === 'superadmin@tcetmumbai.in';
  const isSuperAdminRole = studentProfile.role === 'superadmin';

  const isApprovedSuperAdmin =
    isSeedSuperAdmin ||
    (isSuperAdminRole &&
      (studentProfile.tgmApprovalStatus === 'approved' ||
        admins.some(
          (a) =>
            a.email.toLowerCase() === studentProfile.email.toLowerCase() &&
            (a.isWhitelisted || a.approvalStatus === 'approved')
        )));

  // Redirect away from whitelist tab if user is not Super Admin
  React.useEffect(() => {
    if (!isApprovedSuperAdmin && activeTab === 'whitelist') {
      setActiveTab('queue');
    }
  }, [isApprovedSuperAdmin, activeTab]);

  const isApprovedTgm =
    isApprovedSuperAdmin ||
    studentProfile.tgmApprovalStatus === 'approved' ||
    admins.some(
      (a) =>
        a.email.toLowerCase() === studentProfile.email.toLowerCase() &&
        (a.isWhitelisted || a.approvalStatus === 'approved')
    );

  // Pending TGM and Super Admin Requests Computation
  const pendingRequestsMap = new Map<
    string,
    { id: string; name: string; email: string; department: string; designation: string; date: string; role: 'admin' | 'superadmin' }
  >();

  allUsers.filter((u) => u.role === 'admin' && u.tgmApprovalStatus === 'pending').forEach((u) => {
    pendingRequestsMap.set(u.email.toLowerCase(), {
      id: u.id,
      name: u.name,
      email: u.email,
      department: u.department || 'Internet of Things (IoT)',
      designation: 'Teacher Guardian Mentor (TGM)',
      date: 'Recent Sign-Up Request',
      role: 'admin',
    });
  });

  allUsers
    .filter((u) => u.role === 'superadmin' && u.tgmApprovalStatus === 'pending' && u.email.toLowerCase() !== 'superadmin@tcetmumbai.in')
    .forEach((u) => {
      pendingRequestsMap.set(u.email.toLowerCase(), {
        id: u.id,
        name: u.name,
        email: u.email,
        department: u.department || 'Institutional Head Office',
        designation: 'Super Admin (Applicant)',
        date: 'Recent Sign-Up Request',
        role: 'superadmin',
      });
    });

  admins
    .filter((a) => a.approvalStatus === 'pending' || (a.addedBy.includes('Request') && !a.isWhitelisted))
    .forEach((a) => {
      const isSuperApp = a.designation.includes('Super Admin') || a.addedBy.includes('Super Admin');
      pendingRequestsMap.set(a.email.toLowerCase(), {
        id: a.id,
        name: a.name,
        email: a.email,
        department: a.department,
        designation: a.designation,
        date: a.addedAt || 'Recent Sign-Up Request',
        role: isSuperApp ? 'superadmin' : 'admin',
      });
    });

  const allPendingRequests = Array.from(pendingRequestsMap.values());
  const pendingSuperAdminRequests = allPendingRequests.filter((r) => r.role === 'superadmin');
  const pendingTgmRequests = allPendingRequests.filter((r) => r.role !== 'superadmin');

  // Render pending authorization notice if user signed up as Super Admin and is not yet approved
  if (studentProfile.role === 'superadmin' && !isApprovedSuperAdmin) {
    return (
      <div className="bg-white rounded-3xl border border-amber-200 shadow-xl p-8 max-w-2xl mx-auto my-12 text-center space-y-6">
        <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto border border-amber-200 shadow-xs">
          <Clock className="w-8 h-8 animate-pulse" />
        </div>

        <div>
          <span className="bg-amber-100 text-amber-800 text-[11px] font-extrabold px-3 py-1 rounded-full border border-amber-200 uppercase tracking-wider">
            ⏳ Super Admin Registration Pending Approval
          </span>
          <h2 className="text-2xl font-extrabold text-slate-900 mt-3">
            Awaiting Existing Super Admin Authorization
          </h2>
          <p className="text-xs text-slate-600 mt-2 max-w-md mx-auto leading-relaxed">
            Welcome, <strong>{studentProfile.name}</strong>. Your sign-up request for <strong>Super Admin (Principal / Head)</strong> authorization has been submitted to the active <strong>Super Admin</strong> for official verification and approval.
          </p>
        </div>

        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left text-xs space-y-2.5 max-w-md mx-auto">
          <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
            <span className="text-slate-500 font-medium">Applicant Name:</span>
            <span className="font-bold text-slate-900">{studentProfile.name}</span>
          </div>
          <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
            <span className="text-slate-500 font-medium">Email Address:</span>
            <span className="font-mono text-slate-800">{studentProfile.email}</span>
          </div>
          <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
            <span className="text-slate-500 font-medium">Requested Role:</span>
            <span className="font-semibold text-indigo-700">Super Admin / Principal</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Approval Status:</span>
            <span className="font-bold text-amber-600">Pending Decision</span>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={() => window.location.reload()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer inline-flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" /> Refresh Authorization Status
          </button>
        </div>
      </div>
    );
  }

  // Render pending authorization notice if user is TGM and not yet approved by Super Admin
  if (studentProfile.role === 'admin' && !isApprovedTgm) {
    return (
      <div className="bg-white rounded-3xl border border-amber-200 shadow-xl p-8 max-w-2xl mx-auto my-12 text-center space-y-6">
        <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto border border-amber-200 shadow-xs">
          <Clock className="w-8 h-8 animate-pulse" />
        </div>

        <div>
          <span className="bg-amber-100 text-amber-800 text-[11px] font-extrabold px-3 py-1 rounded-full border border-amber-200 uppercase tracking-wider">
            ⏳ TGM Registration Pending Approval
          </span>
          <h2 className="text-2xl font-extrabold text-slate-900 mt-3">
            Awaiting Super Admin Authorization
          </h2>
          <p className="text-xs text-slate-600 mt-2 max-w-md mx-auto leading-relaxed">
            Welcome, <strong>{studentProfile.name}</strong>. Your sign-up request for <strong>Teacher Guardian Mentor (TGM)</strong> status has been sent to the <strong>Super Admin (Principal / AICTE Head)</strong> for official approval.
          </p>
        </div>

        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left text-xs space-y-2.5 max-w-md mx-auto">
          <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
            <span className="text-slate-500 font-medium">Faculty Name:</span>
            <span className="font-bold text-slate-900">{studentProfile.name}</span>
          </div>
          <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
            <span className="text-slate-500 font-medium">Email Address:</span>
            <span className="font-mono text-slate-800">{studentProfile.email}</span>
          </div>
          <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
            <span className="text-slate-500 font-medium">Department:</span>
            <span className="font-semibold text-slate-800">{studentProfile.department}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Approval Status:</span>
            <span className="font-bold text-amber-600">Pending Decision</span>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={() => window.location.reload()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer inline-flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" /> Refresh Approval Status
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Admin Header */}
      <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1 rounded-md border border-indigo-100">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              Stage-2 Verification & Admin Portal
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              {isApprovedSuperAdmin
                ? 'Super Admin & TGM Portal'
                : 'Teacher Guardian Mentor (TGM) Portal'}
            </h2>
            <p className="text-slate-500 text-xs leading-relaxed max-w-xl">
              {isApprovedSuperAdmin
                ? 'Conduct final Stage-2 approval for CR-checked entries, authorize live AICTE points credit, manage Whitelisted Admin emails, and track department compliance.'
                : 'Conduct final Stage-2 approval for CR-checked entries, authorize live AICTE points credit, and track class department compliance.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl text-center min-w-[110px]">
              <span className="text-2xl font-bold text-amber-600">{stage2Queue.length}</span>
              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Pending Stage-2</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl text-center min-w-[110px]">
              <span className="text-2xl font-bold text-indigo-600">{approvedList.length}</span>
              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Live Approved</p>
            </div>
            {isApprovedSuperAdmin && (
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl text-center min-w-[110px]">
                <span className="text-2xl font-bold text-slate-900">{admins.length}</span>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Whitelisted Admins</p>
              </div>
            )}
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

          {isApprovedSuperAdmin && (
            <button
              onClick={() => setActiveTab('whitelist')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'whitelist'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
              }`}
            >
              <Shield className="w-4 h-4" />
              Admin Whitelist Panel ({admins.length})
            </button>
          )}

          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'reports'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Class Progress Matrix
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

            <div className="flex items-center gap-2 flex-wrap">
              {/* Quick Scope Toggles */}
              <div className="bg-slate-200/80 p-0.5 rounded-lg flex items-center text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setSelectedTgmFilter('MY_MENTEES')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    selectedTgmFilter === 'MY_MENTEES'
                      ? 'bg-indigo-600 text-white font-bold shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  ⭐ My Mentees
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTgmFilter('ALL')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    selectedTgmFilter === 'ALL'
                      ? 'bg-slate-800 text-white font-bold shadow-xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  🌐 All Mentees ({stage2Queue.length})
                </button>
              </div>

              <div className="relative min-w-[160px]">
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
                value={selectedTgmFilter}
                onChange={(e) => setSelectedTgmFilter(e.target.value)}
                className="bg-indigo-50/80 border border-indigo-200 text-indigo-900 font-bold rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                title="Filter Stage-2 Queue by Assigned Teacher Guardian Mentor"
              >
                <option value="MY_MENTEES">⭐ My Mentees ({studentProfile.name.split(' ')[0]})</option>
                <option value="ALL">All TGMs ({stage2Queue.length})</option>
                {tgmOptions.map((tgm) => (
                  <option key={`tgm-filter-opt-${tgm}`} value={tgm}>
                    {tgm}
                  </option>
                ))}
              </select>

              <select
                value={selectedSem}
                onChange={(e) => setSelectedSem(e.target.value as any)}
                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="ALL">All Semesters</option>
                {SEMESTER_TARGETS.map((st) => (
                  <option key={`admin-sem-${st.semester}`} value={st.semester}>
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
                <p className="text-xs text-slate-500 mt-1">
                  There are currently no CR-checked items awaiting TGM final approval.
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
                            <span className="bg-emerald-50 text-emerald-700 text-[11px] px-2 py-0.5 rounded font-semibold border border-emerald-100 flex items-center gap-1">
                              <Check className="w-3 h-3" /> Checked by CR ✓
                            </span>
                            <span className="bg-indigo-50 text-indigo-800 text-[11px] px-2 py-0.5 rounded font-bold border border-indigo-200 flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3 text-indigo-600" />
                              Assigned TGM: {sub.assignedTgmName || 'Prof. S. K. Mehta'}
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

                    {/* Submission Info */}
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
                        <p className="text-emerald-700 font-bold text-sm">
                          To Award: +{sub.calculatedPoints} Pts
                        </p>
                      </div>
                    </div>

                    {/* File & Version History */}
                    <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">File: {sub.fileName}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          (Versions: {sub.fileDriveIdHistory.length})
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <a
                          href={getDriveFolderWebUrl(sub.studentFolderId || sub.studentId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                          title="Open Student's Google Drive Root Folder"
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

                    {/* TGM Actions */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => setActionSubModal({ sub, type: 'reject' })}
                        className="flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 px-3 py-1.5 rounded-lg text-xs font-semibold"
                      >
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        Reject Entry
                      </button>

                      <button
                        onClick={() => setActionSubModal({ sub, type: 'resubmit' })}
                        className="flex items-center gap-1 bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 px-3 py-1.5 rounded-lg text-xs font-semibold"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-orange-600" />
                        Request Correction
                      </button>

                      <button
                        onClick={() => setActionSubModal({ sub, type: 'approve' })}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02]"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Approve & Credit Live Points (✓)
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SUPER ADMIN & WHITELIST PANEL */}
      {activeTab === 'whitelist' && isApprovedSuperAdmin && (
        <div className="space-y-6">
          {/* PENDING SUPER ADMIN SIGNUP REQUESTS */}
          <div className="bg-white rounded-2xl border border-indigo-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-indigo-100 bg-indigo-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    Super Admin Sign-Up Approval Queue
                    <span className="bg-indigo-100 text-indigo-800 text-xs font-extrabold px-2.5 py-0.5 rounded-full border border-indigo-200">
                      {pendingSuperAdminRequests.length} Super Admin Applicants
                    </span>
                  </h3>
                  <p className="text-xs text-slate-600">
                    Applicants who signed up requesting Super Admin / Principal privileges. Existing Super Admin holds deciding authority.
                  </p>
                </div>
              </div>
            </div>

            {pendingSuperAdminRequests.length === 0 ? (
              <div className="p-6 text-center bg-slate-50/30">
                <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">No Pending Super Admin Sign-Up Requests</p>
                <p className="text-[11px] text-slate-400 mt-1">All Super Admin applications have been processed.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-indigo-50/50 text-indigo-950 font-bold border-b border-indigo-100 uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">Applicant Name</th>
                      <th className="py-3 px-4">Email Address</th>
                      <th className="py-3 px-4">Department / Office</th>
                      <th className="py-3 px-4">Requested Designation</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Super Admin Decision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-indigo-100/60">
                    {pendingSuperAdminRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-indigo-50/20 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse shrink-0" />
                          {req.name}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-700">{req.email}</td>
                        <td className="py-3.5 px-4 text-slate-700 font-medium">{req.department}</td>
                        <td className="py-3.5 px-4 text-indigo-800 font-bold">{req.designation}</td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                            ⏳ Awaiting Decision
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => onApproveTgmUser && onApproveTgmUser(req.email || req.id)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              Approve Super Admin
                            </button>
                            <button
                              type="button"
                              onClick={() => onRejectTgmUser && onRejectTgmUser(req.email || req.id)}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <UserX className="w-3.5 h-3.5" />
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* PENDING TGM SIGNUP REQUESTS (SUPER ADMIN DECISION QUEUE) */}
          <div className="bg-white rounded-2xl border border-amber-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-amber-100 bg-amber-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl border border-amber-200">
                  <ShieldCheck className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    Super Admin TGM Decision Queue
                    <span className="bg-amber-100 text-amber-800 text-xs font-extrabold px-2.5 py-0.5 rounded-full border border-amber-200">
                      {pendingTgmRequests.length} Pending Requests
                    </span>
                  </h3>
                  <p className="text-xs text-slate-600">
                    Faculty members who registered as TGM. Super Admin holds deciding authority to approve or reject requests.
                  </p>
                </div>
              </div>
            </div>

            {pendingTgmRequests.length === 0 ? (
              <div className="p-8 text-center bg-slate-50/30">
                <UserCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">No Pending TGM Sign-Up Requests</p>
                <p className="text-[11px] text-slate-400 mt-1">All Teacher Guardian Mentor requests are reviewed.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-amber-50/40 text-amber-900 font-bold border-b border-amber-100 uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">Faculty Name</th>
                      <th className="py-3 px-4">Email Address</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Designation</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Super Admin Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100/60">
                    {pendingTgmRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-amber-50/20 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
                          {req.name}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-700">{req.email}</td>
                        <td className="py-3.5 px-4 text-slate-700 font-medium">{req.department}</td>
                        <td className="py-3.5 px-4 text-slate-600">{req.designation}</td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                            ⏳ Pending Approval
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => onApproveTgmUser && onApproveTgmUser(req.email || req.id)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              Approve TGM
                            </button>
                            <button
                              type="button"
                              onClick={() => onRejectTgmUser && onRejectTgmUser(req.email || req.id)}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <UserX className="w-3.5 h-3.5" />
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* WHITELISTED ADMINS & APPROVED TGMs TABLE */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Shield className="w-5 h-5 text-indigo-600" />
                  Active Approved TGMs & Whitelisted Admins
                </h3>
                <p className="text-xs text-slate-500">
                  Approved faculty members granted Stage-2 verification & live AICTE points authorization privileges.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddAdminModal(true)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                Directly Whitelist Email
              </button>
            </div>

            {/* Admin Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-400 font-bold border-b border-slate-100 uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Admin / TGM Name</th>
                    <th className="py-3.5 px-4">Email Address</th>
                    <th className="py-3.5 px-4">Designation</th>
                    <th className="py-3.5 px-4">Department</th>
                    <th className="py-3.5 px-4">Added/Approved By</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {admins.map((admin, idx) => (
                    <tr key={`${admin.id}-${idx}`} className="hover:bg-slate-50/60 transition-colors border-b border-slate-50">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{admin.name}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-700">{admin.email}</td>
                      <td className="py-3.5 px-4 text-slate-800">{admin.designation}</td>
                      <td className="py-3.5 px-4 text-slate-600">{admin.department}</td>
                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">{admin.addedBy}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-semibold px-2.5 py-0.5 rounded-full">
                          Approved & Whitelisted ✓
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {admins.length > 1 && (
                          <button
                            type="button"
                            onClick={() => onRemoveAdmin(admin.id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Revoke Whitelist Access"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CLASS PROGRESS MATRIX (ALL STUDENTS) */}
      {activeTab === 'reports' && (() => {
        const seedStudents = SEEDED_PROFILES.filter((p) => p.role === 'student');
        const studentMap = new Map<string, UserProfile>();

        // 1. Add seeded students first
        seedStudents.forEach((st) => studentMap.set(st.id, st));

        // 2. Add all subscribed / registered users (from database / local session)
        if (allUsers && allUsers.length > 0) {
          allUsers.forEach((u) => {
            if (u.role === 'student' || u.role === 'cr') {
              studentMap.set(u.id, u);
            }
          });
        }

        // 3. Always include active logged-in studentProfile if student/CR
        if (studentProfile && (studentProfile.role === 'student' || studentProfile.role === 'cr')) {
          studentMap.set(studentProfile.id, studentProfile);
        }

        // 4. Add any missing students from submissions
        submissions.forEach((sub) => {
          if (!studentMap.has(sub.studentId)) {
            studentMap.set(sub.studentId, {
              id: sub.studentId,
              name: sub.studentName,
              email: `${sub.studentErpNo || 'student'}@tcetmumbai.in`,
              role: 'student',
              rollNo: sub.studentRollNo,
              erpNo: sub.studentErpNo || sub.studentId,
              department: sub.studentDepartment || 'Internet of Things (IoT)',
              division: sub.studentDivision || 'A',
              academicBatch: '2023-2027',
              tgmName: sub.assignedTgmName || 'Prof. S. K. Mehta (TGM)',
              crName: 'Ananya Verma (CR)',
              driveRootFolderId: `drive_folder_${sub.studentId}`,
            });
          }
        });

        const allStudentsList = Array.from(studentMap.values());

        // Extract Filter Dropdown Options
        const availableDepts = Array.from(new Set(allStudentsList.map((st) => st.department).filter(Boolean)));
        const availableDivs = Array.from(new Set(allStudentsList.map((st) => st.division).filter(Boolean))).sort();
        const availableTgmsInMatrix = Array.from(
          new Set(
            allStudentsList
              .map((st) => st.tgmName)
              .filter(Boolean) as string[]
          )
        );

        // Filter Students
        const filteredClassStudents = allStudentsList.filter((st) => {
          const q = matrixSearchQuery.toLowerCase().trim();
          const matchesSearch =
            !q ||
            st.name.toLowerCase().includes(q) ||
            st.rollNo.toLowerCase().includes(q) ||
            st.erpNo.toLowerCase().includes(q) ||
            st.department.toLowerCase().includes(q) ||
            (st.tgmName && st.tgmName.toLowerCase().includes(q));

          const matchesDept = matrixDeptFilter === 'ALL' || st.department === matrixDeptFilter;
          const matchesDiv = matrixDivFilter === 'ALL' || st.division === matrixDivFilter;

          const matchesTgm =
            matrixTgmFilter === 'ALL' ||
            (st.tgmName || '').toLowerCase().includes(matrixTgmFilter.toLowerCase());

          // Standing Calculation
          const studentSubs = submissions.filter((s) => s.studentId === st.id && s.status === 'approved');
          const approvedPts = studentSubs.reduce((a, b) => a + b.calculatedPoints, 0);

          let matchesStanding = true;
          if (matrixStandingFilter === 'HIGH_ACHIEVERS') matchesStanding = approvedPts >= 75;
          else if (matrixStandingFilter === 'ON_TRACK') matchesStanding = approvedPts >= 40 && approvedPts < 75;
          else if (matrixStandingFilter === 'STEADY') matchesStanding = approvedPts >= 20 && approvedPts < 40;
          else if (matrixStandingFilter === 'ACTION_NEEDED') matchesStanding = approvedPts < 20;

          return matchesSearch && matchesDept && matchesDiv && matchesTgm && matchesStanding;
        });

        const isAnyMatrixFilterActive =
          matrixSearchQuery.trim() !== '' ||
          matrixDeptFilter !== 'ALL' ||
          matrixDivFilter !== 'ALL' ||
          matrixStandingFilter !== 'ALL' ||
          matrixTgmFilter !== 'ALL';

        const totalApprovedClassPts = submissions
          .filter((s) => s.status === 'approved')
          .reduce((sum, s) => sum + s.calculatedPoints, 0);

        const avgPtsPerStudent = allStudentsList.length
          ? (totalApprovedClassPts / allStudentsList.length).toFixed(1)
          : '0';

        return (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
            {/* Header Title */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-xs font-semibold px-2.5 py-0.5 rounded-md mb-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
                  Institute & Department Compliance Matrix
                </div>
                <h3 className="font-bold text-slate-900 text-xl tracking-tight">
                  Class Progress Matrix — All Enrolled Students
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time AICTE activity points tracking across all students in your assigned department & division.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="bg-slate-100 text-slate-700 border border-slate-200 text-xs px-3 py-1.5 rounded-xl font-semibold">
                  TGM: Prof. S. K. Mehta
                </span>
                <span className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-xl font-bold shadow-xs">
                  Batch: 2023–2027
                </span>
              </div>
            </div>

            {/* Top Class Metric Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block mb-1">
                  Enrolled Students
                </span>
                <div className="flex items-baseline gap-2">
                  <h4 className="text-2xl font-bold text-slate-900">{allStudentsList.length}</h4>
                  <span className="text-xs text-slate-500 font-medium">Students</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Monitored in Class Matrix</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block mb-1">
                  Class Total Approved Points
                </span>
                <div className="flex items-baseline gap-2">
                  <h4 className="text-2xl font-bold text-emerald-600">{totalApprovedClassPts}</h4>
                  <span className="text-xs text-slate-500 font-medium">Pts Total</span>
                </div>
                <p className="text-[10px] text-emerald-700 font-semibold mt-1">Verified by TGM & CR</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block mb-1">
                  Average Points / Student
                </span>
                <div className="flex items-baseline gap-2">
                  <h4 className="text-2xl font-bold text-indigo-600">{avgPtsPerStudent}</h4>
                  <span className="text-xs text-slate-500 font-medium">/ 100 Pts Target</span>
                </div>
                <p className="text-[10px] text-indigo-600 font-semibold mt-1">Class Benchmark</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block mb-1">
                  Graduation Readiness
                </span>
                <div className="flex items-baseline gap-2">
                  <h4 className="text-2xl font-bold text-purple-600">
                    {allStudentsList.filter((st) => {
                      const pts = submissions
                        .filter((s) => s.studentId === st.id && s.status === 'approved')
                        .reduce((a, b) => a + b.calculatedPoints, 0);
                      return pts >= 25;
                    }).length}
                  </h4>
                  <span className="text-xs text-slate-500 font-medium">/ {allStudentsList.length} On Track</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Meeting AICTE Milestones</p>
              </div>
            </div>

            {/* Matrix Search & Multi-Filter Control Bar */}
            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Search Box */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="Search students by name, roll no, ERP, department, or TGM..."
                    value={matrixSearchQuery}
                    onChange={(e) => setMatrixSearchQuery(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => generateClassProgressExcel(filteredClassStudents, submissions, studentProfile.department || 'Internet of Things (IoT)')}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-emerald-200" />
                    Export Matrix (.xlsx)
                  </button>

                  <div className="text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-xl">
                    Showing <strong className="text-indigo-700">{filteredClassStudents.length}</strong> of{' '}
                    <strong className="text-slate-900">{allStudentsList.length}</strong> Students
                  </div>
                </div>
              </div>

              {/* Interactive Matrix Filter Dropdowns */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/60">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1 mr-1">
                  <Filter className="w-3.5 h-3.5 text-indigo-600" />
                  Filter Matrix:
                </span>

                {/* Department Filter */}
                <select
                  value={matrixDeptFilter}
                  onChange={(e) => setMatrixDeptFilter(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                >
                  <option value="ALL">All Departments ({availableDepts.length})</option>
                  {availableDepts.map((dept) => (
                    <option key={`mdept-${dept}`} value={dept}>
                      Dept: {dept}
                    </option>
                  ))}
                </select>

                {/* Division Filter */}
                <select
                  value={matrixDivFilter}
                  onChange={(e) => setMatrixDivFilter(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                >
                  <option value="ALL">All Divisions</option>
                  {availableDivs.map((div) => (
                    <option key={`mdiv-${div}`} value={div}>
                      Div {div}
                    </option>
                  ))}
                </select>

                {/* Standing Filter */}
                <select
                  value={matrixStandingFilter}
                  onChange={(e) => setMatrixStandingFilter(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                >
                  <option value="ALL">All Standing Levels</option>
                  <option value="HIGH_ACHIEVERS">🌟 High Achievers (75+ Pts)</option>
                  <option value="ON_TRACK">✅ On Track (40–74 Pts)</option>
                  <option value="STEADY">🔷 Steady Progress (20–39 Pts)</option>
                  <option value="ACTION_NEEDED">⚠️ Action Needed (&lt; 20 Pts)</option>
                </select>

                {/* Assigned TGM Filter */}
                <select
                  value={matrixTgmFilter}
                  onChange={(e) => setMatrixTgmFilter(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                >
                  <option value="ALL">All TGMs ({availableTgmsInMatrix.length})</option>
                  {availableTgmsInMatrix.map((tgm) => (
                    <option key={`mtgm-${tgm}`} value={tgm}>
                      TGM: {tgm}
                    </option>
                  ))}
                </select>

                {/* Clear Active Filters */}
                {isAnyMatrixFilterActive && (
                  <button
                    type="button"
                    onClick={() => {
                      setMatrixSearchQuery('');
                      setMatrixDeptFilter('ALL');
                      setMatrixDivFilter('ALL');
                      setMatrixStandingFilter('ALL');
                      setMatrixTgmFilter('ALL');
                    }}
                    className="text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer ml-auto"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>

            {/* Full Class Progress Matrix Table */}
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
                    {filteredClassStudents.map((st, idx) => {
                      const studentSubs = submissions.filter((s) => s.studentId === st.id);
                      const approvedSubs = studentSubs.filter((s) => s.status === 'approved');
                      const approvedPts = approvedSubs.reduce((a, b) => a + b.calculatedPoints, 0);
                      const approvedHrs = approvedSubs.reduce((a, b) => a + b.hoursSpent, 0);

                      const pendingStage2 = studentSubs.filter((s) => s.status === 'pending_admin').length;
                      const pendingStage1 = studentSubs.filter((s) => s.status === 'pending_cr').length;

                      const progressPercent = Math.min(100, Math.round((approvedPts / 100) * 100));

                      // Badge color based on points
                      let standingLabel = 'On Track (Good Standing)';
                      let standingBadgeBg = 'bg-emerald-50 text-emerald-800 border-emerald-200';

                      if (approvedPts >= 75) {
                        standingLabel = 'High Achiever (75+ Pts)';
                        standingBadgeBg = 'bg-purple-50 text-purple-800 border-purple-200';
                      } else if (approvedPts >= 40) {
                        standingLabel = 'On Track (SE Milestone)';
                        standingBadgeBg = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                      } else if (approvedPts >= 20) {
                        standingLabel = 'Steady Progress';
                        standingBadgeBg = 'bg-indigo-50 text-indigo-800 border-indigo-200';
                      } else {
                        standingLabel = 'Beginner / Action Needed';
                        standingBadgeBg = 'bg-amber-50 text-amber-800 border-amber-200';
                      }

                      return (
                        <tr key={`${st.id}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                          {/* Student Info */}
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center justify-center shrink-0 border border-indigo-200">
                                {st.name
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </div>
                              <div>
                                <h4 className="font-bold text-slate-900 text-sm">{st.name}</h4>
                                <p className="text-[11px] text-slate-500 font-mono">
                                  Roll: <strong className="text-slate-700">{st.rollNo}</strong> • ERP:{' '}
                                  <strong className="text-slate-700">{st.erpNo}</strong>
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Department */}
                          <td className="py-4 px-4 text-slate-700">
                            <span className="font-semibold text-slate-800 block text-xs">{st.department}</span>
                            <span className="text-[11px] text-slate-500">
                              Div {st.division} • Batch {st.academicBatch}
                            </span>
                          </td>

                          {/* Approved Points */}
                          <td className="py-4 px-4 min-w-[180px]">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-extrabold text-slate-900">{approvedPts} / 100 Pts</span>
                                <span className="text-[11px] font-semibold text-slate-500">{approvedHrs} / 400 Hrs</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/80">
                                <div
                                  className={`h-2 rounded-full transition-all duration-500 ${
                                    approvedPts >= 75
                                      ? 'bg-purple-600'
                                      : approvedPts >= 40
                                      ? 'bg-emerald-600'
                                      : approvedPts >= 20
                                      ? 'bg-indigo-600'
                                      : 'bg-amber-500'
                                  }`}
                                  style={{ width: `${Math.max(5, progressPercent)}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>

                          {/* Submissions Breakdown */}
                          <td className="py-4 px-4 text-center">
                            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold">
                              <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-bold" title="Approved Entries">
                                ✓ {approvedSubs.length} Approved
                              </span>
                              {pendingStage2 > 0 && (
                                <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-bold" title="Stage-2 TGM Pending">
                                  {pendingStage2} TGM
                                </span>
                              )}
                              {pendingStage1 > 0 && (
                                <span className="bg-sky-100 text-sky-800 px-2 py-0.5 rounded-md font-bold" title="Stage-1 CR Pending">
                                  {pendingStage1} CR
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Standing Badge */}
                          <td className="py-4 px-4 text-center">
                            <span className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full border ${standingBadgeBg}`}>
                              {standingLabel}
                            </span>
                          </td>

                          {/* Action Button */}
                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <a
                                href={getDriveFolderWebUrl(st.driveRootFolderId)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                                title="Open Student's Google Drive Root Folder"
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
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Student Certificate Log Modal */}
            {selectedStudentForModal && (
              <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="font-bold text-slate-900 text-lg">
                        {selectedStudentForModal.name}'s Activity Certificate Submissions
                      </h3>
                      <p className="text-xs text-slate-500 font-mono">
                        Roll No: {selectedStudentForModal.rollNo} • ERP: {selectedStudentForModal.erpNo} • Dept: {selectedStudentForModal.department}
                      </p>
                    </div>

                    <button
                      onClick={() => setSelectedStudentForModal(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Student Google Drive Root Folder Access Banner */}
                  <div className="bg-slate-900 text-slate-100 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
                        <HardDrive className="w-5 h-5 text-emerald-100" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>Student Google Drive Root Folder</span>
                        </p>
                        <p className="text-[11px] text-emerald-300 font-mono truncate max-w-xs sm:max-w-sm">
                          {selectedStudentForModal.driveRootFolderId || `drive_folder_${selectedStudentForModal.erpNo}`}
                        </p>
                      </div>
                    </div>

                    <a
                      href={getDriveFolderWebUrl(selectedStudentForModal.driveRootFolderId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-xs justify-center"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open Drive Folder
                    </a>
                  </div>

                  <div className="space-y-3">
                    {submissions.filter((s) => s.studentId === selectedStudentForModal.id).length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-6 italic">
                        No certificate submissions uploaded yet by this student.
                      </p>
                    ) : (
                      submissions
                        .filter((s) => s.studentId === selectedStudentForModal.id)
                        .map((sub, idx) => (
                          <div
                            key={`${sub.id}-${idx}`}
                            className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900 text-sm">{sub.activityName}</span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  sub.status === 'approved'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : sub.status === 'pending_admin'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-sky-100 text-sky-800'
                                }`}
                              >
                                {sub.status === 'approved'
                                  ? 'Approved (Live Points)'
                                  : sub.status === 'pending_admin'
                                  ? 'Stage-2 Pending (TGM)'
                                  : 'Stage-1 Pending (CR)'}
                              </span>
                            </div>

                            <p className="text-slate-600 text-[11px]">{sub.shortDescription}</p>

                            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/80 font-mono">
                              <span>Semester: <strong className="text-indigo-700">{sub.semester}</strong></span>
                              <span>Hours: <strong className="text-slate-800">{sub.hoursSpent} Hrs</strong></span>
                              <span>Points: <strong className="text-emerald-700">+{sub.calculatedPoints} Pts</strong></span>
                              <button
                                onClick={() => {
                                  setSelectedStudentForModal(null);
                                  onViewDetails(sub);
                                }}
                                className="text-indigo-600 hover:text-indigo-800 font-bold underline flex items-center gap-1"
                              >
                                <Eye className="w-3.5 h-3.5" /> Full Audit
                              </button>
                            </div>
                          </div>
                        ))
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <button
                      onClick={() => generateStudentActivityExcel(
                        selectedStudentForModal,
                        submissions.filter((s) => s.studentId === selectedStudentForModal.id)
                      )}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                    >
                      <BarChart3 className="w-3.5 h-3.5 text-emerald-200" />
                      Download {selectedStudentForModal.name}'s Excel Report (.xlsx)
                    </button>

                    <button
                      onClick={() => setSelectedStudentForModal(null)}
                      className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold"
                    >
                      Close Matrix Log
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* TGM Action Modal */}
      {actionSubModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">
              {actionSubModal.type === 'approve' && 'Approve Entry & Credit Live Points'}
              {actionSubModal.type === 'reject' && 'Reject Certificate Submission'}
              {actionSubModal.type === 'resubmit' && 'Request Corrections / Resubmission'}
            </h3>

            <p className="text-xs text-slate-600">
              Activity: <strong>{actionSubModal.sub.activityName}</strong> ({actionSubModal.sub.calculatedPoints} Points)
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                TGM Mentor Remarks / Approval Note:
              </label>
              <textarea
                rows={3}
                value={tgmRemarksInput}
                onChange={(e) => setTgmRemarksInput(e.target.value)}
                placeholder={
                  actionSubModal.type === 'approve'
                    ? 'Optional: e.g. Verified against official institute records. Excellent work.'
                    : 'Required: Explain why entry is being rejected or corrected.'
                }
                className="w-full border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setActionSubModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-md ${
                  actionSubModal.type === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : actionSubModal.type === 'reject'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                Confirm {actionSubModal.type}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Admin Modal */}
      {showAddAdminModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateAdmin}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-600" />
                Add Whitelisted Admin / TGM Email
              </h3>
              <button
                type="button"
                onClick={() => setShowAddAdminModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. skmehta@tcetmumbai.in"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Prof. S. K. Mehta"
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Designation</label>
                <select
                  value={newAdminDesignation}
                  onChange={(e) => setNewAdminDesignation(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                >
                  <option value="Teacher Guardian Mentor (TGM)">Teacher Guardian Mentor (TGM)</option>
                  <option value="Senior TGM & Assistant Professor">Senior TGM & Assistant Professor</option>
                  <option value="AICTE Activity Coordinator">AICTE Activity Coordinator</option>
                  <option value="Head of Department (HOD)">Head of Department (HOD)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Department (Restricted)</label>
                <input
                  type="text"
                  readOnly
                  value={newAdminDept}
                  className="w-full border border-slate-300 bg-slate-100 text-slate-600 rounded-xl p-2.5 text-xs font-medium cursor-not-allowed"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddAdminModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md"
              >
                Whitelist Email
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
