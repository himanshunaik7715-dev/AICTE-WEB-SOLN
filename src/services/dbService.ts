import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { apiUrl } from '../lib/api';
import {
  CertificateSubmission,
  AdminUser,
  UserProfile,
} from '../types';
// Session-scoped caches. Sensitive records are deliberately not persisted in
// browser storage and production data is never populated from frontend fixtures.
let cachedSubmissions: CertificateSubmission[] = [];
let cachedUsers: UserProfile[] = [];
let cachedAdmins: AdminUser[] = [];


// Listeners
const submissionListeners: Array<(subs: CertificateSubmission[]) => void> = [];
const userListeners: Array<(users: UserProfile[]) => void> = [];
const adminListeners: Array<(admins: AdminUser[]) => void> = [];

function notifySubmissions() {
  submissionListeners.forEach((fn) => fn([...cachedSubmissions]));
}

function notifyUsers() {
  userListeners.forEach((fn) => fn([...cachedUsers]));
}

function notifyAdmins() {
  adminListeners.forEach((fn) => fn([...cachedAdmins]));
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
export function subscribeToAdmins(
  role: string | null,
  callback: (admins: AdminUser[]) => void
) {
  adminListeners.push(callback);
  callback([...cachedAdmins]);

  if (isSupabaseConfigured) {
    // The production database intentionally denies the anon role access to the
    // faculty whitelist. Do not issue this query until session restoration has
    // resolved an authenticated application role.
    if (role === 'auth' || !role) {
      return () => {
        const idx = adminListeners.indexOf(callback);
        if (idx !== -1) adminListeners.splice(idx, 1);
      };
    }

    supabase
      .from('admins')
      .select('*')
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          cachedAdmins = data as AdminUser[];
          notifyAdmins();
        } else if (error) {
          console.warn('Supabase admins select error:', error.message);
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
    const { error } = await supabase.from('users').upsert(profile);
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

  if (isSupabaseConfigured) {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error('Authentication required. Please sign in again.');

    const response = await fetch(apiUrl('/api/superadmin/approve-request'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userIdOrEmail, approvedBy }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(result?.error || 'Failed to approve the TGM request.');
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('superadmin-dashboard-refresh'));
    }
    return;
  }

  // Search in cachedUsers by id or email
  let userIdx = cachedUsers.findIndex(
    (u) => u.id === userIdOrEmail || u.email.trim().toLowerCase() === normKey
  );

  // Fallback search via the database.
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

}

/**
 * Clear memory caches when a user logs out to prevent data leakage across sessions
 */
export function clearDbCaches(): void {
  cachedSubmissions = [];
  cachedUsers = [];
  cachedAdmins = [];
  
  notifySubmissions();
  notifyUsers();
  notifyAdmins();
}

