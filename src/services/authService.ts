import { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile, AdminUser } from '../types';
import { SEEDED_PROFILES, saveUserProfileToDb, addAdminToDb, getUserProfileByEmail, clearDbCaches } from './dbService';
import { sendWelcomeEmail } from './emailClient';
import { jwtDecode } from 'jwt-decode';
import { parseStudentUID } from '../utils/parseStudentUID';
import { isStudentProfileComplete } from '../utils/studentProfile';

export interface AuthState {
  supabaseUser: User | null;
  activeProfile: UserProfile | null;
  loading: boolean;
}

export type GoogleLoginResult = 
  | { profileNeeded: false; profile: UserProfile }
  | { profileNeeded: true; email: string; name: string; existingProfile?: UserProfile };

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

  // If no existing profile, return a signal that onboarding is needed
  return { 
    profileNeeded: true, 
    email: email, 
    name: decoded.name || email.split('@')[0] 
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
    id: existingProfile?.id || 'STU-GOOGLE-' + Date.now(),
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

  sendWelcomeEmail({ email: saved.email, name: saved.name, role: 'student' }).catch(
    (err) => console.warn('Notice: Welcome email send background trigger:', err)
  );

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
    crName: profileData.crName,
    tgmName: profileData.tgmName,
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
  clearDbCaches();
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

