-- ============================================================
-- SUPABASE POSTGRES SCHEMA FOR TCET AICTE ACTIVITY DIARY
-- Paste this script into your Supabase Dashboard -> SQL Editor
-- This script is completely IDEMPOTENT (safe to run multiple times)
-- ============================================================

-- 1. Create or Update Users Table (Student, CR, TGM, Super Admin Profiles)
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  "rollNo" TEXT,
  roll_no TEXT,
  "erpNo" TEXT,
  erp_no TEXT,
  department TEXT,
  division TEXT,
  "academicBatch" TEXT,
  academic_batch TEXT,
  "tgmName" TEXT,
  tgm_name TEXT,
  "crName" TEXT,
  cr_name TEXT,
  "driveRootFolderId" TEXT,
  drive_root_folder_id TEXT,
  "tgmApprovalStatus" TEXT DEFAULT 'approved',
  "approvedBy" TEXT,
  "approvedAt" TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure primary key constraint exists if table was created without one previously
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_pkey'
  ) THEN
    ALTER TABLE public.users ADD PRIMARY KEY (id);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Ensure missing columns exist on public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "rollNo" TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "erpNo" TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "academicBatch" TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "tgmName" TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "crName" TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "driveRootFolderId" TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "tgmApprovalStatus" TEXT DEFAULT 'approved';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "approvedBy" TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "approvedAt" TEXT;


-- 2. Create or Update Whitelisted / Pending Admins Table
CREATE TABLE IF NOT EXISTS public.admins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  designation TEXT DEFAULT 'Teacher Guardian Mentor (TGM)',
  department TEXT DEFAULT 'Internet of Things (IoT)',
  role TEXT NOT NULL DEFAULT 'admin',
  "addedAt" TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  "addedBy" TEXT,
  added_by TEXT,
  "isWhitelisted" BOOLEAN DEFAULT TRUE,
  "approvalStatus" TEXT DEFAULT 'approved'
);

-- Ensure primary key constraint exists on public.admins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admins_pkey'
  ) THEN
    ALTER TABLE public.admins ADD PRIMARY KEY (id);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Ensure missing columns exist on public.admins
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS designation TEXT;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS "addedAt" TEXT;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS "addedBy" TEXT;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS "isWhitelisted" BOOLEAN DEFAULT TRUE;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT DEFAULT 'approved';


-- 3. Create or Update Certificate Submissions Table
CREATE TABLE IF NOT EXISTS public.submissions (
  id TEXT PRIMARY KEY,
  "studentId" TEXT,
  student_id TEXT,
  "studentName" TEXT,
  student_name TEXT,
  "studentRollNo" TEXT,
  student_roll_no TEXT,
  "studentErpNo" TEXT,
  student_erp_no TEXT,
  "studentDepartment" TEXT,
  student_department TEXT,
  "studentDivision" TEXT,
  student_division TEXT,
  semester TEXT NOT NULL,
  "activityName" TEXT,
  activity_name TEXT,
  "conductedBy" TEXT,
  conducted_by TEXT,
  "activityCategoryNo" INT DEFAULT 1,
  activity_category_no INT DEFAULT 1,
  "shortDescription" TEXT,
  short_description TEXT,
  "hoursSpent" INT DEFAULT 0,
  hours_spent INT DEFAULT 0,
  "calculatedPoints" INT DEFAULT 0,
  calculated_points INT DEFAULT 0,
  "currentFileDriveId" TEXT,
  current_file_drive_id TEXT,
  "fileName" TEXT,
  file_name TEXT,
  "fileDriveIdHistory" JSONB DEFAULT '[]'::jsonb,
  file_drive_id_history JSONB DEFAULT '[]'::jsonb,
  "isCheckedByCr" BOOLEAN DEFAULT FALSE,
  is_checked_by_cr BOOLEAN DEFAULT FALSE,
  "crCheckedAt" TEXT,
  cr_checked_at TIMESTAMPTZ,
  "crCheckedBy" TEXT,
  cr_checked_by TEXT,
  "isVerifiedByTgm" BOOLEAN DEFAULT FALSE,
  is_verified_by_tgm BOOLEAN DEFAULT FALSE,
  "tgmVerifiedAt" TEXT,
  tgm_verified_at TIMESTAMPTZ,
  "tgmVerifiedBy" TEXT,
  tgm_verified_by TEXT,
  status TEXT DEFAULT 'pending_cr',
  "rejectionReason" TEXT,
  rejection_reason TEXT,
  "createdAt" TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure primary key constraint exists on public.submissions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'submissions_pkey'
  ) THEN
    ALTER TABLE public.submissions ADD PRIMARY KEY (id);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;


-- 5. Safe & Idempotent Row Level Security Policies
-- Drop older policies if present to prevent duplicate policy errors (42710)
DROP POLICY IF EXISTS "Allow public read users" ON public.users;
DROP POLICY IF EXISTS "Allow public insert users" ON public.users;
DROP POLICY IF EXISTS "Allow public update users" ON public.users;
DROP POLICY IF EXISTS "Allow public delete users" ON public.users;

DROP POLICY IF EXISTS "Allow public read submissions" ON public.submissions;
DROP POLICY IF EXISTS "Allow public insert submissions" ON public.submissions;
DROP POLICY IF EXISTS "Allow public update submissions" ON public.submissions;
DROP POLICY IF EXISTS "Allow public delete submissions" ON public.submissions;

DROP POLICY IF EXISTS "Allow public read admins" ON public.admins;
DROP POLICY IF EXISTS "Allow public insert admins" ON public.admins;
DROP POLICY IF EXISTS "Allow public update admins" ON public.admins;
DROP POLICY IF EXISTS "Allow public delete admins" ON public.admins;

DROP POLICY IF EXISTS "Public Users Access" ON public.users;
DROP POLICY IF EXISTS "Public Submissions Access" ON public.submissions;
DROP POLICY IF EXISTS "Public Admins Access" ON public.admins;

-- Re-create clean public access policies for users, submissions, and admins
CREATE POLICY "Public Users Access" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Submissions Access" ON public.submissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Admins Access" ON public.admins FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- 6. CERTIFICATE AUTO-CATEGORIZATION & DRIVE SYNC SCHEMA
-- ============================================================

-- Fixed category list (matches AICTE categories)
CREATE TABLE IF NOT EXISTS public.categories (
  code TEXT PRIMARY KEY,        -- 'CAT-01', 'CAT-02', ...
  name TEXT NOT NULL            -- 'Literacy & Education Drive', ...
);

INSERT INTO public.categories (code, name) VALUES
  ('CAT-01', 'Literacy & Education Drive'),
  ('CAT-02', 'Sports & Physical Fitness Support'),
  ('CAT-03', 'Rural Development & Swachh Bharat'),
  ('CAT-04', 'Disaster Relief & Healthcare Assistance'),
  ('CAT-05', 'Environmental Protection & Energy Saving'),
  ('CAT-06', 'Innovation, Hackathons & Competitions'),
  ('CAT-07', 'Blood Donation & Health Awareness'),
  ('CAT-08', 'NGO Volunteering & Community Care'),
  ('CAT-09', 'Technical Event Organizing & Leadership'),
  ('CAT-10', 'NSS / NCC / Cultural Activity'),
  ('CAT-11', 'Digital Literacy & Cyber Security Training'),
  ('CAT-12', 'Skill Development & Entrepreneurship'),
  ('CAT-13', 'Women Empowerment & Social Equity'),
  ('CAT-14', 'Student Body & Club Leadership'),
  ('CAT-15', 'Industry Visits & Community Research')
ON CONFLICT (code) DO NOTHING;

-- Students table
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  roll_number TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  drive_folder_link TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Faculty table
CREATE TABLE IF NOT EXISTS public.faculty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL
);

-- Certificates table
CREATE TABLE IF NOT EXISTS public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  drive_file_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  subfolder_path TEXT,
  category_code TEXT REFERENCES public.categories(code),
  title TEXT,
  drive_modified_time TIMESTAMPTZ,
  preview_link TEXT,
  view_link TEXT,
  status TEXT NOT NULL DEFAULT 'pending_verification'
    CHECK (status IN (
      'pending_verification',
      'naming_error',
      'skipped_not_pdf',
      'verified',
      'rejected'
    )),
  verified_by UUID REFERENCES public.faculty(id),
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_id, drive_file_id)
);

CREATE INDEX IF NOT EXISTS idx_certificates_status ON public.certificates(status);
CREATE INDEX IF NOT EXISTS idx_certificates_student ON public.certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_certificates_category ON public.certificates(category_code);

-- Auto-update updated_at on any change
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_certificates_updated_at ON public.certificates;
CREATE TRIGGER trg_certificates_updated_at
  BEFORE UPDATE ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- AI Classification log table
CREATE TABLE IF NOT EXISTS public.ai_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id UUID NOT NULL REFERENCES public.certificates(id) ON DELETE CASCADE,
  model TEXT NOT NULL DEFAULT 'gemini-3.6-flash',
  raw_response JSONB NOT NULL,
  category_code TEXT REFERENCES public.categories(code),
  title TEXT,
  reason TEXT,
  applied BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_classifications_certificate ON public.ai_classifications(certificate_id);

-- Function to apply AI Classification
CREATE OR REPLACE FUNCTION apply_ai_classification(
  p_certificate_id UUID,
  p_raw_response JSONB,
  p_category_code TEXT,
  p_title TEXT,
  p_reason TEXT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.ai_classifications (
    certificate_id, raw_response, category_code, title, reason, applied
  ) VALUES (
    p_certificate_id, p_raw_response, p_category_code, p_title, p_reason,
    p_category_code IS NOT NULL
  );

  IF p_category_code IS NOT NULL THEN
    UPDATE public.certificates
    SET category_code = p_category_code,
        title = p_title,
        status = 'pending_verification'
    WHERE id = p_certificate_id;
  ELSE
    UPDATE public.certificates
    SET status = 'naming_error'
    WHERE id = p_certificate_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security policies
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_classifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Categories Access" ON public.categories;
DROP POLICY IF EXISTS "Public Students Access" ON public.students;
DROP POLICY IF EXISTS "Public Faculty Access" ON public.faculty;
DROP POLICY IF EXISTS "Public Certificates Access" ON public.certificates;
DROP POLICY IF EXISTS "Public AI Classifications Access" ON public.ai_classifications;

CREATE POLICY "Public Categories Access" ON public.categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Students Access" ON public.students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Faculty Access" ON public.faculty FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Certificates Access" ON public.certificates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public AI Classifications Access" ON public.ai_classifications FOR ALL USING (true) WITH CHECK (true);


