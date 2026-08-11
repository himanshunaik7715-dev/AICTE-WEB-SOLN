import React, { useState } from 'react';
import { CertificateSubmission, UserProfile, AdminUser } from '../types';
import { getDriveFileWebUrl } from '../services/driveService';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  X,
  Database,
  HardDrive,
  ExternalLink,
  Copy,
  Check,
  FileCode2,
  Sparkles,
  Server,
  Cloud,
  ShieldCheck,
} from 'lucide-react';

interface StorageExplorerModalProps {
  submissions: CertificateSubmission[];
  admins: AdminUser[];
  activeProfile: UserProfile;
  onClose: () => void;
}

export const StorageExplorerModal: React.FC<StorageExplorerModalProps> = ({
  submissions,
  admins,
  activeProfile,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'drive' | 'supabase' | 'sql' | 'raw'>('supabase');
  const [selectedCollection, setSelectedCollection] = useState<'submissions' | 'users' | 'admins'>('submissions');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';

  const sqlSetupQuery = `-- 1. DROP EXISTING TABLES (IF ANY) TO ENSURE CLEAN COLUMNS
DROP TABLE IF EXISTS public.submissions;
DROP TABLE IF EXISTS public.users;
DROP TABLE IF EXISTS public.admins;

-- 2. CREATE USERS TABLE
CREATE TABLE public.users (
  "id" TEXT PRIMARY KEY,
  "name" TEXT,
  "email" TEXT,
  "role" TEXT,
  "rollNo" TEXT,
  "erpNo" TEXT,
  "department" TEXT,
  "division" TEXT,
  "academicBatch" TEXT,
  "photoUrl" TEXT,
  "tgmName" TEXT,
  "crName" TEXT,
  "driveRootFolderId" TEXT
);

-- 3. CREATE ADMINS TABLE
CREATE TABLE public.admins (
  "id" TEXT PRIMARY KEY,
  "email" TEXT,
  "name" TEXT,
  "designation" TEXT,
  "department" TEXT,
  "addedBy" TEXT,
  "addedAt" TEXT,
  "isWhitelisted" BOOLEAN DEFAULT true
);

-- 4. CREATE SUBMISSIONS TABLE
CREATE TABLE public.submissions (
  "id" TEXT PRIMARY KEY,
  "studentId" TEXT,
  "studentName" TEXT,
  "studentRollNo" TEXT,
  "studentErpNo" TEXT,
  "studentDepartment" TEXT,
  "studentDivision" TEXT,
  "semester" TEXT,
  "activityName" TEXT,
  "conductedBy" TEXT,
  "activityCategoryNo" INT,
  "shortDescription" TEXT,
  "hoursSpent" NUMERIC,
  "calculatedPoints" NUMERIC,
  "currentFileDriveId" TEXT,
  "fileName" TEXT,
  "fileDataUrl" TEXT,
  "fileDriveIdHistory" JSONB DEFAULT '[]'::jsonb,
  "isCheckedByCR" BOOLEAN DEFAULT false,
  "crCheckedAt" TEXT,
  "crCheckedBy" TEXT,
  "crRemarks" TEXT,
  "isVerifiedByTGM" BOOLEAN DEFAULT false,
  "tgmVerifiedAt" TEXT,
  "tgmVerifiedBy" TEXT,
  "tgmRemarks" TEXT,
  "status" TEXT,
  "createdAt" TEXT,
  "updatedAt" TEXT
);

-- 5. DISABLE ROW LEVEL SECURITY (RLS) FOR FULL APP ACCESS
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions DISABLE ROW LEVEL SECURITY;

-- 6. GRANT PERMISSIONS TO ANON & AUTHENTICATED
GRANT ALL ON TABLE public.users TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.admins TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.submissions TO anon, authenticated, service_role;`;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(label);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600/30 rounded-xl border border-emerald-500/30 text-emerald-300">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight">Supabase & Drive Inspector</h2>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                    isSupabaseConfigured
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                  }`}
                >
                  {isSupabaseConfigured ? 'Supabase Live Connected' : 'Supabase Setup Ready'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Explore Supabase Database Tables, Auth Tokens & Google Drive Document Links
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Storage Architecture Banner */}
        <div className="bg-slate-950 text-slate-100 px-6 py-3 border-b border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <Server className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white block font-semibold">1. Supabase Postgres & Auth Engine</strong>
              <span className="text-slate-300 text-[11px]">
                URL: <code className="text-emerald-300 font-mono text-[10px]">{supabaseUrl}</code>
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Cloud className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white block font-semibold">2. Google Drive Link Storage (Certificates)</strong>
              <span className="text-slate-300 text-[11px]">
                Root Folder: <code className="text-indigo-300 font-mono">TCET_AICTE_Portfolio/&lt;RollNo&gt;_&lt;Name&gt;/&lt;Sem&gt;</code>
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('drive')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-t border-x transition-all ${
              activeTab === 'drive'
                ? 'bg-white border-slate-200 text-indigo-600 shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <HardDrive className="w-4 h-4 text-indigo-600" />
            Google Drive File Storage ({submissions.length})
          </button>

          <button
            onClick={() => setActiveTab('supabase')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-t border-x transition-all ${
              activeTab === 'supabase'
                ? 'bg-white border-slate-200 text-emerald-600 shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-4 h-4 text-emerald-600" />
            Supabase Tables & Data
          </button>

          <button
            onClick={() => setActiveTab('sql')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-t border-x transition-all ${
              activeTab === 'sql'
                ? 'bg-white border-slate-200 text-cyan-600 shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCode2 className="w-4 h-4 text-cyan-600" />
            SQL Setup Query (Copy)
          </button>

          <button
            onClick={() => setActiveTab('raw')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-t border-x transition-all ${
              activeTab === 'raw'
                ? 'bg-white border-slate-200 text-amber-600 shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCode2 className="w-4 h-4 text-amber-600" />
            Raw Document JSON Payload
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: GOOGLE DRIVE FILES */}
          {activeTab === 'drive' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Google Drive Portfolio Storage Links
                  </h3>
                  <p className="text-xs text-slate-600 font-mono mt-0.5">
                    📁 Google Drive / TCET_AICTE_Portfolio / {activeProfile.rollNo}_{activeProfile.name.replace(/\s+/g, '_')}
                  </p>
                </div>
                <span className="text-xs bg-indigo-100 text-indigo-800 font-bold px-3 py-1 rounded-lg">
                  {submissions.length} Portfolio File(s)
                </span>
              </div>

              {submissions.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  No certificate submissions or Google Drive links found yet. Upload a certificate to view its Google Drive URL & Storage location!
                </div>
              ) : (
                <div className="space-y-3">
                  {submissions.map((sub, idx) => {
                    const driveUrl = getDriveFileWebUrl(sub.currentFileDriveId);
                    return (
                      <div
                        key={`${sub.id}-${idx}`}
                        className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-indigo-300 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900">{sub.activityName}</span>
                            <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-mono">
                              {sub.semester}
                            </span>
                            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md">
                              {sub.calculatedPoints} Pts
                            </span>
                          </div>

                          <div className="text-xs text-slate-500 font-mono flex flex-wrap items-center gap-2 pt-1">
                            <span>📄 File: <strong className="text-slate-800">{sub.fileName}</strong></span>
                            <span>•</span>
                            <span>Drive ID: <strong className="text-indigo-700">{sub.currentFileDriveId}</strong></span>
                          </div>

                          <div className="text-[11px] text-slate-400 font-mono">
                            Path: TCET_AICTE_Portfolio/{sub.studentRollNo}_{sub.studentName.replace(/\s+/g, '_')}/{sub.semester}/{sub.fileName}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end">
                          <button
                            onClick={() => handleCopy(driveUrl, sub.id)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                          >
                            {copiedId === sub.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedId === sub.id ? 'Copied' : 'Copy Link'}</span>
                          </button>

                          <a
                            href={driveUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Open in Drive</span>
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SUPABASE TABLES */}
          {activeTab === 'supabase' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setSelectedCollection('submissions')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    selectedCollection === 'submissions'
                      ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Table</span>
                  <strong className="text-xs font-bold text-slate-900 block mt-0.5">submissions</strong>
                  <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
                    {submissions.length} Rows
                  </span>
                </button>

                <button
                  onClick={() => setSelectedCollection('admins')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    selectedCollection === 'admins'
                      ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Table</span>
                  <strong className="text-xs font-bold text-slate-900 block mt-0.5">admins</strong>
                  <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
                    {admins.length} Whitelisted Admins
                  </span>
                </button>

                <button
                  onClick={() => setSelectedCollection('users')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    selectedCollection === 'users'
                      ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Table</span>
                  <strong className="text-xs font-bold text-slate-900 block mt-0.5">users</strong>
                  <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
                    Student Profiles
                  </span>
                </button>
              </div>

              <div className="bg-slate-900 text-slate-200 rounded-2xl p-4 font-mono text-xs max-h-[350px] overflow-y-auto space-y-2 border border-slate-800">
                <div className="text-emerald-400 font-bold border-b border-slate-800 pb-2">
                  -- Supabase Table: public.{selectedCollection} ({supabaseUrl})
                </div>

                {selectedCollection === 'submissions' && (
                  <pre className="text-slate-300 whitespace-pre-wrap">
                    {JSON.stringify(submissions, null, 2)}
                  </pre>
                )}

                {selectedCollection === 'admins' && (
                  <pre className="text-emerald-300 whitespace-pre-wrap">
                    {JSON.stringify(admins, null, 2)}
                  </pre>
                )}

                {selectedCollection === 'users' && (
                  <pre className="text-amber-300 whitespace-pre-wrap">
                    {JSON.stringify(activeProfile, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: SQL SETUP QUERY */}
          {activeTab === 'sql' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-cyan-50 border border-cyan-200 rounded-2xl p-4">
                <div>
                  <h3 className="text-xs font-bold text-cyan-900 uppercase tracking-wider">
                    Supabase Schema Setup Script
                  </h3>
                  <p className="text-xs text-cyan-700 mt-0.5">
                    Copy and run this SQL script in <strong>Supabase SQL Editor</strong> to create all tables (users, admins, submissions) with exact camelCase columns and disable RLS.
                  </p>
                </div>

                <button
                  onClick={() => handleCopy(sqlSetupQuery, 'sql_script')}
                  className="bg-cyan-700 hover:bg-cyan-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
                >
                  {copiedId === 'sql_script' ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      Copied SQL!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy SQL Query
                    </>
                  )}
                </button>
              </div>

              <div className="bg-slate-900 text-slate-200 rounded-2xl p-4 font-mono text-xs max-h-[350px] overflow-y-auto space-y-2 border border-slate-800">
                <pre className="text-cyan-300 whitespace-pre-wrap">{sqlSetupQuery}</pre>
              </div>
            </div>
          )}

          {/* TAB 4: RAW JSON */}
          {activeTab === 'raw' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                Complete Real-Time Application State persisted in Supabase database & Google Drive:
              </p>
              <div className="bg-slate-900 text-slate-200 rounded-2xl p-4 font-mono text-[11px] max-h-[380px] overflow-y-auto border border-slate-800">
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(
                    {
                      supabase_configuration: {
                        url: supabaseUrl,
                        status: isSupabaseConfigured ? 'CONNECTED' : 'LOCAL_STORAGE_FALLBACK',
                        tables: ['submissions', 'admins', 'users'],
                        authEngine: 'Supabase GoTrue Auth',
                      },
                      google_drive_configuration: {
                        rootFolder: 'TCET_AICTE_Portfolio',
                        scopes: ['https://www.googleapis.com/auth/drive.file'],
                        fileCount: submissions.length,
                      },
                      activeUser: activeProfile,
                      submissions,
                      admins,
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Supabase Auth & Storage integration active</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
