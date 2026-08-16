import { UserProfile } from '../types';
import { parseStudentUID } from './parseStudentUID';

/** Required fields for a complete student profile (DB is source of truth). */
export function isStudentProfileComplete(profile: UserProfile): boolean {
  if (profile.role !== 'student') return true;

  return Boolean(
    profile.studentUid?.trim() &&
      profile.name?.trim() &&
      profile.erpNo?.trim() &&
      profile.phoneNumber?.trim() &&
      profile.department?.trim() &&
      profile.division?.trim() &&
      profile.rollNo?.trim() &&
      profile.academicBatch?.trim() &&
      profile.email?.trim()
  );
}

export function validateErpNumber(erpNo: string): string | null {
  const trimmed = erpNo.trim();
  if (!trimmed) return 'ERP Number is required.';
  if (!/^\d{6,12}$/.test(trimmed)) return 'ERP Number must be 6–12 digits.';
  return null;
}

export function validatePhoneNumber(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return 'Phone Number is required.';
  if (!/^[6-9]\d{9}$/.test(trimmed)) {
    return 'Enter a valid 10-digit Indian mobile number.';
  }
  return null;
}

export function getCourseFromProfile(profile: UserProfile): string | null {
  if (profile.studentUid) {
    const parsed = parseStudentUID(profile.studentUid);
    if (parsed) return parsed.course;
  }
  return profile.department || null;
}
