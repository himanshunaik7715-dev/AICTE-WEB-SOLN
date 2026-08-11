import React from 'react';
import { UserRole, UserProfile } from '../types';
import {
  Award,
  GraduationCap,
  FileCheck2,
  User,
  LogOut,
} from 'lucide-react';

interface HeaderProps {
  currentRole: UserRole | 'auth';
  onRoleChange: (role: UserRole | 'auth') => void;
  activeProfile: UserProfile;
  onOpenAuthModal: () => void;
  onLogout?: () => void;
  pendingCrCount: number;
  pendingAdminCount: number;
  totalApprovedPoints: number;
  onOpenWhitelist?: () => void;
  onReseedDb?: () => void;
  onOpenStorageExplorer?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  onRoleChange,
  activeProfile,
  onOpenAuthModal,
  onLogout,
  pendingCrCount,
  pendingAdminCount,
  totalApprovedPoints,
}) => {
  if (currentRole === 'auth') {
    return null;
  }

  return (
    <header className="bg-white text-slate-900 border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between py-3.5 gap-3">
          {/* Brand & App Info */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="w-9 h-9 bg-indigo-600 rounded-lg text-white flex items-center justify-center font-bold text-lg shadow-sm">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-lg text-slate-900 tracking-tight">
                TCET AICTE Activity Points
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Thakur College of Engineering & Technology (Autonomous)
              </p>
            </div>
          </div>

          {/* Account Actions */}
          <div className="flex items-center gap-2.5 flex-wrap justify-end w-full md:w-auto">
            <div
              className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-2 rounded-xl text-xs font-semibold shadow-xs select-none"
            >
              <User className="w-3.5 h-3.5 text-white" />
              <span>{activeProfile.name.split(' ')[0]} ({activeProfile.role.toUpperCase()})</span>
            </div>

            {onLogout && (
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 px-2.5 py-2 rounded-xl text-xs font-semibold border border-rose-200 shadow-2xs transition-colors cursor-pointer"
                title="Sign Out / Log Out"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-600" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Context Bar */}
        <div className="py-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-semibold text-slate-900">
              {activeProfile.name}
            </span>
            <span className="text-slate-300 hidden sm:inline">|</span>
            <span className="text-slate-500 hidden md:inline">
              Dept: <strong className="text-slate-800">{activeProfile.department} ({activeProfile.division})</strong>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
