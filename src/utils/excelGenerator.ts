import * as XLSX from 'xlsx';
import { CertificateSubmission, UserProfile } from '../types';
import { SEMESTER_TARGETS, AICTE_CATEGORIES } from '../constants/aicteData';
import { getDriveFileWebUrl, getDriveFolderWebUrl } from '../services/driveService';

/**
 * Generate a complete, formatted Excel (.xlsx) Activity Points Report for an individual student
 */
export function generateStudentActivityExcel(
  student: UserProfile,
  submissions: CertificateSubmission[]
) {
  const wb = XLSX.utils.book_new();

  // -------------------------------------------------------------
  // SHEET 1: STUDENT PROFILE & OVERVIEW
  // -------------------------------------------------------------
  const approvedSubmissions = submissions.filter((s) => s.status === 'approved');
  const totalApprovedHours = approvedSubmissions.reduce((acc, s) => acc + s.hoursSpent, 0);
  const totalApprovedPoints = approvedSubmissions.reduce((acc, s) => acc + s.calculatedPoints, 0);
  const isCompleted = totalApprovedPoints >= 100;

  const profileData = [
    ['THAKUR COLLEGE OF ENGINEERING & TECHNOLOGY (AUTONOMOUS)'],
    ['AICTE ACTIVITY POINTS PORTFOLIO & DIARY SUMMARY'],
    [''],
    ['FIELD', 'STUDENT DETAILS'],
    ['Full Student Name', student.name],
    ['ERP Enrolment No', student.erpNo],
    ['Class Roll Number', student.rollNo],
    ['Department', student.department],
    ['Division & Academic Batch', `Div ${student.division} | Batch ${student.academicBatch}`],
    ['Institutional Email', student.email],
    ['Teacher Guardian Mentor (TGM)', student.tgmName || 'Prof. S. K. Mehta (TGM)'],
    ['Class Representative (CR)', student.crName || 'Ananya Verma (CR)'],
    ['Google Drive Root Folder Link', getDriveFolderWebUrl(student.driveRootFolderId)],
    ['Google Drive Root Folder ID / Key', student.driveRootFolderId || `drive_folder_${student.erpNo}`],
    [''],
    ['CUMULATIVE PERFORMANCE SUMMARY', ''],
    ['Total Approved Hours Earned', `${totalApprovedHours} / 400 Hours`],
    ['Total Approved AICTE Points', `${totalApprovedPoints} / 100 Points`],
    ['AICTE Graduation Requirement Status', isCompleted ? 'COMPLETED (100+ Points Achieved)' : 'IN PROGRESS'],
    ['Report Generation Date', new Date().toLocaleString()],
  ];

  const wsProfile = XLSX.utils.aoa_to_sheet(profileData);
  wsProfile['!cols'] = [{ wch: 35 }, { wch: 55 }];
  XLSX.utils.book_append_sheet(wb, wsProfile, 'Student Profile');

  // -------------------------------------------------------------
  // SHEET 2: SEMESTER-WISE TARGET MATRIX
  // -------------------------------------------------------------
  const semHeaders = [
    'Semester',
    'Academic Stage',
    'Target Hours',
    'Target Points',
    'Approved Earned Hours',
    'Approved Earned Points',
    'Cumulative Target Points',
    'Semester Compliance Status',
  ];

  const semRows = SEMESTER_TARGETS.map((st) => {
    const semApproved = submissions.filter(
      (s) => s.semester === st.semester && s.status === 'approved'
    );
    const hrs = semApproved.reduce((a, b) => a + b.hoursSpent, 0);
    const pts = semApproved.reduce((a, b) => a + b.calculatedPoints, 0);
    const meetsTarget = pts >= st.targetPoints;

    return [
      st.semesterLabel,
      st.academicYear,
      st.targetHours,
      st.targetPoints,
      hrs,
      pts,
      st.cumulativeTargetPoints,
      meetsTarget ? 'TARGET MET' : 'PENDING TARGET',
    ];
  });

  const wsSem = XLSX.utils.aoa_to_sheet([semHeaders, ...semRows]);
  wsSem['!cols'] = [
    { wch: 15 },
    { wch: 20 },
    { wch: 14 },
    { wch: 14 },
    { wch: 22 },
    { wch: 22 },
    { wch: 22 },
    { wch: 25 },
  ];
  XLSX.utils.book_append_sheet(wb, wsSem, 'Semester Matrix');

  // -------------------------------------------------------------
  // SHEET 3: ALL SUBMISSIONS & CERTIFICATES BREAKDOWN
  // -------------------------------------------------------------
  const subHeaders = [
    'Sub ID',
    'Semester',
    'Activity Name',
    'Conducted By Body',
    'Category No',
    'Category Title',
    'Hours Spent',
    'Calculated Points',
    'CR Checked Stage 1',
    'CR Checked By',
    'TGM Verified Stage 2',
    'TGM Verified By',
    'Approval Status',
    'Drive File Name',
    'Google Drive Web Link',
    'Submitted Timestamp',
  ];

  const subRows = submissions.map((sub) => {
    const cat = AICTE_CATEGORIES.find((c) => c.id === sub.activityCategoryNo);
    const driveUrl = getDriveFileWebUrl(sub.currentFileDriveId);

    return [
      sub.id,
      sub.semester,
      sub.activityName,
      sub.conductedBy || 'N/A',
      sub.activityCategoryNo,
      cat ? cat.title : `Category ${sub.activityCategoryNo}`,
      sub.hoursSpent,
      sub.calculatedPoints,
      sub.isCheckedByCR ? 'YES (Checked)' : 'NO (Pending)',
      sub.crCheckedBy || 'N/A',
      sub.isVerifiedByTGM ? 'YES (Approved)' : 'NO (Pending)',
      sub.tgmVerifiedBy || 'N/A',
      sub.status.toUpperCase(),
      sub.fileName,
      driveUrl,
      sub.createdAt ? new Date(sub.createdAt).toLocaleString() : 'N/A',
    ];
  });

  const wsSubmissions = XLSX.utils.aoa_to_sheet([subHeaders, ...subRows]);
  wsSubmissions['!cols'] = [
    { wch: 15 },
    { wch: 12 },
    { wch: 35 },
    { wch: 28 },
    { wch: 12 },
    { wch: 30 },
    { wch: 12 },
    { wch: 16 },
    { wch: 18 },
    { wch: 20 },
    { wch: 18 },
    { wch: 20 },
    { wch: 16 },
    { wch: 30 },
    { wch: 50 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, wsSubmissions, 'Activity Submissions');

  // -------------------------------------------------------------
  // SHEET 4: AICTE 15 CATEGORIES REFERENCE
  // -------------------------------------------------------------
  const catHeaders = ['Cat ID', 'Category Title', 'Short Code', 'Scope Description', 'Min Hours per Point', 'Max Points Cap'];
  const catRows = AICTE_CATEGORIES.map((c) => [
    c.id,
    c.title,
    c.shortCode,
    c.description,
    c.minHoursPerPoint,
    c.maxPointsAllowed,
  ]);

  const wsCategories = XLSX.utils.aoa_to_sheet([catHeaders, ...catRows]);
  wsCategories['!cols'] = [
    { wch: 8 },
    { wch: 35 },
    { wch: 15 },
    { wch: 60 },
    { wch: 18 },
    { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, wsCategories, 'AICTE 15 Categories');

  // Trigger Download
  const fileName = `TCET_AICTE_Points_${student.rollNo}_${student.name.replace(/\s+/g, '_')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Generate a complete Class/Department Progress Matrix Excel report for TGMs and Admins
 */
export function generateClassProgressExcel(
  students: UserProfile[],
  submissions: CertificateSubmission[],
  deptName: string = 'Internet of Things (IoT)'
) {
  const wb = XLSX.utils.book_new();

  const headers = [
    'Student ID',
    'Student Name',
    'Roll Number',
    'ERP Number',
    'Department',
    'Division',
    'Academic Batch',
    'Total Approved Points',
    'Total Approved Hours',
    'Approved Submissions Count',
    'Stage 2 Pending (TGM)',
    'Stage 1 Pending (CR)',
    'AICTE Requirement Status',
    'TGM Faculty Mentor',
    'Google Drive Root Folder Link',
  ];

  const rows = students.map((st) => {
    const stSubs = submissions.filter((s) => s.studentId === st.id);
    const approvedSubs = stSubs.filter((s) => s.status === 'approved');
    const approvedPts = approvedSubs.reduce((a, b) => a + b.calculatedPoints, 0);
    const approvedHrs = approvedSubs.reduce((a, b) => a + b.hoursSpent, 0);

    const stage2Pending = stSubs.filter((s) => s.status === 'pending_admin').length;
    const stage1Pending = stSubs.filter((s) => s.status === 'pending_cr').length;

    let standing = 'On Track';
    if (approvedPts >= 100) standing = '100+ Pts Completed';
    else if (approvedPts >= 75) standing = '75+ High Achiever';
    else if (approvedPts < 20) standing = 'Action Required (<20 Pts)';

    return [
      st.id,
      st.name,
      st.rollNo,
      st.erpNo,
      st.department,
      st.division,
      st.academicBatch,
      approvedPts,
      approvedHrs,
      approvedSubs.length,
      stage2Pending,
      stage1Pending,
      standing,
      st.tgmName || 'Prof. S. K. Mehta',
      getDriveFolderWebUrl(st.driveRootFolderId),
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([
    [`THAKUR COLLEGE OF ENGINEERING & TECHNOLOGY — DEPARTMENT CLASS MATRIX (${deptName})`],
    [`Generated Date: ${new Date().toLocaleString()}`],
    [''],
    headers,
    ...rows,
  ]);

  ws['!cols'] = [
    { wch: 15 },
    { wch: 25 },
    { wch: 15 },
    { wch: 15 },
    { wch: 25 },
    { wch: 10 },
    { wch: 15 },
    { wch: 22 },
    { wch: 20 },
    { wch: 25 },
    { wch: 22 },
    { wch: 20 },
    { wch: 25 },
    { wch: 25 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Class Matrix');

  const fileName = `TCET_AICTE_Class_Matrix_${deptName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
