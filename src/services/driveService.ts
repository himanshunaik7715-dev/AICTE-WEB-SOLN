/**
 * Google Drive Storage & Integration Helper
 * Provides file uploads, folder creation structure, and view links for AICTE certificate files.
 */

export interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  webContentLink?: string;
  folderPath?: string;
  size?: number;
  uploadedAt: string;
  dataUrl?: string;
}

/**
 * Generates a standard Google Drive folder structure for a TCET student:
 * TCET_AICTE_Diary_2023-2027 / <Student_RollNo>_<Student_Name> / <Semester>
 */
export function buildStudentDriveFolderPath(
  studentName: string,
  rollNo: string,
  semester: string
): string {
  const cleanName = studentName.replace(/[^a-zA-Z0-9]/g, '_');
  return `TCET_AICTE_Portfolio/${rollNo}_${cleanName}/${semester}`;
}

/**
 * Extracts a clean Google Drive File ID from a URL or raw ID string.
 */
export function extractDriveFileId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();

  // Match /d/FILE_ID/
  const matchD = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (matchD && matchD[1]) {
    return matchD[1];
  }

  // Match id=FILE_ID
  const matchId = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchId && matchId[1]) {
    return matchId[1];
  }

  // If plain alphanumeric ID without slashes or colons
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return trimmed;
  }

  return trimmed;
}

/**
 * Constructs an embedded view-only preview URL suitable for <iframe> for any Google Drive File/Document
 */
export function getDriveFilePreviewUrl(driveIdOrUrl: string): string {
  if (!driveIdOrUrl) return '';

  if (driveIdOrUrl.startsWith('data:')) {
    return driveIdOrUrl;
  }

  const fileId = extractDriveFileId(driveIdOrUrl);
  if (fileId && !fileId.startsWith('http://') && !fileId.startsWith('https://')) {
    return `https://drive.google.com/file/d/${fileId}/preview`;
  }

  if (driveIdOrUrl.includes('drive.google.com')) {
    if (driveIdOrUrl.includes('/view')) {
      return driveIdOrUrl.replace(/\/view(\?.*)?$/, '/preview');
    }
    if (!driveIdOrUrl.includes('/preview')) {
      return `${driveIdOrUrl}/preview`;
    }
  }

  return driveIdOrUrl;
}

/**
 * Constructs a standard direct Google Drive web view link
 */
export function getDriveFileWebUrl(driveIdOrUrl: string): string {
  if (!driveIdOrUrl) return '#';
  if (driveIdOrUrl.startsWith('data:')) {
    return driveIdOrUrl;
  }

  const fileId = extractDriveFileId(driveIdOrUrl);
  if (fileId && !fileId.startsWith('http://') && !fileId.startsWith('https://')) {
    return `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
  }

  return driveIdOrUrl;
}

/**
 * Constructs a direct, clickable Google Drive Folder Web URL
 */
export function getDriveFolderWebUrl(folderIdOrUrl?: string): string {
  if (!folderIdOrUrl) return 'https://drive.google.com/drive/my-drive';
  const trimmed = folderIdOrUrl.trim();
  if (!trimmed) return 'https://drive.google.com/drive/my-drive';

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Extract folder ID if inside a URL like /folders/123XYZ
  const matchFolder = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (matchFolder && matchFolder[1]) {
    return `https://drive.google.com/drive/folders/${matchFolder[1]}`;
  }

  const fileId = extractDriveFileId(trimmed);
  if (fileId && fileId.length > 3) {
    return `https://drive.google.com/drive/folders/${fileId}`;
  }

  return `https://drive.google.com/drive/my-drive`;
}

/**
 * Simulated / Client-side Google Drive Uploader
 * In a production Google Workspace deployment with OAuth tokens, this calls:
 * POST https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart
 */
export async function uploadFileToGoogleDrive(
  file: File,
  folderPath: string,
  onProgress?: (percent: number) => void
): Promise<DriveFileMetadata> {
  return new Promise((resolve) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += 25;
      if (onProgress) onProgress(progress);

      if (progress >= 100) {
        clearInterval(interval);
        // Generate a deterministic Google Drive File ID or use local FileReader data
        const reader = new FileReader();
        reader.onload = () => {
          const driveFileId = `drive_file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const dataUrl = typeof reader.result === 'string' ? reader.result : undefined;
          resolve({
            id: driveFileId,
            name: file.name,
            mimeType: file.type || 'application/pdf',
            webViewLink: `https://drive.google.com/file/d/${driveFileId}/view?usp=sharing`,
            folderPath,
            size: file.size,
            uploadedAt: new Date().toISOString(),
            dataUrl,
          });
        };
        reader.readAsDataURL(file);
      }
    }, 200);
  });
}

/**
 * Parses file names following the naming convention:
 * 1) SEM-01_CAT-06_SmartIndiaHackathonWinner.pdf
 * 2) CAT-06_SmartIndiaHackathonWinner.pdf
 */
export function parseFileNameConvention(fileName: string): {
  categoryCode: string;
  semesterCode?: string;
  title: string;
  hasNamingConvention: boolean;
} {
  if (!fileName) return { categoryCode: '', title: '', hasNamingConvention: false };

  const nameNoExt = fileName.replace(/\.pdf$/i, '').trim();

  // Full match: SEM-01_CAT-06_Title
  const fullMatch = nameNoExt.match(/^(SEM[_\s-]*0?([1-8]))[_\s-]+(CAT[_\s-]*0?([1-9]|1[0-5]))[_\s-]+(.+)$/i);
  if (fullMatch) {
    const semNum = fullMatch[2];
    const catNum = parseInt(fullMatch[4], 10);
    const catCode = `CAT-${catNum.toString().padStart(2, '0')}`;
    const semCode = `SEM_${semNum}`;

    let rawTitle = fullMatch[5].replace(/_[0-9]{6,8}$/, '');
    if (!rawTitle.includes(' ') && !rawTitle.includes('_') && !rawTitle.includes('-')) {
      rawTitle = rawTitle.replace(/([a-z])([A-Z])/g, '$1 $2');
    } else {
      rawTitle = rawTitle.replace(/[_-]/g, ' ');
    }

    return {
      categoryCode: catCode,
      semesterCode: semCode,
      title: rawTitle.trim(),
      hasNamingConvention: true,
    };
  }

  // Legacy match: CAT-06_Title
  const catMatch = nameNoExt.match(/^(CAT[_\s-]*0?([1-9]|1[0-5]))[_\s-]+(.+)$/i);
  if (catMatch) {
    const catNum = parseInt(catMatch[2], 10);
    const catCode = `CAT-${catNum.toString().padStart(2, '0')}`;

    let rawTitle = catMatch[3].replace(/_[0-9]{6,8}$/, '');
    if (!rawTitle.includes(' ') && !rawTitle.includes('_') && !rawTitle.includes('-')) {
      rawTitle = rawTitle.replace(/([a-z])([A-Z])/g, '$1 $2');
    } else {
      rawTitle = rawTitle.replace(/[_-]/g, ' ');
    }

    return {
      categoryCode: catCode,
      title: rawTitle.trim(),
      hasNamingConvention: true,
    };
  }

  let rawTitle = nameNoExt;
  if (!rawTitle.includes(' ') && !rawTitle.includes('_') && !rawTitle.includes('-')) {
    rawTitle = rawTitle.replace(/([a-z])([A-Z])/g, '$1 $2');
  } else {
    rawTitle = rawTitle.replace(/[_-]/g, ' ');
  }

  return {
    categoryCode: '',
    title: rawTitle.trim(),
    hasNamingConvention: false,
  };
}

/**
 * Fetches files from a public Google Drive folder link or folder ID
 */
export async function fetchGoogleDriveFolderFiles(
  folderUrlOrId: string,
  semester: string = 'SEM1'
): Promise<{
  success: boolean;
  files: Array<{
    id: string;
    driveFileId: string;
    name: string;
    categoryCode: string;
    title: string;
    webViewLink: string;
    mimeType: string;
    semester: string;
    hasNamingConvention: boolean;
  }>;
  error?: string;
}> {
  try {
    const res = await fetch('/api/drive/fetch-folder-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderUrlOrId, semester }),
    });

    const json = await res.json();
    if (json.success && Array.isArray(json.files)) {
      return { success: true, files: json.files };
    }
    return { success: false, files: [], error: json.error || 'Failed to fetch folder' };
  } catch (err: any) {
    return { success: false, files: [], error: err?.message || 'Network error fetching folder files' };
  }
}
