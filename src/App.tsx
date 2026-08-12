import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  UserRole,
  CertificateSubmission,
  AdminUser,
  Semester,
  UserProfile,
  SubmissionStatus,
} from './types';
import { DEFAULT_STUDENT, AICTE_CATEGORIES } from './constants/aicteData';
import {
  seedInitialDatabase,
  subscribeToSubmissions,
  subscribeToAdmins,
  subscribeToUsers,
  saveSubmissionToDb,
  updateSubmissionInDb,
  addAdminToDb,
  removeAdminFromDb,
  saveUserProfileToDb,
  approveTgmUserInDb,
  rejectTgmUserInDb,
} from './services/dbService';
import { logoutUser } from './services/authService';
import { sendSubmissionStatusNotification } from './services/emailClient';
import { Header } from './components/Header';
import { StudentDashboard } from './components/StudentDashboard';
import { CRReviewPortal } from './components/CRReviewPortal';
import { AdminPortal } from './components/AdminPortal';
import { UploadCertificateModal } from './components/UploadCertificateModal';
import { SubmissionDetailsModal } from './components/SubmissionDetailsModal';
import { AuthModal } from './components/AuthModal';
import { AuthPage } from './components/AuthPage';
import { SuperAdminAuthPage } from './components/SuperAdminAuthPage';
import { RoleSelectionPage } from './components/RoleSelectionPage';
import { StorageExplorerModal } from './components/StorageExplorerModal';

const SESSION_STORAGE_KEY = 'tcet_active_session';

export default function App() {
  const [currentRole, setCurrentRole] = useState<UserRole | 'auth'>('auth');
  const [activeProfile, setActiveProfile] = useState<UserProfile>(DEFAULT_STUDENT);
  // Which role the user picked on the landing screen (null = show landing)
  const [selectedEntryRole, setSelectedEntryRole] = useState<'student' | 'cr' | 'admin' | null>(null);
  const [isSuperAdminRoute, setIsSuperAdminRoute] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return (
        window.location.pathname.toLowerCase().includes('superadmin') ||
        window.location.hash.toLowerCase().includes('superadmin')
      );
    }
    return false;
  });

  // Handle URL change for /superadmin route
  useEffect(() => {
    const handleLocationChange = () => {
      const isSuper =
        window.location.pathname.toLowerCase().includes('superadmin') ||
        window.location.hash.toLowerCase().includes('superadmin');
      setIsSuperAdminRoute(isSuper);
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  // Load persisted session on initial mount
  useEffect(() => {
    try {
      const savedSession = localStorage.getItem(SESSION_STORAGE_KEY);
      if (savedSession) {
        const parsed: UserProfile = JSON.parse(savedSession);
        if (parsed && parsed.id && parsed.name && parsed.role) {
          setActiveProfile(parsed);
          setCurrentRole(parsed.role);
        } else {
          setCurrentRole('auth');
        }
      } else {
        setCurrentRole('auth');
      }
    } catch (err) {
      console.error('Failed to restore user session:', err);
      setCurrentRole('auth');
    }
  }, []);

  // Real-time Firestore Submissions, Admins, and Users State
  const [submissions, setSubmissions] = useState<CertificateSubmission[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [dbLoading, setDbLoading] = useState(true);

  // Modal States
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isStorageExplorerOpen, setIsStorageExplorerOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedUploadSemester, setSelectedUploadSemester] = useState<Semester>('SEM_1');
  const [editingSubmission, setEditingSubmission] = useState<CertificateSubmission | null>(null);
  const [selectedDetailsSubmission, setSelectedDetailsSubmission] = useState<CertificateSubmission | null>(null);

  // Initialize Supabase Database & Seed initial student/teacher data
  useEffect(() => {
    async function initDb() {
      setDbLoading(true);
      await seedInitialDatabase(true);
      setDbLoading(false);
    }
    initDb();
  }, []);

  // Real-time Supabase Subscribers
  useEffect(() => {
    const unsubscribeSubmissions = subscribeToSubmissions((data) => {
      setSubmissions(data);
    });

    const unsubscribeAdmins = subscribeToAdmins((data) => {
      setAdmins(data);
    });

    const unsubscribeUsers = subscribeToUsers((data) => {
      setAllUsers(data);
    });

    return () => {
      unsubscribeSubmissions();
      unsubscribeAdmins();
      unsubscribeUsers();
    };
  }, []);

  // Sync role view & sessionize whenever activeProfile changes
  const handleSelectProfile = (profile: UserProfile) => {
    setActiveProfile(profile);
    setCurrentRole(profile.role);
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(profile));
    } catch (e) {
      console.error('Failed to save session:', e);
    }
    saveUserProfileToDb(profile);
  };

  const handleLogout = async () => {
    await logoutUser();
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear session:', e);
    }
    setActiveProfile(DEFAULT_STUDENT);
    setCurrentRole('auth');
    setSelectedEntryRole(null); // Return to role selection screen
  };

  // Re-seed Database explicit handler
  const handleReseedDb = async () => {
    setDbLoading(true);
    await seedInitialDatabase(true);
    setDbLoading(false);
  };

  // Counts for Badges
  const pendingCrCount = submissions.filter((s) => s.status === 'pending_cr').length;
  const pendingAdminCount = submissions.filter((s) => s.status === 'pending_admin').length;
  const totalApprovedPoints = submissions
    .filter((s) => s.status === 'approved')
    .reduce((acc, s) => acc + s.calculatedPoints, 0);

  // Check 100 Points Celebration
  useEffect(() => {
    if (totalApprovedPoints >= 100) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [totalApprovedPoints]);

  // Handlers for Submissions
  const handleOpenUploadModal = (sem?: Semester) => {
    if (sem) setSelectedUploadSemester(sem);
    setEditingSubmission(null);
    setIsUploadModalOpen(true);
  };

  const handleResubmitRequested = (sub: CertificateSubmission) => {
    setEditingSubmission(sub);
    setSelectedUploadSemester(sub.semester);
    setIsUploadModalOpen(true);
  };

  const handleSaveSubmission = async (
    data: Omit<
      CertificateSubmission,
      'id' | 'createdAt' | 'updatedAt' | 'isCheckedByCR' | 'isVerifiedByTGM' | 'status'
    >
  ) => {
    if (editingSubmission) {
      // Re-submission / Revision in Firestore
      const updatedSub: CertificateSubmission = {
        ...editingSubmission,
        ...data,
        isCheckedByCR: false,
        isVerifiedByTGM: false,
        status: 'pending_cr',
        updatedAt: new Date().toISOString(),
      };
      await saveSubmissionToDb(updatedSub);
    } else {
      // New Submission in Firestore
      const newSub: CertificateSubmission = {
        ...data,
        id: `SUB-${Date.now().toString().slice(-6)}`,
        studentId: activeProfile.id,
        studentName: activeProfile.name,
        studentRollNo: activeProfile.rollNo,
        studentErpNo: activeProfile.erpNo,
        studentDepartment: activeProfile.department,
        studentDivision: activeProfile.division,
        isCheckedByCR: false,
        isVerifiedByTGM: false,
        status: 'pending_cr',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveSubmissionToDb(newSub);
    }
    setIsUploadModalOpen(false);
    setEditingSubmission(null);
  };

  const handleBulkSyncSubmissions = async (newSubs: CertificateSubmission[]) => {
    for (const sub of newSubs) {
      // Deduplication by (studentId, currentFileDriveId)
      const existing = submissions.find(
        (s) =>
          s.studentId === sub.studentId &&
          s.currentFileDriveId &&
          sub.currentFileDriveId &&
          s.currentFileDriveId === sub.currentFileDriveId
      );

      if (existing) {
        // Do not revert status if already submitted/approved/rejected
        const activeStatuses = ['pending_cr', 'pending_admin', 'approved', 'rejected', 'resubmission_requested'];
        const keepStatus = activeStatuses.includes(existing.status) ? existing.status : sub.status;

        await updateSubmissionInDb(existing.id, {
          ...sub,
          id: existing.id,
          status: keepStatus,
          createdAt: existing.createdAt,
          updatedAt: new Date().toISOString(),
        });
      } else {
        await saveSubmissionToDb(sub);
      }
    }
  };

  const handleBatchUpdateSubmissionStatus = async (ids: string[], newStatus: SubmissionStatus) => {
    for (const id of ids) {
      await updateSubmissionInDb(id, {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  const handleRunAiOnNamingError = async (submissionId: string) => {
    const sub = submissions.find((s) => s.id === submissionId);
    if (!sub) return;

    try {
      const res = await fetch('/api/gemini/classify-certificate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: sub.fileName || sub.activityName,
          fileText: `Certificate document name: ${sub.fileName || sub.activityName}`,
        }),
      });
      const json = await res.json();
      if (json.success && json.data && json.data.category !== 'unrecognized') {
        const catCode = json.data.category; // e.g. CAT-06
        let catNum = parseInt(catCode.replace('CAT-', ''), 10);
        if (isNaN(catNum) || catNum < 1 || catNum > 15) catNum = 6;
        const catObj = AICTE_CATEGORIES.find((c) => c.id === catNum) || AICTE_CATEGORIES[0];
        const hours = 24;
        const points = Math.max(1, Math.round(hours / catObj.minHoursPerPoint));

        await updateSubmissionInDb(submissionId, {
          activityCategoryNo: catNum,
          activityName: json.data.title || sub.activityName,
          hoursSpent: hours,
          calculatedPoints: points,
          status: 'imported', // Transferred from naming_error to imported!
          shortDescription: `Auto-categorized by Gemini AI as ${catCode} (${catObj.title})`,
        });
      }
    } catch (err) {
      console.warn('AI classification notice:', err);
    }
  };

  const handleUpdateSubmissionHours = async (id: string, hours: number, points: number) => {
    await updateSubmissionInDb(id, {
      hoursSpent: hours,
      calculatedPoints: points,
    });
  };

  // CR Stage-1 Verification Action
  const handleValidateByCR = async (id: string) => {
    await updateSubmissionInDb(id, {
      isCheckedByCR: true,
      crCheckedAt: new Date().toISOString(),
      crCheckedBy: `${activeProfile.name} (CR)`,
      status: 'pending_admin',
    });

    const sub = submissions.find((s) => s.id === id);
    if (sub) {
      const studentUser = allUsers.find((u) => u.id === sub.studentId || u.erpNo === sub.studentErpNo);
      const studentEmail = studentUser?.email || `${sub.studentErpNo || 'student'}@tcetmumbai.in`;
      sendSubmissionStatusNotification({
        studentEmail,
        studentName: sub.studentName,
        activityName: sub.activityName,
        points: sub.calculatedPoints,
        status: 'pending_admin',
        updatedBy: `${activeProfile.name} (Class Representative)`,
        submissionId: sub.id,
      }).catch((e) => console.warn('Notification send notice:', e));
    }
  };

  const handleRequestResubmissionByCR = async (id: string, remarks: string) => {
    await updateSubmissionInDb(id, {
      crRemarks: remarks,
      status: 'resubmission_requested',
    });

    const sub = submissions.find((s) => s.id === id);
    if (sub) {
      const studentUser = allUsers.find((u) => u.id === sub.studentId || u.erpNo === sub.studentErpNo);
      const studentEmail = studentUser?.email || `${sub.studentErpNo || 'student'}@tcetmumbai.in`;
      sendSubmissionStatusNotification({
        studentEmail,
        studentName: sub.studentName,
        activityName: sub.activityName,
        points: sub.calculatedPoints,
        status: 'resubmission_requested',
        remarks,
        updatedBy: `${activeProfile.name} (Class Representative)`,
        submissionId: sub.id,
      }).catch((e) => console.warn('Notification send notice:', e));
    }
  };

  // TGM Stage-2 Approval Action
  const handleApproveByTGM = async (id: string, remarks?: string) => {
    const finalRemarks = remarks || 'Duly approved after Stage-2 verification.';
    await updateSubmissionInDb(id, {
      isVerifiedByTGM: true,
      tgmVerifiedAt: new Date().toISOString(),
      tgmVerifiedBy: `${activeProfile.name} (TGM)`,
      tgmRemarks: finalRemarks,
      status: 'approved',
    });

    const sub = submissions.find((s) => s.id === id);
    if (sub) {
      const studentUser = allUsers.find((u) => u.id === sub.studentId || u.erpNo === sub.studentErpNo);
      const studentEmail = studentUser?.email || `${sub.studentErpNo || 'student'}@tcetmumbai.in`;
      sendSubmissionStatusNotification({
        studentEmail,
        studentName: sub.studentName,
        activityName: sub.activityName,
        points: sub.calculatedPoints,
        status: 'approved',
        remarks: finalRemarks,
        updatedBy: `${activeProfile.name} (TGM)`,
        submissionId: sub.id,
      }).catch((e) => console.warn('Notification send notice:', e));
    }

    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 },
    });
  };

  const handleRejectByTGM = async (id: string, remarks: string) => {
    await updateSubmissionInDb(id, {
      isVerifiedByTGM: false,
      tgmRemarks: remarks,
      status: 'rejected',
    });

    const sub = submissions.find((s) => s.id === id);
    if (sub) {
      const studentUser = allUsers.find((u) => u.id === sub.studentId || u.erpNo === sub.studentErpNo);
      const studentEmail = studentUser?.email || `${sub.studentErpNo || 'student'}@tcetmumbai.in`;
      sendSubmissionStatusNotification({
        studentEmail,
        studentName: sub.studentName,
        activityName: sub.activityName,
        points: sub.calculatedPoints,
        status: 'rejected',
        remarks,
        updatedBy: `${activeProfile.name} (TGM)`,
        submissionId: sub.id,
      }).catch((e) => console.warn('Notification send notice:', e));
    }
  };

  const handleRequestResubmissionByTGM = async (id: string, remarks: string) => {
    await updateSubmissionInDb(id, {
      tgmRemarks: remarks,
      status: 'resubmission_requested',
    });

    const sub = submissions.find((s) => s.id === id);
    if (sub) {
      const studentUser = allUsers.find((u) => u.id === sub.studentId || u.erpNo === sub.studentErpNo);
      const studentEmail = studentUser?.email || `${sub.studentErpNo || 'student'}@tcetmumbai.in`;
      sendSubmissionStatusNotification({
        studentEmail,
        studentName: sub.studentName,
        activityName: sub.activityName,
        points: sub.calculatedPoints,
        status: 'resubmission_requested',
        remarks,
        updatedBy: `${activeProfile.name} (TGM)`,
        submissionId: sub.id,
      }).catch((e) => console.warn('Notification send notice:', e));
    }
  };

  // Admin Whitelist Handlers in Firestore
  const handleAddAdmin = async (newAdmin: Omit<AdminUser, 'id' | 'addedAt'>) => {
    const adminObj: AdminUser = {
      ...newAdmin,
      id: `ADM-${Date.now().toString().slice(-4)}`,
      addedAt: new Date().toISOString().split('T')[0],
    };
    await addAdminToDb(adminObj);
  };

  const handleRemoveAdmin = async (id: string) => {
    await removeAdminFromDb(id);
  };

  const handleApproveTgmUser = async (userIdOrEmail: string) => {
    await approveTgmUserInDb(userIdOrEmail, activeProfile.name || 'Super Admin');
  };

  const handleRejectTgmUser = async (userIdOrEmail: string) => {
    await rejectTgmUserInDb(userIdOrEmail);
  };

  const handleUpdateProfile = async (updatedProfile: UserProfile) => {
    setActiveProfile(updatedProfile);
    await saveUserProfileToDb(updatedProfile);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans antialiased selection:bg-indigo-500 selection:text-white flex flex-col">
      {/* Global Navigation Header - Only rendered when user is logged in */}
      {currentRole !== 'auth' && (
        <Header
          currentRole={currentRole}
          onRoleChange={setCurrentRole}
          activeProfile={activeProfile}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          onLogout={handleLogout}
          pendingCrCount={pendingCrCount}
          pendingAdminCount={pendingAdminCount}
          totalApprovedPoints={totalApprovedPoints}
          onOpenWhitelist={() => setCurrentRole('admin')}
          onReseedDb={handleReseedDb}
          onOpenStorageExplorer={() => setIsStorageExplorerOpen(true)}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {currentRole === 'student' && (
          <StudentDashboard
            student={activeProfile}
            submissions={submissions.filter(
              (s) => s.studentId === activeProfile.id || s.studentErpNo === activeProfile.erpNo
            )}
            onOpenUploadModal={handleOpenUploadModal}
            onViewSubmissionDetails={setSelectedDetailsSubmission}
            onResubmitRequested={handleResubmitRequested}
            onSelectProfile={setActiveProfile}
            onUpdateProfile={handleUpdateProfile}
            onImportSubmissions={handleBulkSyncSubmissions}
            onBatchUpdateStatus={handleBatchUpdateSubmissionStatus}
            onRunAiOnNamingError={handleRunAiOnNamingError}
            onUpdateSubmissionHours={handleUpdateSubmissionHours}
            admins={admins}
            allUsers={allUsers}
          />
        )}

        {currentRole === 'cr' && (
          <CRReviewPortal
            submissions={submissions}
            activeProfile={activeProfile}
            onValidateByCR={handleValidateByCR}
            onRequestResubmission={handleRequestResubmissionByCR}
            onViewDetails={setSelectedDetailsSubmission}
          />
        )}

        {(currentRole === 'admin' || currentRole === 'superadmin') && (
          <AdminPortal
            submissions={submissions}
            admins={admins}
            allUsers={allUsers}
            onApproveByTGM={handleApproveByTGM}
            onRejectByTGM={handleRejectByTGM}
            onRequestResubmissionByTGM={handleRequestResubmissionByTGM}
            onAddAdmin={handleAddAdmin}
            onRemoveAdmin={handleRemoveAdmin}
            onApproveTgmUser={handleApproveTgmUser}
            onRejectTgmUser={handleRejectTgmUser}
            onViewDetails={setSelectedDetailsSubmission}
            studentProfile={activeProfile}
          />
        )}

        {currentRole === 'auth' && (
          isSuperAdminRoute ? (
            // Super Admin: fixed credentials, no Google OAuth
            <SuperAdminAuthPage
              onSelectProfile={(profile) => {
                handleSelectProfile(profile);
              }}
              onReturnToStandardAuth={() => {
                setIsSuperAdminRoute(false);
                setSelectedEntryRole(null);
                if (window.location.pathname.includes('superadmin')) {
                  window.history.pushState({}, '', '/');
                }
                window.location.hash = '';
              }}
            />
          ) : selectedEntryRole === null ? (
            // Stage 0: Role Selection Landing
            <RoleSelectionPage
              onSelectRole={(role) => setSelectedEntryRole(role)}
              onGoToSuperAdmin={() => {
                window.location.hash = '#superadmin';
                setIsSuperAdminRoute(true);
              }}
            />
          ) : (
            // Stage 1: Auth (Google for Students/TGMs, Manual for CR/Club Head)
            <AuthPage
              activeProfile={activeProfile}
              allUsers={allUsers}
              onSelectProfile={(profile) => {
                handleSelectProfile(profile);
              }}
              onReseedDatabase={handleReseedDb}
              preselectedRole={selectedEntryRole}
              onBackToRoleSelection={() => setSelectedEntryRole(null)}
            />
          )
        )}
      </main>

      {/* Modals */}
      {isAuthModalOpen && (
        <AuthModal
          activeProfile={activeProfile}
          onSelectProfile={handleSelectProfile}
          onClose={() => setIsAuthModalOpen(false)}
          onReseedDatabase={handleReseedDb}
        />
      )}

      {isUploadModalOpen && (
        <UploadCertificateModal
          defaultSemester={selectedUploadSemester}
          existingSubmission={editingSubmission}
          onClose={() => {
            setIsUploadModalOpen(false);
            setEditingSubmission(null);
          }}
          onSubmit={handleSaveSubmission}
          studentErpNo={activeProfile.erpNo}
          studentName={activeProfile.name}
          studentRollNo={activeProfile.rollNo}
          studentDepartment={activeProfile.department}
          studentDivision={activeProfile.division}
          assignedTgmName={activeProfile.tgmName}
          assignedCrName={activeProfile.crName}
        />
      )}

      {selectedDetailsSubmission && (
        <SubmissionDetailsModal
          submission={selectedDetailsSubmission}
          onClose={() => setSelectedDetailsSubmission(null)}
        />
      )}

      {isStorageExplorerOpen && (
        <StorageExplorerModal
          submissions={submissions}
          admins={admins}
          activeProfile={activeProfile}
          onClose={() => setIsStorageExplorerOpen(false)}
        />
      )}

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-6 border-t border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 Thakur College of Engineering & Technology (Autonomous). All Rights Reserved.</p>
        </div>
      </footer>
    </div>
  );
}
