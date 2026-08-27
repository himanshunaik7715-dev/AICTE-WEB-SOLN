export type Semester =
  | 'SEM_1'
  | 'SEM_2'
  | 'SEM_3'
  | 'SEM_4'
  | 'SEM_5'
  | 'SEM_6'
  | 'SEM_7'
  | 'SEM_8';

export type UserRole = 'student' | 'cr' | 'admin' | 'superadmin';

export type SubmissionStatus =
  | 'imported'
  | 'naming_error'
  | 'skipped_not_pdf'
  | 'pending_cr'
  | 'pending_admin'
  | 'approved'
  | 'rejected'
  | 'resubmission_requested';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  studentUid?: string;
  phoneNumber?: string;
  course?: string;
  rollNo: string;
  erpNo: string;
  department: string;
  division: string;
  academicBatch: string;
  photoUrl?: string;
  tgmName?: string;
  tgmId?: string;
  crName?: string;
  crId?: string; // ID of the assigned CR user (from users.id)
  tgGroup?: string;
  driveRootFolderId?: string;
  tgmApprovalStatus?: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  customRole?: string; // For CR/Club Heads: e.g. "NSS Head", "Cultural Secretary", "Tech Club President"
}

export interface AICTECategory {
  id: number;
  title: string;
  shortCode: string;
  description: string;
  minHoursPerPoint: number;
  maxPointsAllowed: number;
}

export interface SemesterTarget {
  semester: Semester;
  semesterLabel: string;
  academicYear: string; // e.g. "F.E.", "S.E.", "T.E.", "B.E."
  isOdd: boolean;
  targetHours: number; // 48 for Odd, 52 for Even
  targetPoints: number; // 12 for Odd, 13 for Even
  cumulativeTargetHours: number;
  cumulativeTargetPoints: number;
}

export interface CertificateSubmission {
  id: string;
  studentId: string;
  studentName: string;
  studentRollNo: string;
  studentErpNo: string;
  studentDepartment: string;
  studentDivision: string;
  assignedTgmName?: string;
  assignedCrName?: string;
  semester: Semester;
  activityName: string;
  conductedBy: string;
  activityCategoryNo: number; // 1-16
  shortDescription: string;
  hoursSpent: number;
  calculatedPoints: number;
  currentFileDriveId: string;
  fileName: string;
  fileDataUrl?: string;
  fileDriveIdHistory: string[];
  isCheckedByCR: boolean;
  crCheckedAt?: string;
  crCheckedBy?: string;
  crRemarks?: string;
  isVerifiedByTGM: boolean;
  tgmVerifiedAt?: string;
  tgmVerifiedBy?: string;
  tgmRemarks?: string;
  resubmissionRequestedBy?: 'cr' | 'tgm' | null;
  status: SubmissionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  designation: string; // e.g. "Teacher Guardian Mentor (TGM)", "AICTE Coordinator", "HOD", "Super Admin"
  department: string;
  addedBy: string;
  addedAt: string;
  isWhitelisted: boolean;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
}
