import React, { useState, useEffect } from "react";
import confetti from "canvas-confetti";

import {
  UserRole,
  CertificateSubmission,
  AdminUser,
  Semester,
  UserProfile,
  SubmissionStatus,
} from "./types";

import {
  DEFAULT_STUDENT,
  AICTE_CATEGORIES,
} from "./constants/aicteData";

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
  getUserProfileByEmail,
} from "./services/dbService";

import { logoutUser } from "./services/authService";
import { sendSubmissionStatusNotification } from "./services/emailClient";
import { isStudentProfileComplete } from "./utils/studentProfile";

import { Header } from "./components/Header";
import { StudentDashboard } from "./components/StudentDashboard";
import { StudentProfileSetup } from "./components/StudentProfileSetup";
import { CRReviewPortal } from "./components/CRReviewPortal";
import { AdminPortal } from "./components/AdminPortal";
import { TGMDashboard } from "./components/TGMDashboard";
import { SuperAdminDashboard } from "./components/SuperAdminDashboard";
import { UploadCertificateModal } from "./components/UploadCertificateModal";
import { SubmissionDetailsModal } from "./components/SubmissionDetailsModal";
import { AuthModal } from "./components/AuthModal";
import { AuthPage } from "./components/AuthPage";
import { SuperAdminAuthPage } from "./components/SuperAdminAuthPage";
import { RoleSelectionPage } from "./components/RoleSelectionPage";
import { StorageExplorerModal } from "./components/StorageExplorerModal";

const SESSION_STORAGE_KEY = "tcet_active_session";

export default function App() {
  const [currentRole, setCurrentRole] =
    useState<UserRole | "auth">("auth");

  const [activeProfile, setActiveProfile] =
    useState<UserProfile>(DEFAULT_STUDENT);

  const [selectedEntryRole, setSelectedEntryRole] = useState<
    "student" | "cr" | "admin" | null
  >(null);

  const [studentOnboarding, setStudentOnboarding] = useState<{
    email: string;
    name: string;
    existingProfile?: UserProfile;
  } | null>(null);

  const [sessionRestoring, setSessionRestoring] = useState(true);

  const [isSuperAdminRoute, setIsSuperAdminRoute] =
    useState<boolean>(() => {
      if (typeof window !== "undefined") {
        return (
          window.location.pathname
            .toLowerCase()
            .includes("superadmin") ||
          window.location.hash
            .toLowerCase()
            .includes("superadmin")
        );
      }

      return false;
    });

  /* -------------------------------------------------------
     SUPER ADMIN ROUTE
  ------------------------------------------------------- */

  useEffect(() => {
    const handleLocationChange = () => {
      const isSuper =
        window.location.pathname
          .toLowerCase()
          .includes("superadmin") ||
        window.location.hash
          .toLowerCase()
          .includes("superadmin");

      setIsSuperAdminRoute(isSuper);
    };

    window.addEventListener(
      "popstate",
      handleLocationChange
    );

    window.addEventListener(
      "hashchange",
      handleLocationChange
    );

    return () => {
      window.removeEventListener(
        "popstate",
        handleLocationChange
      );

      window.removeEventListener(
        "hashchange",
        handleLocationChange
      );
    };
  }, []);

  /* -------------------------------------------------------
     RESTORE SESSION
  ------------------------------------------------------- */

  useEffect(() => {
    async function restoreSession() {
      try {
        const savedSession =
          localStorage.getItem(SESSION_STORAGE_KEY);

        if (!savedSession) {
          setCurrentRole("auth");
          return;
        }

        const parsed: UserProfile = JSON.parse(savedSession);

        if (!parsed?.id || !parsed?.name || !parsed?.role) {
          setCurrentRole("auth");
          return;
        }

        if (parsed.role === "student") {
          const fresh = await getUserProfileByEmail(parsed.email);
          const profile = fresh || parsed;

          if (!isStudentProfileComplete(profile)) {
            setStudentOnboarding({
              email: profile.email,
              name: profile.name,
              existingProfile: profile,
            });
            setActiveProfile(profile);
            setCurrentRole("auth");
            setSelectedEntryRole("student");
            return;
          }

          setActiveProfile(profile);
          setCurrentRole("student");
          return;
        }

        setActiveProfile(parsed);
        setCurrentRole(parsed.role);
      } catch (err) {
        console.error("Failed to restore user session:", err);
        setCurrentRole("auth");
      } finally {
        setSessionRestoring(false);
      }
    }

    restoreSession();
  }, []);

  /* -------------------------------------------------------
     DATABASE STATE
  ------------------------------------------------------- */

  const [submissions, setSubmissions] =
    useState<CertificateSubmission[]>([]);

  const [admins, setAdmins] =
    useState<AdminUser[]>([]);

  const [allUsers, setAllUsers] =
    useState<UserProfile[]>([]);

  const [dbLoading, setDbLoading] =
    useState(true);

  /* -------------------------------------------------------
     MODALS
  ------------------------------------------------------- */

  const [isAuthModalOpen, setIsAuthModalOpen] =
    useState(false);

  const [isStorageExplorerOpen, setIsStorageExplorerOpen] =
    useState(false);

  const [isUploadModalOpen, setIsUploadModalOpen] =
    useState(false);

  const [selectedUploadSemester, setSelectedUploadSemester] =
    useState<Semester>("SEM_1");

  const [editingSubmission, setEditingSubmission] =
    useState<CertificateSubmission | null>(null);

  const [selectedDetailsSubmission, setSelectedDetailsSubmission] =
    useState<CertificateSubmission | null>(null);

  /* -------------------------------------------------------
     DATABASE INITIALIZATION
  ------------------------------------------------------- */

  useEffect(() => {
    async function initDb() {
      setDbLoading(true);

      await seedInitialDatabase(true);

      setDbLoading(false);
    }

    initDb();
  }, []);

  /* -------------------------------------------------------
     REAL-TIME DATABASE SUBSCRIPTIONS
  ------------------------------------------------------- */

  useEffect(() => {
    const unsubscribeSubmissions =
      subscribeToSubmissions(currentRole, activeProfile.id, (data) => {
        setSubmissions(data);
      });

    const unsubscribeAdmins =
      subscribeToAdmins((data) => {
        setAdmins(data);
      });

    const unsubscribeUsers =
      subscribeToUsers(currentRole, activeProfile.id, (data) => {
        setAllUsers(data);
      });

    return () => {
      unsubscribeSubmissions();
      unsubscribeAdmins();
      unsubscribeUsers();
    };
  }, [currentRole, activeProfile?.id]);

  /* -------------------------------------------------------
     PROFILE / SESSION
  ------------------------------------------------------- */

  const handleSelectProfile = (
    profile: UserProfile
  ) => {
    if (
      profile.role === "student" &&
      !isStudentProfileComplete(profile)
    ) {
      setStudentOnboarding({
        email: profile.email,
        name: profile.name,
        existingProfile: profile,
      });
      setActiveProfile(profile);
      setCurrentRole("auth");
      setSelectedEntryRole("student");
      return;
    }

    setActiveProfile(profile);
    setCurrentRole(profile.role);
    setStudentOnboarding(null);

    try {
      localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify(profile)
      );
    } catch (e) {
      console.error(
        "Failed to save session:",
        e
      );
    }

    saveUserProfileToDb(profile);
  };

  const handleStudentOnboardingComplete = (
    profile: UserProfile
  ) => {
    setStudentOnboarding(null);
    setActiveProfile(profile);
    setCurrentRole("student");

    try {
      localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify(profile)
      );
    } catch (e) {
      console.error("Failed to save session:", e);
    }
  };

  const handleLogout = async () => {
    await logoutUser();

    try {
      localStorage.removeItem(
        SESSION_STORAGE_KEY
      );
    } catch (e) {
      console.error(
        "Failed to clear session:",
        e
      );
    }

    setActiveProfile(DEFAULT_STUDENT);
    setCurrentRole("auth");
    setSelectedEntryRole(null);
    setStudentOnboarding(null);
  };

  /* -------------------------------------------------------
     RESEED DATABASE
  ------------------------------------------------------- */

  const handleReseedDb = async () => {
    setDbLoading(true);

    await seedInitialDatabase(true);

    setDbLoading(false);
  };

  /* -------------------------------------------------------
     COUNTS
  ------------------------------------------------------- */

  const pendingCrCount =
    submissions.filter(
      (s) => s.status === "pending_cr"
    ).length;

  const pendingAdminCount =
    submissions.filter(
      (s) => s.status === "pending_admin"
    ).length;

  const totalApprovedPoints =
    submissions
      .filter(
        (s) => s.status === "approved"
      )
      .reduce(
        (acc, s) =>
          acc + s.calculatedPoints,
        0
      );

  /* -------------------------------------------------------
     100 POINT CELEBRATION
  ------------------------------------------------------- */

  useEffect(() => {
    if (totalApprovedPoints >= 100) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: {
          y: 0.6,
        },
      });
    }
  }, [totalApprovedPoints]);

  /* -------------------------------------------------------
     UPLOAD HANDLERS
  ------------------------------------------------------- */

  const handleOpenUploadModal = (
    sem?: Semester
  ) => {
    if (sem) {
      setSelectedUploadSemester(sem);
    }

    setEditingSubmission(null);
    setIsUploadModalOpen(true);
  };

  const handleResubmitRequested = (
    sub: CertificateSubmission
  ) => {
    setEditingSubmission(sub);
    setSelectedUploadSemester(
      sub.semester
    );
    setIsUploadModalOpen(true);
  };

  const handleSaveSubmission = async (
    data: Omit<
      CertificateSubmission,
      | "id"
      | "createdAt"
      | "updatedAt"
      | "isCheckedByCR"
      | "isVerifiedByTGM"
      | "status"
    >
  ) => {
    if (editingSubmission) {
      const updatedSub: CertificateSubmission = {
        ...editingSubmission,
        ...data,
        isCheckedByCR: false,
        isVerifiedByTGM: false,
        status: "pending_cr",
        updatedAt:
          new Date().toISOString(),
      };

      await saveSubmissionToDb(
        updatedSub
      );
    } else {
      const newSub: CertificateSubmission = {
        ...data,
        id: `SUB-${Date.now()
          .toString()
          .slice(-6)}`,
        studentId: activeProfile.id,
        studentName: activeProfile.name,
        studentRollNo: activeProfile.rollNo,
        studentErpNo: activeProfile.erpNo,
        studentDepartment:
          activeProfile.department,
        studentDivision:
          activeProfile.division,
        isCheckedByCR: false,
        isVerifiedByTGM: false,
        status: "pending_cr",
        createdAt:
          new Date().toISOString(),
        updatedAt:
          new Date().toISOString(),
      };

      await saveSubmissionToDb(
        newSub
      );
    }

    setIsUploadModalOpen(false);
    setEditingSubmission(null);
  };

  /* -------------------------------------------------------
     BULK SYNC
  ------------------------------------------------------- */

  const handleBulkSyncSubmissions = async (
    newSubs: CertificateSubmission[]
  ) => {
    for (const sub of newSubs) {
      const existing =
        submissions.find(
          (s) =>
            s.studentId ===
              sub.studentId &&
            s.currentFileDriveId &&
            sub.currentFileDriveId &&
            s.currentFileDriveId ===
              sub.currentFileDriveId
        );

      if (existing) {
        const activeStatuses = [
          "pending_cr",
          "pending_admin",
          "approved",
          "rejected",
          "resubmission_requested",
        ];

        const keepStatus =
          activeStatuses.includes(
            existing.status
          )
            ? existing.status
            : sub.status;

        await updateSubmissionInDb(
          existing.id,
          {
            ...sub,
            id: existing.id,
            status: keepStatus,
            createdAt:
              existing.createdAt,
            updatedAt:
              new Date().toISOString(),
          }
        );
      } else {
        await saveSubmissionToDb(sub);
      }
    }
  };

  /* -------------------------------------------------------
     BATCH STATUS
  ------------------------------------------------------- */

  const handleBatchUpdateSubmissionStatus =
    async (
      ids: string[],
      newStatus: SubmissionStatus
    ) => {
      for (const id of ids) {
        await updateSubmissionInDb(
          id,
          {
            status: newStatus,
            updatedAt:
              new Date().toISOString(),
          }
        );
      }
    };

  /* -------------------------------------------------------
     AI CLASSIFICATION
  ------------------------------------------------------- */

  const handleRunAiOnNamingError =
    async (
      submissionId: string
    ) => {
      const sub =
        submissions.find(
          (s) =>
            s.id === submissionId
        );

      if (!sub) return;

      try {
        const res = await fetch(
          "/api/gemini/classify-certificate",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              fileName:
                sub.fileName ||
                sub.activityName,
              fileText: `Certificate document name: ${
                sub.fileName ||
                sub.activityName
              }`,
            }),
          }
        );

        const json =
          await res.json();

        if (
          json.success &&
          json.data &&
          json.data.category !==
            "unrecognized"
        ) {
          const catCode =
            json.data.category;

          let catNum = parseInt(
            catCode.replace(
              "CAT-",
              ""
            ),
            10
          );

          if (
            isNaN(catNum) ||
            catNum < 1 ||
            catNum > 15
          ) {
            catNum = 6;
          }

          const catObj =
            AICTE_CATEGORIES.find(
              (c) =>
                c.id === catNum
            ) ||
            AICTE_CATEGORIES[0];

          const hours = 24;

          const points =
            Math.max(
              1,
              Math.round(
                hours /
                  catObj.minHoursPerPoint
              )
            );

          await updateSubmissionInDb(
            submissionId,
            {
              activityCategoryNo:
                catNum,
              activityName:
                json.data.title ||
                sub.activityName,
              hoursSpent: hours,
              calculatedPoints: points,
              status: "imported",
              shortDescription: `Auto-categorized by Gemini AI as ${catCode} (${catObj.title})`,
            }
          );
        }
      } catch (err) {
        console.warn(
          "AI classification notice:",
          err
        );
      }
    };

  /* -------------------------------------------------------
     UPDATE HOURS
  ------------------------------------------------------- */

  const handleUpdateSubmissionHours =
    async (
      id: string,
      hours: number,
      points: number
    ) => {
      await updateSubmissionInDb(
        id,
        {
          hoursSpent: hours,
          calculatedPoints: points,
        }
      );
    };

  /* -------------------------------------------------------
     CR APPROVAL
  ------------------------------------------------------- */

  const handleValidateByCR =
    async (id: string) => {
      await updateSubmissionInDb(
        id,
        {
          isCheckedByCR: true,
          crCheckedAt:
            new Date().toISOString(),
          crCheckedBy: `${activeProfile.name} (CR)`,
          status: "pending_admin",
        }
      );

      const sub =
        submissions.find(
          (s) => s.id === id
        );

      if (sub) {
        const studentUser =
          allUsers.find(
            (u) =>
              u.id ===
                sub.studentId ||
              u.erpNo ===
                sub.studentErpNo
          );

        const studentEmail =
          studentUser?.email ||
          `${
            sub.studentErpNo ||
            "student"
          }@tcetmumbai.in`;

        sendSubmissionStatusNotification({
          studentEmail,
          studentName:
            sub.studentName,
          activityName:
            sub.activityName,
          points:
            sub.calculatedPoints,
          status: "pending_admin",
          updatedBy: `${activeProfile.name} (Class Representative)`,
          submissionId: sub.id,
        }).catch((e) =>
          console.warn(
            "Notification send notice:",
            e
          )
        );
      }
    };

  /* -------------------------------------------------------
     CR RESUBMISSION
  ------------------------------------------------------- */

  const handleRequestResubmissionByCR =
    async (
      id: string,
      remarks: string
    ) => {
      await updateSubmissionInDb(
        id,
        {
          crRemarks: remarks,
          status:
            "resubmission_requested",
        }
      );

      const sub =
        submissions.find(
          (s) => s.id === id
        );

      if (sub) {
        const studentUser =
          allUsers.find(
            (u) =>
              u.id ===
                sub.studentId ||
              u.erpNo ===
                sub.studentErpNo
          );

        const studentEmail =
          studentUser?.email ||
          `${
            sub.studentErpNo ||
            "student"
          }@tcetmumbai.in`;

        sendSubmissionStatusNotification({
          studentEmail,
          studentName:
            sub.studentName,
          activityName:
            sub.activityName,
          points:
            sub.calculatedPoints,
          status:
            "resubmission_requested",
          remarks,
          updatedBy: `${activeProfile.name} (Class Representative)`,
          submissionId: sub.id,
        }).catch((e) =>
          console.warn(
            "Notification send notice:",
            e
          )
        );
      }
    };

  /* -------------------------------------------------------
     TGM APPROVAL
  ------------------------------------------------------- */

  const handleApproveByTGM =
    async (
      id: string,
      remarks?: string
    ) => {
      const finalRemarks =
        remarks ||
        "Duly approved after Stage-2 verification.";

      await updateSubmissionInDb(
        id,
        {
          isVerifiedByTGM: true,
          tgmVerifiedAt:
            new Date().toISOString(),
          tgmVerifiedBy: `${activeProfile.name} (TGM)`,
          tgmRemarks:
            finalRemarks,
          status: "approved",
        }
      );

      const sub =
        submissions.find(
          (s) => s.id === id
        );

      if (sub) {
        const studentUser =
          allUsers.find(
            (u) =>
              u.id ===
                sub.studentId ||
              u.erpNo ===
                sub.studentErpNo
          );

        const studentEmail =
          studentUser?.email ||
          `${
            sub.studentErpNo ||
            "student"
          }@tcetmumbai.in`;

        sendSubmissionStatusNotification({
          studentEmail,
          studentName:
            sub.studentName,
          activityName:
            sub.activityName,
          points:
            sub.calculatedPoints,
          status: "approved",
          remarks:
            finalRemarks,
          updatedBy: `${activeProfile.name} (TGM)`,
          submissionId: sub.id,
        }).catch((e) =>
          console.warn(
            "Notification send notice:",
            e
          )
        );
      }

      confetti({
        particleCount: 50,
        spread: 60,
        origin: {
          y: 0.7,
        },
      });
    };

  /* -------------------------------------------------------
     TGM REJECT
  ------------------------------------------------------- */

  const handleRejectByTGM =
    async (
      id: string,
      remarks: string
    ) => {
      await updateSubmissionInDb(
        id,
        {
          isVerifiedByTGM: false,
          tgmRemarks: remarks,
          status: "rejected",
        }
      );

      const sub =
        submissions.find(
          (s) => s.id === id
        );

      if (sub) {
        const studentUser =
          allUsers.find(
            (u) =>
              u.id ===
                sub.studentId ||
              u.erpNo ===
                sub.studentErpNo
          );

        const studentEmail =
          studentUser?.email ||
          `${
            sub.studentErpNo ||
            "student"
          }@tcetmumbai.in`;

        sendSubmissionStatusNotification({
          studentEmail,
          studentName:
            sub.studentName,
          activityName:
            sub.activityName,
          points:
            sub.calculatedPoints,
          status: "rejected",
          remarks,
          updatedBy: `${activeProfile.name} (TGM)`,
          submissionId: sub.id,
        }).catch((e) =>
          console.warn(
            "Notification send notice:",
            e
          )
        );
      }
    };

  /* -------------------------------------------------------
     TGM RESUBMISSION
  ------------------------------------------------------- */

  const handleRequestResubmissionByTGM =
    async (
      id: string,
      remarks: string
    ) => {
      await updateSubmissionInDb(
        id,
        {
          tgmRemarks: remarks,
          status:
            "resubmission_requested",
        }
      );

      const sub =
        submissions.find(
          (s) => s.id === id
        );

      if (sub) {
        const studentUser =
          allUsers.find(
            (u) =>
              u.id ===
                sub.studentId ||
              u.erpNo ===
                sub.studentErpNo
          );

        const studentEmail =
          studentUser?.email ||
          `${
            sub.studentErpNo ||
            "student"
          }@tcetmumbai.in`;

        sendSubmissionStatusNotification({
          studentEmail,
          studentName:
            sub.studentName,
          activityName:
            sub.activityName,
          points:
            sub.calculatedPoints,
          status:
            "resubmission_requested",
          remarks,
          updatedBy: `${activeProfile.name} (TGM)`,
          submissionId: sub.id,
        }).catch((e) =>
          console.warn(
            "Notification send notice:",
            e
          )
        );
      }
    };

  /* -------------------------------------------------------
     ADMIN MANAGEMENT
  ------------------------------------------------------- */

  const handleAddAdmin = async (
    newAdmin: Omit<
      AdminUser,
      "id" | "addedAt"
    >
  ) => {
    const adminObj: AdminUser = {
      ...newAdmin,
      id: `ADM-${Date.now()
        .toString()
        .slice(-4)}`,
      addedAt:
        new Date()
          .toISOString()
          .split("T")[0],
    };

    await addAdminToDb(adminObj);
  };

  const handleRemoveAdmin =
    async (id: string) => {
      await removeAdminFromDb(id);
    };

  const handleApproveTgmUser =
    async (
      userIdOrEmail: string
    ) => {
      await approveTgmUserInDb(
        userIdOrEmail,
        activeProfile.name ||
          "Super Admin"
      );
    };

  const handleRejectTgmUser =
    async (
      userIdOrEmail: string
    ) => {
      await rejectTgmUserInDb(
        userIdOrEmail
      );
    };

  const handleUpdateProfile =
    async (
      updatedProfile: UserProfile
    ) => {
      setActiveProfile(
        updatedProfile
      );

      await saveUserProfileToDb(
        updatedProfile
      );
    };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
  <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900 font-sans antialiased selection:bg-indigo-500 selection:text-white">

    {/* Global Navigation Header */}
    {currentRole !== "auth" && (
      <Header
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        activeProfile={activeProfile}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        pendingCrCount={pendingCrCount}
        pendingAdminCount={pendingAdminCount}
        totalApprovedPoints={totalApprovedPoints}
        onOpenWhitelist={() => setCurrentRole("admin")}
        onReseedDb={handleReseedDb}
        onOpenStorageExplorer={() => setIsStorageExplorerOpen(true)}
      />
    )}

    {/* Main Content */}
    <main className="flex min-h-0 flex-1 w-full min-w-0 flex-col">

      {/* Student first-time onboarding */}
      {studentOnboarding && (
        <StudentProfileSetup
          email={studentOnboarding.email}
          name={studentOnboarding.name}
          existingProfile={studentOnboarding.existingProfile}
          onComplete={handleStudentOnboardingComplete}
          onBack={() => {
            setStudentOnboarding(null);
            setCurrentRole("auth");
          }}
        />
      )}

      {/* Student */}
      {!studentOnboarding && currentRole === "student" && (
        <StudentDashboard
          student={activeProfile}
          submissions={submissions.filter(
            (s) =>
              s.studentId === activeProfile.id ||
              s.studentErpNo === activeProfile.erpNo
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

      {/* CR */}
      {currentRole === "cr" && (
        <CRReviewPortal
          submissions={submissions.filter(s => {
            const studentUser = allUsers.find(
              (u) => u.id === s.studentId || u.erpNo === s.studentErpNo
            );
            return (
              s.studentDivision === activeProfile.division &&
              studentUser?.crId === activeProfile.id
            );
          })}
          activeProfile={activeProfile}
          onValidateByCR={handleValidateByCR}
          onRequestResubmission={handleRequestResubmissionByCR}
          onViewDetails={setSelectedDetailsSubmission}
        />
      )}

      {/* TGM Dashboard */}
      {currentRole === "admin" && (
        <TGMDashboard
          submissions={submissions.filter(s => {
            const studentUser = allUsers.find(
              (u) => u.id === s.studentId || u.erpNo === s.studentErpNo
            );
            return studentUser?.tgmId === activeProfile.id;
          })}
          admins={admins}
          allUsers={allUsers}
          onApproveByTGM={handleApproveByTGM}
          onRejectByTGM={handleRejectByTGM}
          onRequestResubmissionByTGM={handleRequestResubmissionByTGM}
          onViewDetails={setSelectedDetailsSubmission}
          activeProfile={activeProfile}
        />
      )}

      {/* Super Admin Dashboard */}
      {currentRole === "superadmin" && (
        <SuperAdminDashboard
          admins={admins}
          allUsers={allUsers}
          onAddAdmin={handleAddAdmin}
          onRemoveAdmin={handleRemoveAdmin}
          onApproveTgmUser={handleApproveTgmUser}
          onRejectTgmUser={handleRejectTgmUser}
          studentProfile={activeProfile}
        />
      )}


      {/* Authentication / Landing */}
      {!studentOnboarding && currentRole === "auth" &&
        (isSuperAdminRoute ? (
          <SuperAdminAuthPage
            onSelectProfile={(profile) => {
              handleSelectProfile(profile);
            }}
            onReturnToStandardAuth={() => {
              setIsSuperAdminRoute(false);
              setSelectedEntryRole(null);

              if (window.location.pathname.includes("superadmin")) {
                window.history.pushState({}, "", "/");
              }

              window.location.hash = "";
            }}
          />
        ) : selectedEntryRole === null ? (
          <RoleSelectionPage
            onSelectRole={(role) => setSelectedEntryRole(role)}
            onGoToSuperAdmin={() => {
              window.location.hash = "#superadmin";
              setIsSuperAdminRoute(true);
            }}
          />
        ) : (
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
        ))}
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

    {/* Single Global Footer */}
    <footer className="shrink-0 border-t border-slate-800 bg-slate-900 text-slate-400">
      <div className="flex min-h-8 items-center justify-center px-4 py-3 sm:px-6 sm:py-4">
        <p className="text-center text-[9px] leading-relaxed sm:text-[10px]">
          © 2026 Thakur College of Engineering &amp; Technology (Autonomous).
          All Rights Reserved.
        </p>
      </div>
    </footer>

  </div>
);
}
