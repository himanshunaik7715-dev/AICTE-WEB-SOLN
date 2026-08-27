import React, { useState } from "react";
import { UserRole, UserProfile } from "../types";
import { User, LogOut, Menu, X } from "lucide-react";

interface HeaderProps {
  currentRole: UserRole | "auth";
  onRoleChange: (role: UserRole | "auth") => void;
  activeProfile: UserProfile;
  onOpenAuthModal: () => void;
  onLogout?: () => void;
  pendingCrCount: number;
  pendingAdminCount: number;
  totalApprovedPoints: number;
  onOpenWhitelist?: () => void;
}

/**
 * Course comes from the user's DB/profile record.
 *
 * CSE(IOT) / CSE (IOT)
 *      -> B.Tech in CSE (Internet of Things)
 *
 * IOT
 *      -> B.Tech in Internet of Things
 */
const formatCourse = (course?: string | null): string => {
  if (!course) {
    return "B.Tech";
  }

  const normalized = course.trim().toUpperCase().replace(/\s+/g, "");

  if (normalized === "CSE(IOT)") {
    return "B.Tech in CSE (Internet of Things)";
  }

  if (normalized === "IOT") {
    return "B.Tech in Internet of Things";
  }

  // Fallback for any other course stored in DB
  return `B.Tech in ${course.trim()}`;
};

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  activeProfile,
  onLogout,
}) => {
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);

  // Header is not shown on authentication page
  if (currentRole === "auth") {
    return null;
  }

  return (
    <header className="bg-white text-slate-900 border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-8">
        {/* ============================================================
            TOP HEADER
        ============================================================ */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 py-3">
          {/* ==========================================================
              BRAND
          ========================================================== */}
          <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
            <img
              src="/tcet-logo.ico"
              alt="TCET logo"
              className="h-12 w-12 shrink-0 object-contain"
            />

            <div className="min-w-0">
              <h1
                className="
                font-semibold
                text-base
                sm:text-lg
                text-slate-900
                tracking-tight
                truncate
              "
              >
                TCET AICTE Activity Points
              </h1>

              <p
                className="
                text-[10px]
                sm:text-xs
                text-slate-500
                font-medium
                truncate
              "
              >
                Thakur College of Engineering & Technology (Autonomous)
              </p>
            </div>
          </div>

          {/* ==========================================================
              ACCOUNT
          ========================================================== */}
          <div
            className="
            flex
            items-center
            gap-2
            w-full
            sm:w-auto
          "
          >
            <button
              type="button"
              onClick={() => setMobileDetailsOpen((open) => !open)}
              aria-expanded={mobileDetailsOpen}
              aria-controls="mobile-profile-details"
              aria-label={mobileDetailsOpen ? "Hide profile details" : "Show profile details"}
              className="sm:hidden flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700"
            >
              {mobileDetailsOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            {/* User Profile Badge */}
            <div
              className="
              flex
              items-center
              gap-2
              bg-indigo-600
              text-white
              px-3
              py-2
              rounded-xl
              text-xs
              font-semibold
              shadow-sm
              min-w-0
              flex-1
              sm:flex-none
            "
            >
              <User className="w-3.5 h-3.5 shrink-0" />

              <span
                className="
                truncate
                max-w-45
                sm:max-w-55
              "
              >
                {activeProfile.name || "User"}
              </span>

              <span className="hidden md:inline text-indigo-200">•</span>

              <span
                className="
                hidden
                md:inline
                uppercase
              "
              >
                {activeProfile.role}
              </span>
            </div>

            {/* Logout */}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                title="Sign Out / Log Out"
                className="
                  flex
                  items-center
                  justify-center
                  gap-1.5
                  bg-rose-50
                  hover:bg-rose-100
                  text-rose-700
                  hover:text-rose-800
                  px-3
                  py-2
                  rounded-xl
                  text-xs
                  font-semibold
                  border
                  border-rose-200
                  shadow-sm
                  transition-colors
                  cursor-pointer
                  shrink-0
                "
              >
                <LogOut className="w-3.5 h-3.5" />

                <span className="hidden sm:inline">Logout</span>
              </button>
            )}
          </div>
        </div>

        {/* ============================================================
            USER INFORMATION BAR
        ============================================================ */}
        <div
          id="mobile-profile-details"
          className={`${mobileDetailsOpen ? "block" : "hidden"} border-t border-slate-100 py-3 sm:block`}
        >
          <div
            className="
            grid
            grid-cols-1
            sm:flex
            items-center
            gap-x-4
            gap-y-2
            flex-wrap
            text-xs
          "
          >
            {/* ========================================================
                NAME
            ======================================================== */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Name:</span>

              <strong className="text-slate-900">
                {activeProfile.name || "N/A"}
              </strong>
            </div>

            {currentRole !== "cr" && currentRole !== "admin" && currentRole !== "superadmin" && (
              <>
                <span className="text-slate-300 hidden sm:inline">|</span>

                {/* ERP NUMBER */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">ERP:</span>

                  <strong className="text-slate-800">
                    {activeProfile.erpNo ?? "N/A"}
                  </strong>
                </div>
              </>
            )}

            {currentRole !== "superadmin" && (
              <>
                <span className="text-slate-300 hidden sm:inline">|</span>
                {/* ========================================================
                    DEPARTMENT
                ======================================================== */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Department:</span>

                  <strong className="text-slate-800">
                    {activeProfile.department || "N/A"}
                  </strong>
                </div>
              </>
            )}

            {currentRole === "superadmin" && (
              <>
                <span className="text-slate-300 hidden sm:inline">|</span>
                {/* ========================================================
                    DEPARTMENT (Super Admin — restricted to allowed values)
                ======================================================== */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Department:</span>

                  <strong className="text-slate-800">
                    {activeProfile.department === "CSE(Internet oF Things)"
                      ? "CSE (Internet of Things)"
                      : "Internet of Things (IoT)"}
                  </strong>
                </div>
              </>
            )}

            {currentRole !== "cr" && currentRole !== "admin" && currentRole !== "superadmin" && (
              <>
                <span className="text-slate-300 hidden sm:inline">|</span>
                {/* ========================================================
                    COURSE
                ======================================================== */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Course:</span>

                  <strong className="text-slate-800">
                    {currentRole === "cr" || currentRole === "admin"
                      ? activeProfile.academicBatch === "2025-2029"
                        ? "B.Tech CSE (Internet of Things)"
                        : "Internet of Things (IoT)"
                      : formatCourse(activeProfile.course)}
                  </strong>
                </div>
              </>
            )}

            {/* ========================================================
                DIVISION (Hidden for 2024-2028, N/A, or super admin)
            ======================================================== */}
            {currentRole !== "superadmin" &&
              !activeProfile.academicBatch?.includes('2024-2028') &&
              activeProfile.division !== 'N/A' && (
                <>
                  <span className="text-slate-300 hidden sm:inline">|</span>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500">Division:</span>

                    <strong className="text-slate-800">
                      {activeProfile.division || "N/A"}
                    </strong>
                  </div>

                </>
              )}

            {currentRole !== "cr" && currentRole !== "admin" && currentRole !== "superadmin" && (
              <>
                <span className="text-slate-300 hidden sm:inline">|</span>

                {/* ROLL NUMBER */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Roll No:</span>

                  <strong className="text-slate-800">
                    {activeProfile.rollNo ?? "N/A"}
                  </strong>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
