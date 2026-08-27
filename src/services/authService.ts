import { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile, AdminUser } from '../types';
import { saveUserProfileToDb, addAdminToDb, getUserProfileByEmail, clearDbCaches } from './dbService';
import { parseStudentUID } from '../utils/parseStudentUID';
import { isStudentProfileComplete } from '../utils/studentProfile';
import { apiUrl } from '../lib/api';

export interface AuthState {
  supabaseUser: User | null;
  activeProfile: UserProfile | null;
  loading: boolean;
}

export type GoogleLoginResult = 
  | { profileNeeded: false; profile: UserProfile }
  | { profileNeeded: true; email: string; name: string; existingProfile?: UserProfile };

const ALLOWED_EMAIL_DOMAIN = '@tcetmumbai.in';

/**
 * Sign in using Google OAuth directly via @react-oauth/google (bypassing Supabase GoTrue)
 */
export async function loginWithGoogle(credential: string): Promise<GoogleLoginResult> {
  if (!isSupabaseConfigured) {
    throw new Error('Authentication is not configured. Add the Supabase environment variables.');
  }
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: credential,
  });
  if (error || !data.user?.email) {
    if (error?.message?.toLowerCase().includes('provider') && error.message.toLowerCase().includes('not enabled')) {
      throw new Error('Google sign-in is not enabled in Supabase. Ask the administrator to enable the Google provider.');
    }
    throw new Error(error?.message || 'Google authentication failed.');
  }

  const email = data.user.email.trim().toLowerCase();
  
  if (!email.endsWith(ALLOWED_EMAIL_DOMAIN)) {
    await supabase.auth.signOut();
    throw new Error('Access denied: only @tcetmumbai.in Google Workspace accounts are allowed.');
  }
  const existing = await getUserProfileByEmail(email);

  if (existing) {
    if (existing.role === 'student' && !isStudentProfileComplete(existing)) {
      return {
        profileNeeded: true,
        email: existing.email,
        name: existing.name,
        existingProfile: existing,
      };
    }
    return { profileNeeded: false, profile: existing };
  }

  const accessToken = data.session?.access_token;
  if (accessToken) {
    const response = await fetch(apiUrl('/api/auth/bootstrap-profile'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (response.ok) {
      const bootstrap = await response.json();
      if (bootstrap?.profile) {
        return { profileNeeded: false, profile: bootstrap.profile as UserProfile };
      }
    }
  }

  // If no existing profile, return a signal that onboarding is needed
  return { 
    profileNeeded: true, 
    email: email, 
    name: String(data.user.user_metadata?.full_name || data.user.user_metadata?.name || email.split('@')[0])
  };
}

/**
 * Complete or update a student profile after onboarding.
 * Saves to DB, re-fetches, and returns the persisted profile.
 */
export async function completeStudentProfile(
  email: string,
  name: string,
  data: {
    studentUid: string;
    erpNo: string;
    phoneNumber: string;
    course?: string;
    department?: string;
    division?: string;
    rollNo?: string | number;
  },
  existingProfile?: UserProfile
): Promise<UserProfile> {
  const parsed = parseStudentUID(data.studentUid);
  if (!parsed) {
    throw new Error('Invalid Student UID format. Example: 25-CSE(IOT)B01-29');
  }

  const profile: UserProfile = {
    ...(existingProfile || {}),
    id: existingProfile?.id || (await supabase.auth.getUser()).data.user?.id || '',
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role: 'student',
    studentUid: parsed.uid,
    phoneNumber: data.phoneNumber.trim(),
    course: data.course || parsed.rawCourse,
    rollNo: String(data.rollNo ?? parsed.rollNumber),
    erpNo: data.erpNo.trim(),
    department: data.department || parsed.department,
    division: data.division || parsed.division,
    academicBatch: parsed.academicBatch,
    tgmApprovalStatus: 'approved',
    crName: existingProfile?.crName,
    tgmName: existingProfile?.tgmName,
    driveRootFolderId: existingProfile?.driveRootFolderId,
  };

  await saveUserProfileToDb(profile, { throwOnError: true });

  const saved = await getUserProfileByEmail(profile.email);
  if (!saved) {
    throw new Error('Failed to save profile. Please try again.');
  }
  if (!isStudentProfileComplete(saved)) {
    throw new Error('Profile was saved but is still incomplete. Please try again.');
  }

  return saved;
}

/**
 * Complete the onboarding step for a new Google user
 */
export async function completeGoogleSignUp(
  email: string,
  name: string,
  profileData: Omit<UserProfile, 'id' | 'email' | 'name' | 'tgmApprovalStatus'>
): Promise<UserProfile> {
  if (!email.toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN)) {
    throw new Error('Access denied: only @tcetmumbai.in accounts are allowed.');
  }
  const role = profileData.role;

  const requiresApproval = role === 'admin' || role === 'cr' || role === 'superadmin';
  
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user || authData.user.email?.toLowerCase() !== email.toLowerCase()) {
    throw new Error('Your authenticated session could not be verified. Please sign in again.');
  }
  const uid = authData.user.id;

  const newProfile: UserProfile = {
    ...profileData,
    id: uid,
    name,
    email,
    role,
    tgmApprovalStatus: requiresApproval ? 'pending' : 'approved',
    customRole: profileData.customRole || undefined,
    crName: profileData.crName,
    tgmName: profileData.tgmName,
  };

  await saveUserProfileToDb(newProfile);

  // If user signed up as TGM (admin), CR, or Super Admin, register pending request in Admin whitelist decision queue
  if (requiresApproval) {
    // Build a descriptive designation: use customRole if provided (for CRs)
    const designation =
      role === 'superadmin'
        ? 'Super Admin (Applicant)'
        : role === 'cr'
        ? profileData.customRole
          ? `${profileData.customRole} (CR / Club Head)`
          : 'Class Representative (CR)'
        : 'Teacher Guardian Mentor (TGM)';

    const newAdmin: AdminUser = {
      id: uid,
      email,
      name,
      designation,
      department: profileData.department || 'Internet of Things (IoT)',
      addedBy: role === 'superadmin' ? 'Super Admin Sign-Up Request' : 'Google Auth Sign-Up',
      addedAt: new Date().toISOString().split('T')[0],
      isWhitelisted: false,
      approvalStatus: 'pending',
    };
    await addAdminToDb(newAdmin);
  }

  return newProfile;
}


/**
 * Perform sign out from Supabase Auth
 */
export async function logoutUser(): Promise<void> {
  if (isSupabaseConfigured) {
    await supabase.auth.signOut();
  }
  clearDbCaches();
}

/**
 * Manual credential login for CR / Club Head accounts
 */
export async function loginWithManualCredentials(
  emailInput: string,
  passwordInput: string,
  allowedRole: 'cr' | 'superadmin',
  allUsers: UserProfile[] = []
): Promise<UserProfile> {
  const email = emailInput.trim().toLowerCase();
  const password = passwordInput;

  if (!email || !password) {
    throw new Error('Please enter both email and password.');
  }

  if (!isSupabaseConfigured) {
    throw new Error('Authentication is not configured. Add the Supabase environment variables.');
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    throw new Error('Invalid email or password.');
  }
  const matchedUser = allUsers.find((u) => u.id === data.user.id) || await getUserProfileByEmail(email);
  if (!matchedUser || matchedUser.id !== data.user.id) {
    await supabase.auth.signOut();
    throw new Error('No application profile is linked to this account.');
  }

  if (matchedUser.role !== allowedRole) {
    await supabase.auth.signOut();
    throw new Error(
      allowedRole === 'cr'
        ? 'Password sign-in is restricted to CR / Club Head accounts. TGMs must use their institutional Google account.'
        : 'This account does not have Super Admin access.'
    );
  }

  // Approval status check
  if (matchedUser.tgmApprovalStatus === 'pending') {
    throw new Error(
      'Your CR / Club Head account request is currently on the waitlist pending Superadmin approval. Access will be granted once approved.'
    );
  }

  if (matchedUser.tgmApprovalStatus === 'rejected') {
    throw new Error(
      'Your account request was rejected by the Superadmin. Please contact the administration.'
    );
  }

  return matchedUser;
}

/**
 * Register a new Club Head account requiring Superadmin approval
 */
export async function registerClubHeadAccount(params: {
  clubName: string;
  email: string;
  password: string;
  department?: string;
  erpNo?: string;
  rollNo?: string;
}): Promise<UserProfile> {
  const { clubName, email, password, department, erpNo, rollNo } = params;

  if (!clubName || !clubName.trim()) {
    throw new Error('Please enter your Club Name.');
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail.endsWith('@tcetmumbai.in')) {
    throw new Error('Email must end with @tcetmumbai.in');
  }

  if (!password || password.length < 4) {
    throw new Error('Password must be at least 4 characters long.');
  }

  // Check existing user
  const existing = await getUserProfileByEmail(cleanEmail);
  if (existing) {
    throw new Error('An account with this email address already exists.');
  }

  if (!isSupabaseConfigured) {
    throw new Error('Authentication is not configured. Add the Supabase environment variables.');
  }
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
  });
  if (authError || !authData.user) {
    throw new Error(authError?.message || 'Unable to create the account.');
  }
  if (!authData.session) {
    throw new Error('Check your email to confirm the account, then sign in to finish registration.');
  }
  const uid = authData.user.id;
  const formattedClubTitle = clubName.trim().endsWith('Head') || clubName.trim().endsWith('Leader')
    ? clubName.trim()
    : `${clubName.trim()} Head`;

  const newProfile: UserProfile = {
    id: uid,
    name: formattedClubTitle,
    email: cleanEmail,
    role: 'cr',
    customRole: formattedClubTitle,
    rollNo: rollNo?.trim() || 'CH-01',
    erpNo: erpNo?.trim() || `ERP-${Date.now().toString().slice(-6)}`,
    department: department || 'Internet of Things (IoT)',
    division: 'All Divisions',
    academicBatch: '2023-2027',
    tgmApprovalStatus: 'pending',
    crName: formattedClubTitle,
  };

  await saveUserProfileToDb(newProfile);

  // Send request to Superadmin approval queue (admins table)
  const newAdmin: AdminUser = {
    id: uid,
    email: cleanEmail,
    name: formattedClubTitle,
    designation: `${clubName.trim()} (Club Head)`,
    department: department || 'Internet of Things (IoT)',
    addedBy: 'Club Head Registration Request',
    addedAt: new Date().toISOString().split('T')[0],
    isWhitelisted: false,
    approvalStatus: 'pending',
  };
  await addAdminToDb(newAdmin);

  return newProfile;
}

