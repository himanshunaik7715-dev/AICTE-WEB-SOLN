export interface ParsedStudentUID {
  uid: string;
  admissionYear: string;
  academicBatch: string;
  course: string;
  rawCourse: string;
  department: string;
  division: string;
  rollNumber: string;
  suffix: string;
}

/** Canonical course/department mapping keyed by normalized course code */
const COURSE_DEPARTMENT_MAP: Record<string, { course: string; department: string }> = {
  'CSE(IOT)': {
    course: 'CSE (Internet of Things)',
    department: 'Internet of Things (IoT)',
  },
  'CSE': {
    course: 'Computer Science Engineering',
    department: 'Computer Science',
  },
  'MECH': {
    course: 'Mechanical Engineering',
    department: 'Mechanical Engineering',
  },
  'CIVIL': {
    course: 'Civil Engineering',
    department: 'Civil Engineering',
  },
  'EXTC': {
    course: 'Electronics Engineering',
    department: 'Electronics Engineering',
  },
};

function normalizeCourseCode(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase();
}

function resolveCourseAndDepartment(courseRaw: string): { course: string; department: string } {
  const key = normalizeCourseCode(courseRaw);
  const mapped = COURSE_DEPARTMENT_MAP[key];
  if (mapped) return mapped;

  // Fallback: use raw course text, department mirrors course
  const displayCourse = courseRaw.replace(/\(/g, ' (').replace(/\)/g, ')').trim();
  return { course: displayCourse, department: displayCourse };
}

/**
 * Parse a TCET student UID such as "25-CSE(IOT)B01-29".
 * Returns null when the format is invalid.
 */
export function parseStudentUID(rawUid: string): ParsedStudentUID | null {
  const uid = rawUid.trim().replace(/\s+/g, '');
  if (!uid) return null;

  let match = uid.match(/^(\d{2})-(.+?)([A-Z])(\d{2})-(\d+)$/i);
  if (match) {
    const [, yearShort, courseRaw, divisionLetter, rollNumber, suffix] = match;
    const admissionYear = `20${yearShort}`;
    const endYear = parseInt(admissionYear, 10) + 4;
    const { course, department } = resolveCourseAndDepartment(courseRaw);

    return {
      uid,
      admissionYear,
      academicBatch: `${admissionYear}-${endYear}`,
      course,
      rawCourse: courseRaw.toUpperCase(),
      department,
      division: divisionLetter.toUpperCase(),
      rollNumber,
      suffix,
    };
  }

  // Alternative format without division: e.g., 24-IOT25-28
  match = uid.match(/^(\d{2})-([A-Z]+)(\d+)-(\d+)$/i);
  if (match) {
    const [, yearShort, courseRaw, rollNumber, suffix] = match;
    const admissionYear = `20${yearShort}`;
    const endYear = parseInt(admissionYear, 10) + 4;
    const { course, department } = resolveCourseAndDepartment(courseRaw);

    return {
      uid,
      admissionYear,
      academicBatch: `${admissionYear}-${endYear}`,
      course,
      rawCourse: courseRaw.toUpperCase(),
      department,
      division: 'N/A',
      rollNumber,
      suffix,
    };
  }

  return null;
}

export function isValidStudentUID(rawUid: string): boolean {
  return parseStudentUID(rawUid) !== null;
}
