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

import { AICTE_CATEGORIES } from "./constants/aicteData";

import {
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
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { apiUrl } from "./lib/api";
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
const EMPTY_PROFILE: UserProfile = {
  id: "", name: "", email: "", role: "student", rollNo: "", erpNo: "",
  department: "", division: "", academicBatch: "",
};

export default function App() {
  const [currentRole, setCurrentRole] =
    useState<UserRole | "auth">("auth");

  const [activeProfile, setActiveProfile] =
    useState<UserProfile>(EMPTY_PROFILE);

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
        if (!isSupabaseConfigured) {
          setCurrentRole("auth");
          return;
        }
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user?.email) {
          setCurrentRole("auth");
          return;
        }
        const parsed = await getUserProfileByEmail(data.user.email);
        if (!parsed || parsed.id !== data.user.id) {
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

  /* -------------------------------------------------------
     MODALS
  ------------------------------------------------------- */

  const [isAuthModalOpen, setIsAuthModalOpen] =
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
     REAL-TIME DATABASE SUBSCRIPTIONS
  ------------------------------------------------------- */

  useEffect(() => {
    const unsubscribeSubmissions =
      subscribeToSubmissions(currentRole, activeProfile.id, (data) => {
        setSubmissions(data);
      });

    const unsubscribeAdmins =
      subscribeToAdmins(currentRole, (data) => {
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

    saveUserProfileToDb(profile);
  };

  const handleStudentOnboardingComplete = (
    profile: UserProfile
  ) => {
    setStudentOnboarding(null);
    setActiveProfile(profile);
    setCurrentRole("student");

  };

  const handleLogout = async () => {
    await logoutUser();

    setActiveProfile(EMPTY_PROFILE);
    setCurrentRole("auth");
    setSelectedEntryRole(null);
    setStudentOnboarding(null);
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
      const isTgmRejected =
        editingSubmission.status === "rejected" ||
        (editingSubmission.status === "resubmission_requested" &&
          editingSubmission.resubmissionRequestedBy === "tgm");

      const requestedBy = isTgmRejected
        ? null
        : editingSubmission.resubmissionRequestedBy ||
          (editingSubmission.tgmRemarks && editingSubmission.isCheckedByCR
            ? "tgm"
            : editingSubmission.crRemarks
            ? "cr"
            : null);

      const updatedSub: CertificateSubmission = {
        ...editingSubmission,
        ...data,
        studentId: activeProfile.id,
        studentName: activeProfile.name,
        studentRollNo: activeProfile.rollNo,
        studentErpNo: activeProfile.erpNo,
        studentDepartment: activeProfile.department,
        studentDivision: activeProfile.division,
        isCheckedByCR:
          requestedBy === "tgm" ? editingSubmission.isCheckedByCR : false,
        isVerifiedByTGM: false,
        // A replacement for a TGM-rejected certificate restarts the same
        // verification pipeline as every submitted certificate: CR, then TGM.
        status: isTgmRejected
          ? "pending_cr"
          : requestedBy === "tgm"
          ? "pending_admin"
          : requestedBy === "cr"
          ? "pending_cr"
          : "imported",
        resubmissionRequestedBy: isTgmRejected
          ? null
          : null,
        crCheckedAt: isTgmRejected ? undefined : editingSubmission.crCheckedAt,
        crCheckedBy: isTgmRejected ? undefined : editingSubmission.crCheckedBy,
        crRemarks: isTgmRejected ? undefined : editingSubmission.crRemarks,
        tgmVerifiedAt: isTgmRejected ? undefined : editingSubmission.tgmVerifiedAt,
        tgmVerifiedBy: isTgmRejected ? undefined : editingSubmission.tgmVerifiedBy,
        tgmRemarks: isTgmRejected ? undefined : editingSubmission.tgmRemarks,
        updatedAt: new Date().toISOString(),
      };

      await saveSubmissionToDb(updatedSub);
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
        status: "imported",
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
            s.studentId === sub.studentId &&
            Boolean(sub.currentFileDriveId) &&
            (
              s.currentFileDriveId === sub.currentFileDriveId ||
              s.fileDriveIdHistory?.includes(sub.currentFileDriveId) ||
              (
                (s.status === "resubmission_requested" ||
                  (s.status === "rejected" &&
                    s.resubmissionRequestedBy === "tgm")) &&
                s.fileName.trim().toLowerCase() === sub.fileName.trim().toLowerCase()
              )
            )
        );

      if (existing) {
        const mergedFileHistory = Array.from(new Set([
          ...(existing.fileDriveIdHistory || []),
          ...(sub.fileDriveIdHistory || []),
          sub.currentFileDriveId,
        ].filter(Boolean)));
        const incomingIsKnownVersion = (existing.fileDriveIdHistory || [])
          .includes(sub.currentFileDriveId);
        const nextCurrentFileId = incomingIsKnownVersion
          ? existing.currentFileDriveId
          : sub.currentFileDriveId;
        const activeStatuses = [
          "pending_cr",
          "pending_admin",
          "approved",
          "rejected",
          "resubmission_requested",
        ];

        // A corrected TGM-rejected file restarts at CR verification, then
        // follows the normal Stage-1 -> Stage-2 workflow.
        const isTgmRejectedRefetch =
          existing.status === "rejected";

        const keepStatus = isTgmRejectedRefetch
          ? "pending_cr"
          : activeStatuses.includes(existing.status)
          ? existing.status
          : sub.status;

        await updateSubmissionInDb(
          existing.id,
          {
            ...sub,
            id: existing.id,
            status: keepStatus,
            resubmissionRequestedBy: isTgmRejectedRefetch
              ? null
              : existing.resubmissionRequestedBy,
            currentFileDriveId: nextCurrentFileId,
            fileDriveIdHistory: mergedFileHistory,
            isCheckedByCR: isTgmRejectedRefetch
              ? false
              : existing.isCheckedByCR,
            crCheckedAt: isTgmRejectedRefetch
              ? undefined
              : existing.crCheckedAt,
            crCheckedBy: isTgmRejectedRefetch
              ? undefined
              : existing.crCheckedBy,
            crRemarks: isTgmRejectedRefetch
              ? undefined
              : existing.crRemarks,
            isVerifiedByTGM: isTgmRejectedRefetch
              ? false
              : existing.isVerifiedByTGM,
            tgmVerifiedAt: isTgmRejectedRefetch
              ? undefined
              : existing.tgmVerifiedAt,
            tgmVerifiedBy: isTgmRejectedRefetch
              ? undefined
              : existing.tgmVerifiedBy,
            tgmRemarks: isTgmRejectedRefetch
              ? undefined
              : existing.tgmRemarks,
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
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) throw new Error('Authentication required');
        const res = await fetch(
          apiUrl("/api/gemini/classify-certificate"),
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization: `Bearer ${accessToken}`,
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
    };

  /* -------------------------------------------------------
     STUDENT EXPLICIT "APPLY FOR CR" ACTION
     (Workflow: re-fetched/re-uploaded files are explicitly sent to
     Stage-1 by the student from the semester folder view.)
  ------------------------------------------------------- */

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
          resubmissionRequestedBy: "cr",
          status:
            "resubmission_requested",
        }
      );
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
          resubmissionRequestedBy: "tgm",
          status: "rejected",
        }
      );
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
          resubmissionRequestedBy: "tgm",
          status:
            "resubmission_requested",
        }
      );
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

            // 1) Student explicitly assigned this CR.
            if (studentUser?.crId === activeProfile.id) {
              return true;
            }

            // 2) Fallback: same division (and batch when known).
            //    This covers students who have not yet picked a CR.
            const crDivision = (activeProfile.division || "").trim();
            const crBatch = (activeProfile.academicBatch || "").trim();

            const sameDivision =
              crDivision === "" ||
              crDivision === "All Divisions" ||
              s.studentDivision === crDivision;

            const sameBatch =
              crBatch === "" ||
              !studentUser ||
              !studentUser.academicBatch ||
              studentUser.academicBatch === crBatch;

            return sameDivision && sameBatch;
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
          />
        ) : (
          <AuthPage
            activeProfile={activeProfile}
            allUsers={allUsers}
            onSelectProfile={(profile) => {
              handleSelectProfile(profile);
            }}
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

    <footer className="shrink-0 border-t border-white/15 bg-black text-[#bbbbbb]">
      <div aria-hidden="true" className="flex h-1 w-full">
        <span className="w-1/3 bg-[#0066b1]" />
        <span className="w-1/3 bg-[#1c69d4]" />
        <span className="w-1/3 bg-[#e22718]" />
      </div>
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-2 px-3 py-3 text-center sm:gap-4 sm:px-6 sm:py-5 md:flex-row md:justify-between md:gap-6 md:px-8 md:py-7 md:text-left lg:px-10">
        <p className="max-w-full text-[10px] font-light leading-4 sm:text-xs sm:leading-6">
          © 2026 Thakur College of Engineering and Technology. All rights reserved.
        </p>
        <div className="flex w-full min-w-0 flex-nowrap items-center justify-center gap-2 border-t border-white/20 pt-2 text-[8px] uppercase tracking-normal sm:w-auto sm:gap-4 sm:pt-3 sm:text-[10px] sm:tracking-[0.1em] md:max-w-[65%] md:justify-end md:border-l md:border-t-0 md:py-0 md:pl-5 md:pt-0">
          <span className="shrink-0 text-[#7e7e7e]">
            Support
          </span>
          <a
            href="tel:+919561874652"
            className="shrink-0 py-0.5 text-[#e6e6e6] transition-colors hover:text-white sm:py-1"
          >
            Call 9561874652
          </a>
          <a
            href="mailto:1032250476@tcetmumbai.in"
            className="min-w-0 py-0.5 text-[#e6e6e6] normal-case tracking-normal transition-colors hover:text-white sm:py-1"
          >
            1032250476@tcetmumbai.in
          </a>
        </div>
      </div>
    </footer>

  </div>
);
}
