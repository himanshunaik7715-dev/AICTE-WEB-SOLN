import { supabase, isSupabaseConfigured } from '../lib/supabase';

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

function subscribeRows<T>(table: string, enabled: boolean, load: () => Promise<T[]>, callback: (rows: T[]) => void, listeners: Array<(rows: T[]) => void>, publish: (rows: T[]) => void) {
  let closed = false, running = false, queued = false;
  listeners.push(callback); callback([]);
  async function refresh() {
    if (closed || !enabled) return;
    if (running) { queued = true; return; }
    running = true;
    const started = performance.now();
    try { const rows = await load(); if (!closed) publish(rows); }
    catch { if (!closed) window.dispatchEvent(new CustomEvent('portal-data-error', { detail: `Unable to load ${table}. Please refresh to retry.` })); }
    finally { running = false; if (import.meta.env.DEV) console.debug(`[dashboard] ${table}: ${Math.round(performance.now()-started)}ms`); if (queued && !closed) { queued = false; void refresh(); } }
  }
  void refresh();
  const scopeRefresh = () => { if (enabled && !closed) { publish([]); void refresh(); } };
  window.addEventListener('portal-scope-changed', scopeRefresh);
  const channel = enabled ? supabase.channel(`${table}:${crypto.randomUUID()}`).on('postgres_changes', { event: '*', schema: 'public', table }, () => void refresh()).subscribe() : null;
  return () => { closed = true; window.removeEventListener('portal-scope-changed',scopeRefresh); const index = listeners.indexOf(callback); if (index >= 0) listeners.splice(index,1); if (channel) void supabase.removeChannel(channel); };
}
export function subscribeToSubmissions(role: string | null, userId: string | null, callback: (rows: CertificateSubmission[]) => void) {
  return subscribeRows('submissions', Boolean(isSupabaseConfigured && userId && role && role !== 'auth'), async () => {
    const { getSubmissionsForScope } = await import('./scopeService');
    return getSubmissionsForScope();
  }, callback, submissionListeners, rows => { cachedSubmissions=rows; notifySubmissions(); });
}
export function subscribeToAdmins(role: string | null, callback: (rows: AdminUser[]) => void) {
  return subscribeRows('admins', isSupabaseConfigured && role === 'superadmin', async () => {
    const { data,error }=await supabase.from('admins').select('*'); if(error) throw error; return data as AdminUser[];
  }, callback, adminListeners, rows => { cachedAdmins=rows; notifyAdmins(); });
}
export function subscribeToUsers(role: string | null, userId: string | null, callback: (rows: UserProfile[]) => void) {
  return subscribeRows('users', Boolean(isSupabaseConfigured && userId && role && role !== 'auth'), async () => {
    let query=supabase.from('users').select('*');
    if(role==='student') query=query.eq('id',userId);
    const { data,error }=await query; if(error) throw error; return data as UserProfile[];
  }, callback, userListeners, rows => { cachedUsers=rows; notifyUsers(); });
}
/**
 * Add or update a certificate submission in Supabase
 */
export async function saveSubmissionToDb(
  submission: CertificateSubmission
): Promise<void> {
  if (isSupabaseConfigured) {
    const { assignedCrName, assignedTgmName, fileDataUrl, ...dbSubmission } = submission;
    const { data, error } = await supabase.from('submissions').upsert(dbSubmission).select('*').single();
    if (error) {
      console.error('Supabase saveSubmissionToDb error:', error.message);
      throw new Error(`Failed to save submission: ${error.message}`);
    }
    submission = data as CertificateSubmission;
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
  let updatedData: Partial<CertificateSubmission> = { ...updateFields, updatedAt: new Date().toISOString() };

  if (isSupabaseConfigured) {
    const { assignedCrName, assignedTgmName, fileDataUrl, ...dbUpdateFields } = updatedData;
    const { data, error } = await supabase
      .from('submissions')
      .update(dbUpdateFields)
      .eq('id', id).select('*').single();

    if (error) {
      console.error('Supabase updateSubmissionInDb error:', error.message);
      throw new Error(`Failed to update submission: ${error.message}`);
    }
    updatedData = data as CertificateSubmission;
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
  if (!isSupabaseConfigured) throw new Error('Database is not configured');
  const { error } = await supabase.from('admins').upsert(admin);
  if (error) throw new Error(error.message);
  const idx = cachedAdmins.findIndex((a) => a.id === admin.id);
  if (idx !== -1) {
    cachedAdmins[idx] = admin;
  } else {
    cachedAdmins.push(admin);
  }
  notifyAdmins();

}

/**
 * Remove a whitelisted admin
 */
export async function removeAdminFromDb(id: string): Promise<void> {
  await decideRegistration(id, false);
  cachedAdmins = cachedAdmins.filter((a) => a.id !== id);
  notifyAdmins();
}

/**
 * Create or update a user profile
 */
export async function saveUserProfileToDb(
  profile: UserProfile,
  options?: { throwOnError?: boolean }
): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Database is not configured');
  const { data: existing, error: lookupError } = await supabase.from('users').select('id').eq('id',profile.id).maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) {
    const patch = { name: profile.name, studentUid: profile.studentUid, erpNo: profile.erpNo, rollNo: profile.rollNo, phoneNumber: profile.phoneNumber, department: profile.department, course: profile.course, division: profile.division, academicBatch: profile.academicBatch };
    const { data, error } = await supabase.rpc('complete_missing_student_fields', { patch });
    if (error) throw new Error(error.message);
    cachedUsers = [...cachedUsers.filter(u => u.id !== data.id), data]; notifyUsers(); return;
  }
  const { data, error } = await supabase.from('users').insert(profile).select('*').single();
  if (error) throw new Error(error.message);
  cachedUsers = [...cachedUsers.filter(u => u.id !== data.id), data]; notifyUsers();
}
/**
 * Fetch a user profile by email from Supabase DB or cache
 */
export async function getUserProfileByEmail(email: string): Promise<UserProfile | null> {
  const { data, error } = await supabase.from('users').select('*').eq('email',email.trim().toLowerCase()).maybeSingle();
  if (error) throw new Error(error.message);
  return data as UserProfile | null;
}
/**
 * Approve a TGM, CR, Club Head, or Super Admin account request (Super Admin action)
 */
async function decideRegistration(userIdOrEmail: string, approve: boolean): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('Database is not configured');
  const { error } = await supabase.rpc('decide_registration', { target: userIdOrEmail.trim(), approve });
  if (error) throw new Error(error.message);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('superadmin-dashboard-refresh'));
}
export async function approveTgmUserInDb(userIdOrEmail: string, _approvedBy: string = 'Super Admin'): Promise<void> {
  await decideRegistration(userIdOrEmail, true);
}
export async function rejectTgmUserInDb(userIdOrEmail: string): Promise<void> {
  await decideRegistration(userIdOrEmail, false);
}
export function clearDbCaches(): void {
  cachedSubmissions = [];
  cachedUsers = [];
  cachedAdmins = [];

  notifySubmissions();
  notifyUsers();
  notifyAdmins();
}
