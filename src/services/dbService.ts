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
  CR_A1,
  CR_A2,
  CR_B1,
  CR_B2,
  CR_2024_1,
  CR_2024_2,
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
    driveRootFolderId: 'drive_folder_amit_patel_2023',
  },
  // CR Accounts — Division A
  CR_A1,
  CR_A2,
  // CR Accounts — Division B
  CR_B1,
  CR_B2,
  CR_2024_1,
  CR_2024_2,
  // Legacy CR account (Division A)
  {
    id: 'CR-TCET-2026',
    name: 'Class Representative (CR)',
    email: 'cr@tcetmumbai.in',
    password: '2026@tcetiotcr',
    role: 'cr',
    rollNo: '7',
    erpNo: '2023011100',
    department: 'Internet of Things (IoT)',
    division: 'A',
    academicBatch: '2023-2027',
    crName: 'Class Representative (CR)',
    tgmApprovalStatus: 'approved',
    driveRootFolderId: 'drive_folder_cr_tcet',
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

function loadUsersFromLocalStorage(): UserProfile[] {
  const users = loadFromLocalStorage<UserProfile[]>(LS_USERS_KEY, SEEDED_PROFILES);
  // Ensure all seeded CR accounts exist in the local cache
  for (const seeded of SEEDED_PROFILES) {
    if (seeded.role === 'cr' && !users.some((u) => u.id === seeded.id)) {
      users.push(seeded);
    }
  }
  return users;
}

// In-Memory state caches
let cachedSubmissions: CertificateSubmission[] = loadFromLocalStorage(LS_SUBMISSIONS_KEY, INITIAL_SUBMISSIONS);
let cachedUsers: UserProfile[] = loadUsersFromLocalStorage();
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
      const usersToSeed = cachedUsers.map(({ password, ...user }) => user as any);
      const { error } = await supabase.from('users').upsert(usersToSeed);
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
  role: string | null,
  userId: string | null,
  callback: (submissions: CertificateSubmission[]) => void
) {
  submissionListeners.push(callback);
  callback([...cachedSubmissions]);

  if (isSupabaseConfigured) {
    // Early-exit when unauthenticated — still return a valid cleanup fn
    if (role === 'auth' || !role) {
      return () => {
        const idx = submissionListeners.indexOf(callback);
        if (idx !== -1) submissionListeners.splice(idx, 1);
      };
    }

    let query = supabase.from('submissions').select('*');
    if (role === 'student' && userId) {
      query = query.eq('studentId', userId);
    }
    
    query
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

    // Use a unique channel name to avoid re-subscription collisions
    const channelName = `submissions:${role}:${userId ?? 'all'}:${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => {
        if (role === 'auth' || !role) return;

        let rtQuery = supabase.from('submissions').select('*');
        if (role === 'student' && userId) {
          rtQuery = rtQuery.eq('studentId', userId);
        }
        rtQuery
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

    const adminChannelName = `admins:${Date.now()}`;
    const channel = supabase
      .channel(adminChannelName)
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
export function subscribeToUsers(
  role: string | null,
  userId: string | null,
  callback: (users: UserProfile[]) => void
) {
  userListeners.push(callback);
  callback([...cachedUsers]);

  if (isSupabaseConfigured) {
    // Early-exit when unauthenticated — still return a valid cleanup fn
    if (role === 'auth' || !role) {
      return () => {
        const idx = userListeners.indexOf(callback);
        if (idx !== -1) userListeners.splice(idx, 1);
      };
    }

    let query = supabase.from('users').select('*');
    if (role === 'student' && userId) {
      query = query.or(`id.eq.${userId},role.eq.cr,role.eq.admin,role.eq.superadmin`);
    }

    query
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          cachedUsers = data as UserProfile[];
          notifyUsers();
        }
      });

    const usersChannelName = `users:${role}:${userId ?? 'all'}:${Date.now()}`;
    const channel = supabase
      .channel(usersChannelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        if (role === 'auth' || !role) return;

        let rtQuery = supabase.from('users').select('*');
        if (role === 'student' && userId) {
          rtQuery = rtQuery.or(`id.eq.${userId},role.eq.cr,role.eq.admin,role.eq.superadmin`);
        }
        
        rtQuery
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
  if (isSupabaseConfigured) {
    const { assignedCrName, assignedTgmName, fileDataUrl, ...dbSubmission } = submission;
    const { error } = await supabase.from('submissions').upsert(dbSubmission);
    if (error) {
      console.error('Supabase saveSubmissionToDb error:', error.message);
      throw new Error(`Failed to save submission: ${error.message}`);
    }
  }

  const existingIdx = cachedSubmissions.findIndex((s) => s.id === submission.id);
  if (existingIdx !== -1) {
    cachedSubmissions[existingIdx] = submission;
  } else {
    cachedSubmissions.unshift(submission);
  }
  notifySubmissions();
}

/**
 * Update fields on a submission
 */
export async function updateSubmissionInDb(
  id: string,
  updateFields: Partial<CertificateSubmission>
): Promise<void> {
  const updatedData = { ...updateFields, updatedAt: new Date().toISOString() };

  if (isSupabaseConfigured) {
    const { assignedCrName, assignedTgmName, fileDataUrl, ...dbUpdateFields } = updatedData;
    const { error } = await supabase
      .from('submissions')
      .update(dbUpdateFields)
      .eq('id', id);

    if (error) {
      console.error('Supabase updateSubmissionInDb error:', error.message);
      throw new Error(`Failed to update submission: ${error.message}`);
    }
  }

  const existingIdx = cachedSubmissions.findIndex((s) => s.id === id);
  if (existingIdx !== -1) {
    cachedSubmissions[existingIdx] = {
      ...cachedSubmissions[existingIdx],
      ...updatedData,
    };
    notifySubmissions();
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
export async function saveUserProfileToDb(
  profile: UserProfile,
  options?: { throwOnError?: boolean }
): Promise<void> {
  const idx = cachedUsers.findIndex((u) => u.id === profile.id);
  if (idx !== -1) {
    cachedUsers[idx] = profile;
  } else {
    cachedUsers.push(profile);
  }
  notifyUsers();

  if (isSupabaseConfigured) {
    // Strip fields that don't exist in the Supabase `users` table schema
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _pw, ...dbProfile } = profile as UserProfile & { password?: string };
    const { error } = await supabase.from('users').upsert(dbProfile);
    if (error) {
      console.error('Supabase saveUserProfileToDb error:', error.message);
      if (options?.throwOnError) {
        throw new Error(error.message || 'Failed to save profile to database.');
      }
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
 * Approve a TGM, CR, Club Head, or Super Admin account request (Super Admin action)
 */
export async function approveTgmUserInDb(
  userIdOrEmail: string,
  approvedBy: string = 'Super Admin'
): Promise<void> {
  const normKey = userIdOrEmail.trim().toLowerCase();

  // Search in cachedUsers by id or email
  let userIdx = cachedUsers.findIndex(
    (u) => u.id === userIdOrEmail || u.email.trim().toLowerCase() === normKey
  );

  // Fallback search via DB or localStorage
  if (userIdx === -1) {
    const dbProfile = await getUserProfileByEmail(normKey);
    if (dbProfile) {
      const existingIdx = cachedUsers.findIndex((u) => u.id === dbProfile.id);
      if (existingIdx !== -1) {
        userIdx = existingIdx;
      } else {
        cachedUsers.push(dbProfile);
        userIdx = cachedUsers.length - 1;
      }
    }
  }

  // Also check in cachedAdmins whitelist
  const adminIdx = cachedAdmins.findIndex(
    (a) => a.id === userIdOrEmail || a.email.trim().toLowerCase() === normKey
  );
  const matchedAdmin = adminIdx !== -1 ? cachedAdmins[adminIdx] : null;

  // If user profile found in cachedUsers, update status
  let matchedUser: UserProfile | null = null;
  if (userIdx !== -1) {
    cachedUsers[userIdx] = {
      ...cachedUsers[userIdx],
      tgmApprovalStatus: 'approved',
      approvedBy,
      approvedAt: new Date().toISOString(),
    };
    matchedUser = cachedUsers[userIdx];
    notifyUsers();
  } else if (matchedAdmin) {
    // If user profile wasn't in cachedUsers, construct it from matchedAdmin so it exists and can log in!
    const newlyCreatedUser: UserProfile = {
      id: matchedAdmin.id,
      name: matchedAdmin.name,
      email: matchedAdmin.email.trim().toLowerCase(),
      role: matchedAdmin.designation.includes('TGM') ? 'admin' : 'cr',
      customRole: matchedAdmin.designation.replace(' (Club Head)', '').replace(' (CR / Club Head)', ''),
      rollNo: 'CH-01',
      erpNo: `ERP-${Date.now().toString().slice(-6)}`,
      department: matchedAdmin.department || 'Internet of Things (IoT)',
      division: 'All Divisions',
      academicBatch: '2023-2027',
      tgmApprovalStatus: 'approved',
      approvedBy,
      approvedAt: new Date().toISOString(),
    };
    cachedUsers.push(newlyCreatedUser);
    matchedUser = newlyCreatedUser;
    notifyUsers();
    await saveUserProfileToDb(newlyCreatedUser);
  }

  const designation = matchedUser?.role === 'superadmin'
    ? 'Principal & Super Admin'
    : matchedUser?.customRole
    ? `${matchedUser.customRole} (Club Head)`
    : matchedUser?.role === 'cr'
    ? 'Class Representative (CR)'
    : 'Teacher Guardian Mentor (TGM)';

  if (adminIdx !== -1) {
    cachedAdmins[adminIdx] = {
      ...cachedAdmins[adminIdx],
      designation: designation,
      isWhitelisted: true,
      approvalStatus: 'approved',
    };
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

  // Dispatch Approval Email via Resend Queue
  const tgmEmail = matchedUser?.email || (matchedAdmin ? matchedAdmin.email : userIdOrEmail);
  const tgmName = matchedUser?.name || (matchedAdmin ? matchedAdmin.name : 'Faculty / Club Member');
  sendTgmApprovalNotification({
    tgmEmail,
    tgmName,
    status: 'approved',
    approvedBy,
  }).catch((e) => console.warn('Approval email send notice:', e));
}

/**
 * Reject an account request (Super Admin action)
 */
export async function rejectTgmUserInDb(userIdOrEmail: string): Promise<void> {
  const normKey = userIdOrEmail.trim().toLowerCase();

  const userIdx = cachedUsers.findIndex(
    (u) => u.id === userIdOrEmail || u.email.trim().toLowerCase() === normKey
  );
  if (userIdx !== -1) {
    cachedUsers[userIdx] = {
      ...cachedUsers[userIdx],
      tgmApprovalStatus: 'rejected',
    };
    notifyUsers();
  }

  const adminIdx = cachedAdmins.findIndex(
    (a) => a.id === userIdOrEmail || a.email.trim().toLowerCase() === normKey
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

  const matchedUser = userIdx !== -1 ? cachedUsers[userIdx] : null;
  const tgmEmail = matchedUser?.email || (adminIdx !== -1 ? cachedAdmins[adminIdx].email : userIdOrEmail);
  const tgmName = matchedUser?.name || (adminIdx !== -1 ? cachedAdmins[adminIdx].name : 'Faculty / Club Member');
  sendTgmApprovalNotification({
    tgmEmail,
    tgmName,
    status: 'rejected',
    approvedBy: 'Super Admin Office',
  }).catch((e) => console.warn('Rejection email send notice:', e));
}

/**
 * Clear memory caches when a user logs out to prevent data leakage across sessions
 */
export function clearDbCaches(): void {
  cachedSubmissions = INITIAL_SUBMISSIONS;
  cachedUsers = loadUsersFromLocalStorage();
  cachedAdmins = INITIAL_ADMINS;
  
  notifySubmissions();
  notifyUsers();
  notifyAdmins();
}

