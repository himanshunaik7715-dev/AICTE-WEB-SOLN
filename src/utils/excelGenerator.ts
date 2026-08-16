import * as XLSX from 'xlsx';
import { CertificateSubmission, UserProfile } from '../types';
import { SEMESTER_TARGETS, AICTE_CATEGORIES } from '../constants/aicteData';
import { getDriveFileWebUrl, getDriveFolderWebUrl } from '../services/driveService';

// Helper function to auto-fit column widths based on cell content length
const getAutoFitColumns = (data: any[][]) => {
  const colWidths: { wch: number }[] = [];
  data.forEach((row) => {
    if (Array.isArray(row)) {
      row.forEach((cell, i) => {
        const cellValue = cell !== null && cell !== undefined ? String(cell) : '';
        const cellLength = cellValue.length + 2; // +2 for padding
        if (!colWidths[i]) {
          colWidths[i] = { wch: Math.min(Math.max(cellLength, 10), 100) }; // min 10, max 100
        } else if (cellLength > colWidths[i].wch) {
          colWidths[i].wch = Math.min(cellLength, 100);
        }
      });
    }
  });
  return colWidths;
};

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
    ['Class Representative (CR)', student.crName || 'Not Assigned'],
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
  wsProfile['!cols'] = getAutoFitColumns(profileData);
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
  wsSem['!cols'] = getAutoFitColumns([semHeaders, ...semRows]);
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
  wsSubmissions['!cols'] = getAutoFitColumns([subHeaders, ...subRows]);
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
  wsCategories['!cols'] = getAutoFitColumns([catHeaders, ...catRows]);
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

  const sheetData = [
    [`THAKUR COLLEGE OF ENGINEERING & TECHNOLOGY — DEPARTMENT CLASS MATRIX (${deptName})`],
    [`Generated Date: ${new Date().toLocaleString()}`],
    [''],
    headers,
    ...rows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  ws['!cols'] = getAutoFitColumns(sheetData);

  // Enable native Excel AutoFilter on the header row (row 4, 0-indexed row 3)
  // sheetData rows 0-2 are title/date/blank, row 3 is the headers
  const headerRowIndex = 3;
  const numCols = headers.length;
  const endCol = XLSX.utils.encode_col(numCols - 1);
  ws['!autofilter'] = { ref: `A${headerRowIndex + 1}:${endCol}${headerRowIndex + 1}` };

  XLSX.utils.book_append_sheet(wb, ws, 'Class Matrix');

  const fileName = `TCET_AICTE_Class_Matrix_${deptName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
