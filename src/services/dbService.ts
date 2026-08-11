import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  CertificateSubmission,
  AdminUser,
  UserProfile,
} from '../types';
import { sendTgmApprovalNotification } from './emailClient';
import {
  INITIAL_SUBMISSIONS,
  INITIAL_ADMINS,
  DEFAULT_STUDENT,
  STUDENT_VIKRAM,
  STUDENT_SNEHA,
  STUDENT_AARAV,
  SUPERADMIN_PROFILE,
} from '../constants/aicteData';

// Local storage key constants for seamless offline/fallback state
const LS_SUBMISSIONS_KEY = 'tcet_aicte_submissions_v2';
const LS_USERS_KEY = 'tcet_aicte_users_v2';
const LS_ADMINS_KEY = 'tcet_aicte_admins_v2';

// Seed Profiles for Students, CRs, Teachers/TGMs, and Super Admin
export const SEEDED_PROFILES: UserProfile[] = [
  SUPERADMIN_PROFILE,
  DEFAULT_STUDENT,
  STUDENT_VIKRAM,
  STUDENT_SNEHA,
  STUDENT_AARAV,
  {
    id: 'STU-2023011988',
    name: 'Priya Singh',
    email: '2023011988@tcetmumbai.in',
    role: 'student',
    rollNo: '5',
    erpNo: '2023011988',
    department: 'Internet of Things (IoT)',
    division: 'A',
    academicBatch: '2023-2027',
    tgmName: 'Prof. S. K. Mehta (TGM)',
    crName: 'Ananya Verma (CR)',
    driveRootFolderId: 'drive_folder_priya_singh_2023',
  },
  {
    id: 'STU-2023012001',
    name: 'Amit Patel',
    email: '2023012001@tcetmumbai.in',
    role: 'student',
    rollNo: '6',
    erpNo: '2023012001',
    department: 'Internet of Things (IoT)',
    division: 'A',
    academicBatch: '2023-2027',
    tgmName: 'Prof. S. K. Mehta (TGM)',
    crName: 'Ananya Verma (CR)',
    driveRootFolderId: 'drive_folder_amit_patel_2023',
  },
  {
    id: 'CR-2023011100',
    name: 'Ananya Verma (Class Representative)',
    email: 'cr_it_a@tcetmumbai.in',
    role: 'cr',
    rollNo: '7',
    erpNo: '2023011100',
    department: 'Internet of Things (IoT)',
    division: 'A',
    academicBatch: '2023-2027',
    tgmName: 'Prof. S. K. Mehta (TGM)',
    crName: 'Ananya Verma (CR)',
    driveRootFolderId: 'drive_folder_ananya_verma_cr',
  },
  {
    id: 'TGM-1001',
    name: 'Prof. S. K. Mehta (Senior TGM)',
    email: 'skmehta@tcetmumbai.in',
    role: 'admin',
    rollNo: '101',
    erpNo: 'ERP-TGM-101',
    department: 'Internet of Things (IoT)',
    division: 'All IoT Divisions',
    academicBatch: 'Faculty Guide',
    tgmName: 'Prof. S. K. Mehta (TGM)',
    tgmApprovalStatus: 'approved',
  },
  {
    id: 'TGM-1002',
    name: 'Dr. Rajesh Patel (AICTE Co-ordinator)',
    email: 'aicte_coordinator@tcetmumbai.in',
    role: 'admin',
    rollNo: '102',
    erpNo: 'ERP-TGM-102',
    department: 'Internet of Things (IoT)',
    division: 'Institutional AICTE Head',
    academicBatch: 'Faculty Guide',
    tgmApprovalStatus: 'approved',
  },
];

// In-Memory state caches
let cachedSubmissions: CertificateSubmission[] = loadFromLocalStorage(LS_SUBMISSIONS_KEY, INITIAL_SUBMISSIONS);
let cachedUsers: UserProfile[] = loadFromLocalStorage(LS_USERS_KEY, SEEDED_PROFILES);
let cachedAdmins: AdminUser[] = loadFromLocalStorage(LS_ADMINS_KEY, INITIAL_ADMINS);

// Listeners
const submissionListeners: Array<(subs: CertificateSubmission[]) => void> = [];
const userListeners: Array<(users: UserProfile[]) => void> = [];
const adminListeners: Array<(admins: AdminUser[]) => void> = [];

function loadFromLocalStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn(`Error reading ${key} from localStorage:`, e);
  }
  return fallback;
}

function saveToLocalStorage<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Error saving ${key} to localStorage:`, e);
  }
}

function notifySubmissions() {
  saveToLocalStorage(LS_SUBMISSIONS_KEY, cachedSubmissions);
  submissionListeners.forEach((fn) => fn([...cachedSubmissions]));
}

function notifyUsers() {
  saveToLocalStorage(LS_USERS_KEY, cachedUsers);
  userListeners.forEach((fn) => fn([...cachedUsers]));
}

function notifyAdmins() {
  saveToLocalStorage(LS_ADMINS_KEY, cachedAdmins);
  adminListeners.forEach((fn) => fn([...cachedAdmins]));
}

/**
 * Seed initial data to Supabase database if configured
 */
export async function seedInitialDatabase(force: boolean = false): Promise<void> {
  if (!isSupabaseConfigured) {
    console.log('Supabase credentials not set. Operating with persistent local storage engine.');
    return;
  }

  try {
    // Check if table records exist in Supabase
    const { data: existingSubmissions, error: errSub } = await supabase.from('submissions').select('id');
    const { data: existingUsers, error: errUsers } = await supabase.from('users').select('id');
    const { data: existingAdmins, error: errAdmins } = await supabase.from('admins').select('id');

    if (errSub || errUsers || errAdmins) {
      console.warn('Supabase tables query issue (check schema/columns):', { errSub, errUsers, errAdmins });
    }

    if (force || !existingUsers || existingUsers.length === 0) {
      const { error } = await supabase.from('users').upsert(cachedUsers);
      if (error) console.error('Users seeding error:', error.message);
    }

    if (force || !existingAdmins || existingAdmins.length === 0) {
      const { error } = await supabase.from('admins').upsert(cachedAdmins);
      if (error) console.error('Admins seeding error:', error.message);
    }

    if (force || !existingSubmissions || existingSubmissions.length === 0) {
      const { error } = await supabase.from('submissions').upsert(cachedSubmissions);
      if (error) console.error('Submissions seeding error:', error.message);
    }

    console.log('Supabase database seeding attempt finished.');
  } catch (error) {
    console.error('Error seeding Supabase database:', error);
  }
}

/**
 * Subscribe to Submissions (Supabase + Local fallback)
 */
export function subscribeToSubmissions(
  callback: (submissions: CertificateSubmission[]) => void
) {
  submissionListeners.push(callback);
  callback([...cachedSubmissions]);

  if (isSupabaseConfigured) {
    // Fetch initial from Supabase
    supabase
      .from('submissions')
      .select('*')
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          const sorted = (data as CertificateSubmission[]).sort(
            (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
          );
          cachedSubmissions = sorted;
          notifySubmissions();
        } else if (error) {
          console.warn('Supabase submissions select error:', error.message);
        }
      });

    // Subscribe to realtime changes
    const channel = supabase
      .channel('public:submissions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => {
        supabase
          .from('submissions')
          .select('*')
          .then(({ data }) => {
            if (data) {
              const sorted = (data as CertificateSubmission[]).sort(
                (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
              );
              cachedSubmissions = sorted;
              notifySubmissions();
            }
          });
      })
      .subscribe();

    return () => {
      const idx = submissionListeners.indexOf(callback);
      if (idx !== -1) submissionListeners.splice(idx, 1);
      supabase.removeChannel(channel);
    };
  }

  return () => {
    const idx = submissionListeners.indexOf(callback);
    if (idx !== -1) submissionListeners.splice(idx, 1);
  };
}

/**
 * Subscribe to Whitelisted Admins
 */
export function subscribeToAdmins(callback: (admins: AdminUser[]) => void) {
  adminListeners.push(callback);
  callback([...cachedAdmins]);

  if (isSupabaseConfigured) {
    supabase
      .from('admins')
      .select('*')
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          cachedAdmins = data as AdminUser[];
          notifyAdmins();
        }
      });

    const channel = supabase
      .channel('public:admins')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admins' }, () => {
        supabase
          .from('admins')
          .select('*')
          .then(({ data }) => {
            if (data) {
              cachedAdmins = data as AdminUser[];
              notifyAdmins();
            }
          });
      })
      .subscribe();

    return () => {
      const idx = adminListeners.indexOf(callback);
      if (idx !== -1) adminListeners.splice(idx, 1);
      supabase.removeChannel(channel);
    };
  }

  return () => {
    const idx = adminListeners.indexOf(callback);
    if (idx !== -1) adminListeners.splice(idx, 1);
  };
}

/**
 * Subscribe to User Profiles
 */
export function subscribeToUsers(callback: (users: UserProfile[]) => void) {
  userListeners.push(callback);
  callback([...cachedUsers]);

  if (isSupabaseConfigured) {
    supabase
      .from('users')
      .select('*')
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          cachedUsers = data as UserProfile[];
          notifyUsers();
        }
      });

    const channel = supabase
      .channel('public:users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        supabase
          .from('users')
          .select('*')
          .then(({ data }) => {
            if (data) {
              cachedUsers = data as UserProfile[];
              notifyUsers();
            }
          });
      })
      .subscribe();

    return () => {
      const idx = userListeners.indexOf(callback);
      if (idx !== -1) userListeners.splice(idx, 1);
      supabase.removeChannel(channel);
    };
  }

  return () => {
    const idx = userListeners.indexOf(callback);
    if (idx !== -1) userListeners.splice(idx, 1);
  };
}

/**
 * Add or update a certificate submission in Supabase
 */
export async function saveSubmissionToDb(
  submission: CertificateSubmission
): Promise<void> {
  const existingIdx = cachedSubmissions.findIndex((s) => s.id === submission.id);
  if (existingIdx !== -1) {
    cachedSubmissions[existingIdx] = submission;
  } else {
    cachedSubmissions.unshift(submission);
  }
  notifySubmissions();

  if (isSupabaseConfigured) {
    const { error } = await supabase.from('submissions').upsert(submission);
    if (error) {
      console.error('Supabase saveSubmissionToDb error:', error.message);
    }
  }
}

/**
 * Update fields on a submission
 */
export async function updateSubmissionInDb(
  id: string,
  updateFields: Partial<CertificateSubmission>
): Promise<void> {
  const existingIdx = cachedSubmissions.findIndex((s) => s.id === id);
  if (existingIdx !== -1) {
    cachedSubmissions[existingIdx] = {
      ...cachedSubmissions[existingIdx],
      ...updateFields,
      updatedAt: new Date().toISOString(),
    };
    notifySubmissions();
  }

  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('submissions')
      .update({
        ...updateFields,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Supabase updateSubmissionInDb error:', error.message);
    }
  }
}

/**
 * Add a new whitelisted admin
 */
export async function addAdminToDb(admin: AdminUser): Promise<void> {
  const idx = cachedAdmins.findIndex((a) => a.id === admin.id);
  if (idx !== -1) {
    cachedAdmins[idx] = admin;
  } else {
    cachedAdmins.push(admin);
  }
  notifyAdmins();

  if (isSupabaseConfigured) {
    const { error } = await supabase.from('admins').upsert(admin);
    if (error) {
      console.error('Supabase addAdminToDb error:', error.message);
    }
  }
}

/**
 * Remove a whitelisted admin
 */
export async function removeAdminFromDb(id: string): Promise<void> {
  cachedAdmins = cachedAdmins.filter((a) => a.id !== id);
  notifyAdmins();

  if (isSupabaseConfigured) {
    const { error } = await supabase.from('admins').delete().eq('id', id);
    if (error) {
      console.error('Supabase removeAdminFromDb error:', error.message);
    }
  }
}

/**
 * Create or update a user profile
 */
export async function saveUserProfileToDb(profile: UserProfile): Promise<void> {
  const idx = cachedUsers.findIndex((u) => u.id === profile.id);
  if (idx !== -1) {
    cachedUsers[idx] = profile;
  } else {
    cachedUsers.push(profile);
  }
  notifyUsers();

  if (isSupabaseConfigured) {
    const { error } = await supabase.from('users').upsert(profile);
    if (error) {
      console.error('Supabase saveUserProfileToDb error:', error.message);
    }
  }
}

/**
 * Fetch a user profile by email from Supabase DB or cache
 */
export async function getUserProfileByEmail(email: string): Promise<UserProfile | null> {
  const normalized = email.toLowerCase().trim();
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', normalized)
        .maybeSingle();

      if (!error && data) {
        return data as UserProfile;
      }
    } catch (err) {
      console.warn('Error fetching user profile from Supabase DB:', err);
    }
  }

  const found = cachedUsers.find((u) => u.email.toLowerCase() === normalized);
  return found || null;
}

/**
 * Approve a TGM or Super Admin account request (Super Admin action)
 */
export async function approveTgmUserInDb(
  userIdOrEmail: string,
  approvedBy: string = 'Super Admin'
): Promise<void> {
  // Update in Users cache
  const userIdx = cachedUsers.findIndex(
    (u) => u.id === userIdOrEmail || u.email.toLowerCase() === userIdOrEmail.toLowerCase()
  );
  if (userIdx !== -1) {
    cachedUsers[userIdx] = {
      ...cachedUsers[userIdx],
      tgmApprovalStatus: 'approved',
      approvedBy,
      approvedAt: new Date().toISOString(),
    };
    notifyUsers();
  }

  // Update or add in Admins whitelist cache
  const matchedUser = userIdx !== -1 ? cachedUsers[userIdx] : null;
  const adminIdx = cachedAdmins.findIndex(
    (a) => a.id === userIdOrEmail || a.email.toLowerCase() === userIdOrEmail.toLowerCase()
  );

  const designation = matchedUser?.role === 'superadmin'
    ? 'Principal & Super Admin'
    : 'Teacher Guardian Mentor (TGM)';

  if (adminIdx !== -1) {
    cachedAdmins[adminIdx] = {
      ...cachedAdmins[adminIdx],
      designation: designation,
      isWhitelisted: true,
      approvalStatus: 'approved',
    };
    notifyAdmins();
  } else if (matchedUser) {
    const newAdmin: AdminUser = {
      id: matchedUser.id,
      email: matchedUser.email,
      name: matchedUser.name,
      designation: designation,
      department: matchedUser.department || 'Institutional Head Office',
      addedBy: approvedBy,
      addedAt: new Date().toISOString().split('T')[0],
      isWhitelisted: true,
      approvalStatus: 'approved',
    };
    cachedAdmins.push(newAdmin);
    notifyAdmins();
  }

  if (isSupabaseConfigured) {
    if (matchedUser) {
      await supabase.from('users').update({ tgmApprovalStatus: 'approved' }).eq('id', matchedUser.id);
    }
    if (adminIdx !== -1) {
      await supabase.from('admins').update({ isWhitelisted: true, approvalStatus: 'approved' }).eq('id', cachedAdmins[adminIdx].id);
    }
  }

  // Dispatch TGM Approval Email via Resend Queue
  const tgmEmail = matchedUser?.email || (adminIdx !== -1 ? cachedAdmins[adminIdx].email : userIdOrEmail);
  const tgmName = matchedUser?.name || (adminIdx !== -1 ? cachedAdmins[adminIdx].name : 'Faculty Member');
  sendTgmApprovalNotification({
    tgmEmail,
    tgmName,
    status: 'approved',
    approvedBy,
  }).catch((e) => console.warn('TGM approval email send notice:', e));
}

/**
 * Reject a TGM account request (Super Admin action)
 */
export async function rejectTgmUserInDb(userIdOrEmail: string): Promise<void> {
  const userIdx = cachedUsers.findIndex(
    (u) => u.id === userIdOrEmail || u.email.toLowerCase() === userIdOrEmail.toLowerCase()
  );
  if (userIdx !== -1) {
    cachedUsers[userIdx] = {
      ...cachedUsers[userIdx],
      tgmApprovalStatus: 'rejected',
    };
    notifyUsers();
  }

  const adminIdx = cachedAdmins.findIndex(
    (a) => a.id === userIdOrEmail || a.email.toLowerCase() === userIdOrEmail.toLowerCase()
  );
  if (adminIdx !== -1) {
    cachedAdmins[adminIdx] = {
      ...cachedAdmins[adminIdx],
      isWhitelisted: false,
      approvalStatus: 'rejected',
    };
    notifyAdmins();
  }

  if (isSupabaseConfigured) {
    if (userIdx !== -1) {
      await supabase.from('users').update({ tgmApprovalStatus: 'rejected' }).eq('id', cachedUsers[userIdx].id);
    }
    if (adminIdx !== -1) {
      await supabase.from('admins').update({ isWhitelisted: false, approvalStatus: 'rejected' }).eq('id', cachedAdmins[adminIdx].id);
    }
  }

  // Dispatch TGM Rejection Email via Resend Queue
  const matchedUser = userIdx !== -1 ? cachedUsers[userIdx] : null;
  const tgmEmail = matchedUser?.email || (adminIdx !== -1 ? cachedAdmins[adminIdx].email : userIdOrEmail);
  const tgmName = matchedUser?.name || (adminIdx !== -1 ? cachedAdmins[adminIdx].name : 'Faculty Member');
  sendTgmApprovalNotification({
    tgmEmail,
    tgmName,
    status: 'rejected',
    approvedBy: 'Super Admin Office',
  }).catch((e) => console.warn('TGM rejection email send notice:', e));
}
