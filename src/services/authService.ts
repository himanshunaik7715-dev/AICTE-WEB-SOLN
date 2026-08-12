import { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile, AdminUser } from '../types';
import { SEEDED_PROFILES, saveUserProfileToDb, addAdminToDb, getUserProfileByEmail } from './dbService';
import { sendWelcomeEmail } from './emailClient';
import { jwtDecode } from 'jwt-decode';

export interface AuthState {
  supabaseUser: User | null;
  activeProfile: UserProfile | null;
  loading: boolean;
}

export type GoogleLoginResult = 
  | { profileNeeded: false; profile: UserProfile }
  | { profileNeeded: true; email: string; name: string };

/**
 * Check if a registered account exists in Supabase Auth (auth.users)
 */
export async function checkUserExistsInAuth(email: string): Promise<boolean> {
  if (!email || !email.trim()) return false;
  try {
    const res = await fetch('/api/check-user-exists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    if (!res.ok) {
      return false;
    }
    const data = await res.json();
    return Boolean(data.exists);
  } catch (err) {
    console.warn('Error calling /api/check-user-exists:', err);
    return false;
  }
}

/**
 * Sign in using Google OAuth directly via @react-oauth/google (bypassing Supabase GoTrue)
 */
export async function loginWithGoogle(credential: string): Promise<GoogleLoginResult> {
  const decoded: any = jwtDecode(credential);
  
  if (!decoded || !decoded.email) {
    throw new Error('Invalid Google credential token received.');
  }

  const email = decoded.email.trim().toLowerCase();
  
  if (!email.endsWith('@tcetmumbai.in') && email !== 'superadmin') {
    throw new Error('Access Denied: Only @tcetmumbai.in email addresses are allowed.');
  }
  const existing = await getUserProfileByEmail(email) || SEEDED_PROFILES.find((p) => p.email.toLowerCase() === email.toLowerCase());

  if (existing) {
    return { profileNeeded: false, profile: existing };
  }

  // If no existing profile, return a signal that onboarding is needed
  return { 
    profileNeeded: true, 
    email: email, 
    name: decoded.name || email.split('@')[0] 
  };
}

/**
 * Complete the onboarding step for a new Google user
 */
export async function completeGoogleSignUp(
  email: string,
  name: string,
  profileData: Omit<UserProfile, 'id' | 'email' | 'name' | 'tgmApprovalStatus'>
): Promise<UserProfile> {
  const isSeedSuper = email === 'superadmin@tcetmumbai.in' || email === 'superadmin';
  const isSuper = isSeedSuper || profileData.role === 'superadmin';
  const role = isSuper ? 'superadmin' : profileData.role;

  const requiresApproval = (role === 'admin' || role === 'cr') || (role === 'superadmin' && !isSeedSuper);
  
  const uid = 'STU-GOOGLE-' + Date.now();

  const newProfile: UserProfile = {
    ...profileData,
    id: uid,
    name,
    email,
    role,
    tgmApprovalStatus: requiresApproval ? 'pending' : 'approved',
    customRole: profileData.customRole || undefined,
    crName: profileData.crName || (role === 'student' ? `Ananya Verma (CR - Div ${profileData.division || 'A'})` : undefined),
    tgmName: profileData.tgmName || (role === 'student' ? 'Prof. S. K. Mehta (Senior TGM)' : undefined),
  };

  await saveUserProfileToDb(newProfile);

  // Send welcome email asynchronously via server queue
  sendWelcomeEmail({
    email,
    name,
    role,
  }).catch((err) => console.warn('Notice: Welcome email send background trigger:', err));

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
}

/**
 * Helper to match an email or ID to one of our seeded profiles
 */
export function getSeededProfileByEmailOrRole(
  emailOrRole: string
): UserProfile | undefined {
  const lower = emailOrRole.toLowerCase();
  return SEEDED_PROFILES.find(
    (p) =>
      p.email.toLowerCase() === lower ||
      p.role.toLowerCase() === lower ||
      p.id.toLowerCase() === lower
  );
}

/**
 * Manual credential login for CR / Club Head accounts
 */
export async function loginWithManualCredentials(
  emailInput: string,
  passwordInput: string,
  allUsers: UserProfile[] = []
): Promise<UserProfile> {
  const email = emailInput.trim().toLowerCase();
  const password = passwordInput;

  if (!email || !password) {
    throw new Error('Please enter both email and password.');
  }

  // Find profile in live state, DB, or SEEDED_PROFILES
  let matchedUser = allUsers.find((u) => u.email.toLowerCase() === email);
  if (!matchedUser) {
    matchedUser = (await getUserProfileByEmail(email)) || SEEDED_PROFILES.find((p) => p.email.toLowerCase() === email);
  }

  // Hardcoded fallback check for default CR credentials (cr@tcetmumbai.in / 2026@tcetiotcr)
  if (email === 'cr@tcetmumbai.in') {
    if (password !== '2026@tcetiotcr') {
      throw new Error('Invalid email or password.');
    }
    if (matchedUser) {
      return { ...matchedUser, password: '2026@tcetiotcr', tgmApprovalStatus: 'approved' };
    }
    return {
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
      tgmApprovalStatus: 'approved',
      crName: 'Class Representative (CR)',
      tgmName: 'Prof. S. K. Mehta (TGM)',
    };
  }

  if (!matchedUser) {
    throw new Error('Invalid email or password.');
  }

  // Password verification
  if (matchedUser.password && matchedUser.password !== password) {
    throw new Error('Invalid email or password.');
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

  const uid = 'CLUB-' + Date.now();
  const formattedClubTitle = clubName.trim().endsWith('Head') || clubName.trim().endsWith('Leader')
    ? clubName.trim()
    : `${clubName.trim()} Head`;

  const newProfile: UserProfile = {
    id: uid,
    name: formattedClubTitle,
    email: cleanEmail,
    password,
    role: 'cr',
    customRole: formattedClubTitle,
    rollNo: rollNo?.trim() || 'CH-01',
    erpNo: erpNo?.trim() || `ERP-${Date.now().toString().slice(-6)}`,
    department: department || 'Internet of Things (IoT)',
    division: 'All Divisions',
    academicBatch: '2023-2027',
    tgmApprovalStatus: 'pending',
    crName: formattedClubTitle,
    tgmName: 'Prof. S. K. Mehta (Senior TGM)',
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

  // Dispatch background notification email
  sendWelcomeEmail({
    email: cleanEmail,
    name: formattedClubTitle,
    role: 'cr',
  }).catch((err) => console.warn('Welcome email trigger notice:', err));

  return newProfile;
}

