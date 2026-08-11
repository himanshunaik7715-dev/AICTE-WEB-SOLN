import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CertificateSubmission, UserProfile } from '../types';
import { SEMESTER_TARGETS, AICTE_CATEGORIES } from '../constants/aicteData';

export function generateActivityDiaryPDF(
  student: UserProfile,
  submissions: CertificateSubmission[]
) {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Color Palette
  const primaryColor: [number, number, number] = [15, 23, 42]; // Slate 900
  const accentColor: [number, number, number] = [30, 58, 138]; // Blue 900
  const lightBg: [number, number, number] = [248, 250, 252]; // Slate 50
  const borderColor: [number, number, number] = [203, 213, 225]; // Slate 300

  // Helper Header
  const addInstituteHeader = () => {
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('THAKUR COLLEGE OF ENGINEERING & TECHNOLOGY (AUTONOMOUS)', 10, 8);
    doc.text('AICTE ACTIVITY POINT DIARY (SEM I - SEM VIII)', pageWidth - 10, 8, { align: 'right' });
  };

  const addFooter = (pageNum: number, totalPages: number) => {
    doc.setLineWidth(0.2);
    doc.setDrawColor(...borderColor);
    doc.line(10, pageHeight - 12, pageWidth - 10, pageHeight - 12);
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Student ERP: ${student.erpNo} | Name: ${student.name}`, 10, pageHeight - 7);
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - 10, pageHeight - 7, { align: 'right' });
  };

  // -------------------------------------------------------------
  // PAGE 1: COVER PAGE
  // -------------------------------------------------------------
  addInstituteHeader();

  // Decorative Frame
  doc.setDrawColor(...accentColor);
  doc.setLineWidth(1);
  doc.rect(10, 18, pageWidth - 20, pageHeight - 32);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text('THAKUR COLLEGE OF ENGINEERING & TECHNOLOGY', pageWidth / 2, 35, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('(An Autonomous Institute Affiliated to University of Mumbai)', pageWidth / 2, 42, { align: 'center' });
  doc.text('A-Block, Thakur Educational Campus, Kandivali (E), Mumbai - 400101', pageWidth / 2, 47, { align: 'center' });

  // Banner
  doc.setFillColor(30, 58, 138);
  doc.rect(20, 58, pageWidth - 40, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('AICTE ACTIVITY POINTS PORTFOLIO & DIARY', pageWidth / 2, 70, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Mandatory 100 Activity Points (400 Hours) Requirement as per AICTE Norms', pageWidth / 2, 77, { align: 'center' });

  // Student Details Box
  doc.setFillColor(...lightBg);
  doc.rect(25, 92, pageWidth - 50, 95, 'F');
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.4);
  doc.rect(25, 92, pageWidth - 50, 95);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('STUDENT CREDENTIALS & ACADEMIC PROFILE', 32, 103);
  doc.line(32, 106, pageWidth - 32, 106);

  const fields = [
    ['Full Student Name:', student.name],
    ['ERP Enrolment No:', student.erpNo],
    ['Class Roll Number:', student.rollNo],
    ['Department:', student.department],
    ['Division & Batch:', `Div ${student.division} | Batch ${student.academicBatch}`],
    ['Email Address:', student.email],
    ['Teacher Guardian Mentor (TGM):', student.tgmName || 'Prof. S. K. Mehta'],
    ['Class Representative (CR):', student.crName || 'Ananya Verma'],
    ['Google Drive Root ID:', student.driveRootFolderId || 'drive_root_tcet_2023'],
  ];

  let currentY = 114;
  fields.forEach(([label, val]) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text(label, 32, currentY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(val, 95, currentY);
    currentY += 8;
  });

  // Calculate Cumulative Totals
  const approvedSubmissions = submissions.filter((s) => s.status === 'approved');
  const totalApprovedHours = approvedSubmissions.reduce((acc, s) => acc + s.hoursSpent, 0);
  const totalApprovedPoints = approvedSubmissions.reduce((acc, s) => acc + s.calculatedPoints, 0);

  // Status Badge
  doc.setFillColor(241, 245, 249);
  doc.rect(25, 195, pageWidth - 50, 32, 'F');
  doc.rect(25, 195, pageWidth - 50, 32);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.text('CUMULATIVE PROGRESS SUMMARY', 32, 205);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`Total Approved Hours: ${totalApprovedHours} / 400 Hours`, 32, 214);
  doc.text(`Total Approved Points: ${totalApprovedPoints} / 100 Points`, 32, 221);

  const isCompleted = totalApprovedPoints >= 100;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(isCompleted ? 22 : 180, isCompleted ? 101 : 83, isCompleted ? 52 : 9);
  doc.text(
    `AICTE Status: ${isCompleted ? 'COMPLETED (100 PTS ACHIEVED)' : 'IN PROGRESS'}`,
    pageWidth - 32,
    214,
    { align: 'right' }
  );

  // Signatures on Cover Page
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  const sigY = 250;
  doc.line(25, sigY, 65, sigY);
  doc.text('Student Signature', 45, sigY + 5, { align: 'center' });

  doc.line(85, sigY, 125, sigY);
  doc.text('CR Signature', 105, sigY + 5, { align: 'center' });

  doc.line(145, sigY, 185, sigY);
  doc.text('TGM / HOD Stamp', 165, sigY + 5, { align: 'center' });

  addFooter(1, 28);

  // -------------------------------------------------------------
  // PAGE 2: STUDENT PROFILE & INSTRUCTIONS
  // -------------------------------------------------------------
  doc.addPage();
  addInstituteHeader();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('SECTION A: AICTE ACTIVITY POINT RULES & INSTRUCTIONS', 10, 22);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  const rulesText = [
    '1. As per AICTE / University of Mumbai guidelines, every B.Tech student must earn 100 Activity Points (400 Hours) across 8 semesters to qualify for the degree.',
    '2. Semester Target Allocation:',
    '   • Odd Semesters (Sem I, III, V, VII): Minimum 48 Hours / 12 Points per semester.',
    '   • Even Semesters (Sem II, IV, VI, VIII): Minimum 52 Hours / 13 Points per semester.',
    '3. Two-Stage Verification Process:',
    '   • Stage 1 (CR Verification): Student uploads proof to Google Drive. Class Representative (CR) validates certificate authenticity (isCheckedByCR = true, rendering tick mark [v]).',
    '   • Stage 2 (TGM Approval): Teacher Guardian Mentor (TGM) / Admin conducts final review (isVerifiedByTGM = true, rendering tick mark [v]) and awards live points.',
    '4. Student must retain original certificates and upload high-resolution scans to designated Google Drive folder.',
    '5. Resubmissions must maintain version history (fileDriveIdHistory) when corrections are requested by CR or TGM.',
  ];

  let rulesY = 30;
  rulesText.forEach((line) => {
    doc.text(line, 12, rulesY);
    rulesY += 6;
  });

  // Table of Semester Targets
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('SEMESTER-WISE TARGET BREAKDOWN TABLE', 10, 75);

  const semesterTargetRows = SEMESTER_TARGETS.map((st) => {
    const semSubmissions = submissions.filter(
      (s) => s.semester === st.semester && s.status === 'approved'
    );
    const semHrs = semSubmissions.reduce((a, b) => a + b.hoursSpent, 0);
    const semPts = semSubmissions.reduce((a, b) => a + b.calculatedPoints, 0);
    const statusText = semPts >= st.targetPoints ? 'COMPLETED' : 'IN PROGRESS';

    return [
      st.semesterLabel,
      st.academicYear,
      `${st.targetHours} Hrs`,
      `${st.targetPoints} Pts`,
      `${semHrs} Hrs`,
      `${semPts} Pts`,
      `${st.cumulativeTargetPoints} Pts`,
      statusText,
    ];
  });

  autoTable(doc, {
    startY: 80,
    head: [
      [
        'Semester',
        'Year',
        'Target Hours',
        'Target Points',
        'Earned Hours',
        'Earned Points',
        'Cum. Target',
        'Status',
      ],
    ],
    body: semesterTargetRows,
    theme: 'grid',
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, textColor: [15, 23, 42] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 10, right: 10 },
  });

  addFooter(2, 28);

  // -------------------------------------------------------------
  // PAGES 3 to 25: SEMESTER-WISE TABLES (SEM I TO SEM VIII)
  // Each semester gets formatted pages with 10 activity slots
  // -------------------------------------------------------------
  let currentPageIndex = 3;

  SEMESTER_TARGETS.forEach((st) => {
    doc.addPage();
    addInstituteHeader();

    // Semester Banner
    doc.setFillColor(30, 58, 138);
    doc.rect(10, 16, pageWidth - 20, 14, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(
      `ACTIVITY RECORD — ${st.semesterLabel.toUpperCase()} (${st.academicYear.toUpperCase()})`,
      15,
      23
    );

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Target: ${st.targetHours} Hours / ${st.targetPoints} Points | Cumulative Requirement: ${st.cumulativeTargetPoints} Points`,
      pageWidth - 15,
      23,
      { align: 'right' }
    );

    // Filter submissions for this semester
    const semSubmissions = submissions.filter((s) => s.semester === st.semester);

    // Build 10 rows matching TCET Diary layout
    const tableData = [];
    for (let i = 0; i < 10; i++) {
      const sub = semSubmissions[i];
      if (sub) {
        const cat = AICTE_CATEGORIES.find((c) => c.id === sub.activityCategoryNo);
        const crTick = sub.isCheckedByCR ? ' [v] ' : ' [ ] ';
        const tgmTick = sub.isVerifiedByTGM ? ' [v] ' : ' [ ] ';

        tableData.push([
          (i + 1).toString(),
          `${sub.activityName}\nConducted by: ${sub.conductedBy}`,
          cat ? cat.shortCode : `CAT-${sub.activityCategoryNo}`,
          `${sub.hoursSpent}h`,
          `${sub.calculatedPoints}p`,
          crTick,
          tgmTick,
          sub.status.toUpperCase().replace('_', ' '),
        ]);
      } else {
        tableData.push([
          (i + 1).toString(),
          '- Vacant Slot -',
          '-',
          '-',
          '-',
          '[ ]',
          '[ ]',
          'Pending Upload',
        ]);
      }
    }

    autoTable(doc, {
      startY: 33,
      head: [
        [
          'S.N.',
          'Activity Name & Conducting Body',
          'Cat',
          'Hours',
          'Points',
          'Checked (CR)',
          'Verified (TGM)',
          'Status',
        ],
      ],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5, textColor: [15, 23, 42] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 70 },
        2: { cellWidth: 16, halign: 'center' },
        3: { cellWidth: 14, halign: 'center' },
        4: { cellWidth: 14, halign: 'center' },
        5: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
        6: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
        7: { cellWidth: 24, halign: 'center' },
      },
      margin: { left: 10, right: 10 },
    });

    // Semester Total Summary
    const finalY = (doc as any).lastAutoTable.finalY + 6;
    const semApproved = semSubmissions.filter((s) => s.status === 'approved');
    const semEarnedHours = semApproved.reduce((a, b) => a + b.hoursSpent, 0);
    const semEarnedPoints = semApproved.reduce((a, b) => a + b.calculatedPoints, 0);

    doc.setFillColor(241, 245, 249);
    doc.rect(10, finalY, pageWidth - 20, 18, 'F');
    doc.setDrawColor(...borderColor);
    doc.rect(10, finalY, pageWidth - 20, 18);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${st.semesterLabel} SUMMARY:`, 14, finalY + 7);

    doc.setFont('helvetica', 'normal');
    doc.text(
      `Earned: ${semEarnedHours} / ${st.targetHours} Hours  |  ${semEarnedPoints} / ${st.targetPoints} Points`,
      55,
      finalY + 7
    );

    const meetsTarget = semEarnedPoints >= st.targetPoints;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(meetsTarget ? 22 : 220, meetsTarget ? 101 : 38, meetsTarget ? 52 : 38);
    doc.text(
      meetsTarget ? 'TARGET MET [v]' : 'TARGET PENDING',
      pageWidth - 15,
      finalY + 7,
      { align: 'right' }
    );

    // Verification Signatures
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('CR Signature: __________________', 14, finalY + 14);
    doc.text('TGM Signature: __________________', pageWidth - 70, finalY + 14);

    addFooter(currentPageIndex, 28);
    currentPageIndex++;
  });

  // Fill up pages to reach page 26 for summary
  while (currentPageIndex < 26) {
    doc.addPage();
    addInstituteHeader();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`ACTIVITY LOG PAGE ${currentPageIndex}`, 10, 25);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Additional activity notes, workshop logs, and reflection records as per TCET Diary guidelines.',
      10,
      32
    );

    // Empty grid for manual notes
    for (let y = 45; y < 250; y += 12) {
      doc.setDrawColor(226, 232, 240);
      doc.line(10, y, pageWidth - 10, y);
    }

    addFooter(currentPageIndex, 28);
    currentPageIndex++;
  }

  // -------------------------------------------------------------
  // PAGE 26: CUMULATIVE MATRIX & FINAL CERTIFICATION
  // -------------------------------------------------------------
  doc.addPage();
  addInstituteHeader();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('FINAL CUMULATIVE AICTE POINTS CONSOLIDATED MATRIX', 10, 22);

  const consolidatedRows = SEMESTER_TARGETS.map((st) => {
    const semApproved = submissions.filter(
      (s) => s.semester === st.semester && s.status === 'approved'
    );
    const hrs = semApproved.reduce((a, b) => a + b.hoursSpent, 0);
    const pts = semApproved.reduce((a, b) => a + b.calculatedPoints, 0);
    return [
      st.semesterLabel,
      st.academicYear,
      `${st.targetHours}h / ${st.targetPoints}p`,
      `${hrs} Hours`,
      `${pts} Points`,
      pts >= st.targetPoints ? 'SATISFACTORY [v]' : 'DEFICIT',
    ];
  });

  autoTable(doc, {
    startY: 28,
    head: [['Semester', 'Academic Stage', 'Target (Hrs / Pts)', 'Approved Hours', 'Approved Points', 'CR & TGM Compliance']],
    body: consolidatedRows,
    theme: 'grid',
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    margin: { left: 10, right: 10 },
  });

  const matrixY = (doc as any).lastAutoTable.finalY + 10;

  // Final Endorsement Box
  doc.setFillColor(248, 250, 252);
  doc.rect(10, matrixY, pageWidth - 20, 55, 'F');
  doc.setDrawColor(...borderColor);
  doc.rect(10, matrixY, pageWidth - 20, 55);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('FINAL DEGREE QUALIFICATION CERTIFICATE', 15, matrixY + 10);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `This is to certify that Mr./Ms. ${student.name} (ERP: ${student.erpNo}, Roll No: ${student.rollNo}) of ${student.department} department has completed total ${totalApprovedHours} Hours (${totalApprovedPoints} Points) out of the required 400 Hours (100 Points) AICTE Activity Points.`,
    15,
    matrixY + 20,
    { maxWidth: pageWidth - 30 }
  );

  const sigY2 = matrixY + 42;
  doc.setFont('helvetica', 'bold');
  doc.text('Student Signature', 20, sigY2);
  doc.text('TGM / Mentor Signature', 80, sigY2);
  doc.text('HOD / Principal Signature', 140, sigY2);

  addFooter(26, 28);

  // -------------------------------------------------------------
  // PAGES 27 & 28: OFFICIAL AICTE PROGRAM GUIDELINES
  // -------------------------------------------------------------
  doc.addPage();
  addInstituteHeader();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('APPENDIX I: AICTE 15 ACTIVITY CATEGORIES REFERENCE', 10, 22);

  const catRows = AICTE_CATEGORIES.map((cat) => [
    `Cat ${cat.id}`,
    cat.title,
    cat.description,
    `${cat.minHoursPerPoint} Hours = 1 Point`,
    `Max ${cat.maxPointsAllowed} Pts`,
  ]);

  autoTable(doc, {
    startY: 28,
    head: [['Code', 'Category Name', 'Scope of Activity', 'Point Conversion Rate', 'Category Cap']],
    body: catRows,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 7.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center' },
      1: { cellWidth: 45 },
      2: { cellWidth: 80 },
      3: { cellWidth: 30, halign: 'center' },
      4: { cellWidth: 20, halign: 'center' },
    },
    margin: { left: 10, right: 10 },
  });

  addFooter(27, 28);

  // PAGE 28
  doc.addPage();
  addInstituteHeader();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('APPENDIX II: CODE OF CONDUCT & VERIFICATION POLICY', 10, 22);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  const appendixLines = [
    '• All activity submissions must be supported by official certificates issued by recognized bodies or TCET committees.',
    '• Submissions are archived in student-specific Google Drive paths linked to ERP numbers.',
    '• Misrepresentation or submitting fake certificates will result in disciplinary action under TCET Code of Conduct.',
    '• Stage-1 verification is handled by Class Representatives (CR). Stage-2 final approval and credit of live points is handled by Teacher Guardian Mentors (TGM).',
    '• For queries regarding point conversion or rejected entries, contact the Department AICTE Coordinator.',
  ];

  let appY = 32;
  appendixLines.forEach((l) => {
    doc.text(l, 12, appY);
    appY += 8;
  });

  // Big Watermark / Seal Box
  doc.setDrawColor(30, 58, 138);
  doc.setLineWidth(0.8);
  doc.rect(30, 100, pageWidth - 60, 60);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 58, 138);
  doc.text('TCET AICTE ACTIVITY CELL - OFFICIAL SEAL', pageWidth / 2, 120, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Digitally Verified & Generated by Student Portfolio System', pageWidth / 2, 130, { align: 'center' });
  doc.text(`Document Generation Timestamp: ${new Date().toLocaleString()}`, pageWidth / 2, 138, { align: 'center' });

  addFooter(28, 28);

  // Trigger Save / Download
  doc.save(`TCET_AICTE_Activity_Diary_${student.erpNo}_${student.name.replace(/\s+/g, '_')}.pdf`);
}
