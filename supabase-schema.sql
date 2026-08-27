-- Secure, minimal Supabase schema for the AICTE Activity Diary.
-- Run this in the Supabase SQL editor after taking a database backup.

CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'student'
    CHECK (role IN ('student', 'cr', 'admin', 'superadmin')),
  "studentUid" TEXT,
  "phoneNumber" TEXT,
  course TEXT,
  "rollNo" TEXT NOT NULL DEFAULT '',
  "erpNo" TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  division TEXT NOT NULL DEFAULT '',
  "academicBatch" TEXT NOT NULL DEFAULT '',
  "photoUrl" TEXT,
  "tgmName" TEXT,
  "tgmId" TEXT,
  "crName" TEXT,
  "crId" TEXT,
  "tgGroup" TEXT,
  "driveRootFolderId" TEXT,
  "tgmApprovalStatus" TEXT NOT NULL DEFAULT 'pending'
    CHECK ("tgmApprovalStatus" IN ('pending', 'approved', 'rejected')),
  "approvedBy" TEXT,
  "approvedAt" TEXT,
  "customRole" TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admins (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  designation TEXT NOT NULL DEFAULT 'Teacher Guardian Mentor (TGM)',
  department TEXT NOT NULL DEFAULT '',
  "addedBy" TEXT NOT NULL DEFAULT '',
  "addedAt" TEXT NOT NULL DEFAULT '',
  "isWhitelisted" BOOLEAN NOT NULL DEFAULT false,
  "approvalStatus" TEXT NOT NULL DEFAULT 'pending'
    CHECK ("approvalStatus" IN ('pending', 'approved', 'rejected'))
);

CREATE TABLE IF NOT EXISTS public.submissions (
  id TEXT PRIMARY KEY,
  "studentId" TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  "studentName" TEXT NOT NULL,
  "studentRollNo" TEXT NOT NULL DEFAULT '',
  "studentErpNo" TEXT NOT NULL DEFAULT '',
  "studentDepartment" TEXT NOT NULL DEFAULT '',
  "studentDivision" TEXT NOT NULL DEFAULT '',
  semester TEXT NOT NULL,
  "activityName" TEXT NOT NULL,
  "conductedBy" TEXT NOT NULL DEFAULT '',
  "activityCategoryNo" INTEGER NOT NULL CHECK ("activityCategoryNo" BETWEEN 1 AND 16),
  "shortDescription" TEXT NOT NULL DEFAULT '',
  "hoursSpent" INTEGER NOT NULL DEFAULT 0 CHECK ("hoursSpent" >= 0),
  "calculatedPoints" INTEGER NOT NULL DEFAULT 0 CHECK ("calculatedPoints" >= 0),
  "currentFileDriveId" TEXT NOT NULL DEFAULT '',
  "fileName" TEXT NOT NULL DEFAULT '',
  "fileDriveIdHistory" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "isCheckedByCR" BOOLEAN NOT NULL DEFAULT false,
  "crCheckedAt" TEXT,
  "crCheckedBy" TEXT,
  "crRemarks" TEXT,
  "isVerifiedByTGM" BOOLEAN NOT NULL DEFAULT false,
  "tgmVerifiedAt" TEXT,
  "tgmVerifiedBy" TEXT,
  "tgmRemarks" TEXT,
  "resubmissionRequestedBy" TEXT
    CHECK ("resubmissionRequestedBy" IN ('cr', 'tgm')),
  status TEXT NOT NULL DEFAULT 'pending_cr'
    CHECK (status IN ('imported','naming_error','skipped_not_pdf','pending_cr',
      'pending_admin','approved','rejected','resubmission_requested')),
  "rejectionReason" TEXT,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (lower(email));
CREATE INDEX IF NOT EXISTS idx_submissions_student ON public.submissions ("studentId");
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.submissions (status);

-- Remove columns and the second certificate subsystem that the application never uses.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS "tgGroup" TEXT,
  DROP COLUMN IF EXISTS password,
  DROP COLUMN IF EXISTS roll_no,
  DROP COLUMN IF EXISTS erp_no,
  DROP COLUMN IF EXISTS academic_batch,
  DROP COLUMN IF EXISTS tgm_name,
  DROP COLUMN IF EXISTS cr_name,
  DROP COLUMN IF EXISTS drive_root_folder_id;

ALTER TABLE public.admins
  DROP COLUMN IF EXISTS role,
  DROP COLUMN IF EXISTS added_at,
  DROP COLUMN IF EXISTS added_by;

ALTER TABLE public.submissions
  DROP COLUMN IF EXISTS student_id,
  DROP COLUMN IF EXISTS student_name,
  DROP COLUMN IF EXISTS student_roll_no,
  DROP COLUMN IF EXISTS student_erp_no,
  DROP COLUMN IF EXISTS student_department,
  DROP COLUMN IF EXISTS student_division,
  DROP COLUMN IF EXISTS activity_name,
  DROP COLUMN IF EXISTS conducted_by,
  DROP COLUMN IF EXISTS activity_category_no,
  DROP COLUMN IF EXISTS short_description,
  DROP COLUMN IF EXISTS hours_spent,
  DROP COLUMN IF EXISTS calculated_points,
  DROP COLUMN IF EXISTS current_file_drive_id,
  DROP COLUMN IF EXISTS file_name,
  DROP COLUMN IF EXISTS file_drive_id_history,
  DROP COLUMN IF EXISTS is_checked_by_cr,
  DROP COLUMN IF EXISTS cr_checked_at,
  DROP COLUMN IF EXISTS cr_checked_by,
  DROP COLUMN IF EXISTS is_verified_by_tgm,
  DROP COLUMN IF EXISTS tgm_verified_at,
  DROP COLUMN IF EXISTS tgm_verified_by,
  DROP COLUMN IF EXISTS rejection_reason,
  DROP COLUMN IF EXISTS created_at,
  DROP COLUMN IF EXISTS updated_at;

DROP TABLE IF EXISTS public.ai_classifications CASCADE;
DROP TABLE IF EXISTS public.certificates CASCADE;
DROP TABLE IF EXISTS public.faculty CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.cr_assignments CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users
  WHERE id = auth.uid()::text AND "tgmApprovalStatus" = 'approved'
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_app_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;

CREATE OR REPLACE FUNCTION public.current_cr_scope()
RETURNS TABLE(division TEXT, academic_batch TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.division, u."academicBatch"
  FROM public.users u
  WHERE u.id = auth.uid()::text
    AND u.role = 'cr'
    AND u."tgmApprovalStatus" = 'approved'
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_cr_scope() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_cr_scope() TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_user_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.email := lower(trim(NEW.email));
  IF NEW.email !~ '^[^@]+@tcetmumbai\.in$' THEN
    RAISE EXCEPTION 'Only @tcetmumbai.in accounts are allowed';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL AND NEW.id <> auth.uid()::text THEN
      RAISE EXCEPTION 'A user may only create their own profile';
    END IF;
    NEW."tgmApprovalStatus" :=
      CASE WHEN NEW.role = 'student' THEN 'approved' ELSE 'pending' END;
    NEW."approvedBy" := NULL;
    NEW."approvedAt" := NULL;
  ELSIF auth.role() IS DISTINCT FROM 'service_role'
    AND public.current_app_role() IS DISTINCT FROM 'superadmin' THEN
    NEW.id := OLD.id;
    NEW.email := OLD.email;
    NEW.role := OLD.role;
    NEW."tgmApprovalStatus" := OLD."tgmApprovalStatus";
    NEW."approvedBy" := OLD."approvedBy";
    NEW."approvedAt" := OLD."approvedAt";
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_user_privileges ON public.users;
CREATE TRIGGER trg_protect_user_privileges
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.protect_user_privileges();

CREATE OR REPLACE FUNCTION public.protect_submission_workflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE app_role TEXT := public.current_app_role();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN NEW."studentId" := auth.uid()::text; END IF;
    NEW.status := 'imported';
    NEW."isCheckedByCR" := false;
    NEW."isVerifiedByTGM" := false;
  ELSIF app_role = 'student' THEN
    NEW."studentId" := OLD."studentId";
    IF OLD.status = 'rejected'
      OR (
        OLD.status = 'resubmission_requested'
        AND OLD."resubmissionRequestedBy" = 'tgm'
      ) THEN
      NEW."isCheckedByCR" := false;
      NEW."crCheckedAt" := NULL;
      NEW."crCheckedBy" := NULL;
      NEW."crRemarks" := NULL;
      NEW."isVerifiedByTGM" := false;
      NEW."tgmVerifiedAt" := NULL;
      NEW."tgmVerifiedBy" := NULL;
      NEW."tgmRemarks" := NULL;
      NEW.status := 'pending_cr';
      NEW."resubmissionRequestedBy" := NULL;
    ELSE
      NEW."isCheckedByCR" := OLD."isCheckedByCR";
      NEW."crCheckedAt" := OLD."crCheckedAt";
      NEW."crCheckedBy" := OLD."crCheckedBy";
      NEW."crRemarks" := OLD."crRemarks";
      NEW."isVerifiedByTGM" := OLD."isVerifiedByTGM";
      NEW."tgmVerifiedAt" := OLD."tgmVerifiedAt";
      NEW."tgmVerifiedBy" := OLD."tgmVerifiedBy";
      NEW."tgmRemarks" := OLD."tgmRemarks";
      NEW.status := CASE
        WHEN OLD.status = 'resubmission_requested' THEN 'pending_cr'
        WHEN OLD.status = 'imported' AND NEW.status = 'pending_cr' THEN 'pending_cr'
        ELSE OLD.status
      END;
      IF OLD.status = 'resubmission_requested' THEN
        NEW."resubmissionRequestedBy" := NULL;
      END IF;
    END IF;
  ELSIF app_role = 'cr' AND NEW.status NOT IN ('pending_admin', 'rejected', 'resubmission_requested') THEN
    RAISE EXCEPTION 'CR is not allowed to set this submission status';
  ELSIF app_role = 'admin' AND NEW.status NOT IN ('approved', 'rejected', 'resubmission_requested') THEN
    RAISE EXCEPTION 'TGM is not allowed to set this submission status';
  END IF;
  NEW."updatedAt" := now()::text;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_submission_workflow ON public.submissions;
CREATE TRIGGER trg_protect_submission_workflow
BEFORE INSERT OR UPDATE ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.protect_submission_workflow();

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Users Access" ON public.users;
DROP POLICY IF EXISTS "Public Admins Access" ON public.admins;
DROP POLICY IF EXISTS "Public Submissions Access" ON public.submissions;
DROP POLICY IF EXISTS users_select ON public.users;
DROP POLICY IF EXISTS users_insert ON public.users;
DROP POLICY IF EXISTS users_update ON public.users;
DROP POLICY IF EXISTS admins_select ON public.admins;
DROP POLICY IF EXISTS admins_insert ON public.admins;
DROP POLICY IF EXISTS admins_manage ON public.admins;
DROP POLICY IF EXISTS submissions_select ON public.submissions;
DROP POLICY IF EXISTS submissions_insert ON public.submissions;
DROP POLICY IF EXISTS submissions_update ON public.submissions;
DROP POLICY IF EXISTS submissions_delete ON public.submissions;

CREATE POLICY users_select ON public.users FOR SELECT TO authenticated
USING (
  id = auth.uid()::text
  OR public.current_app_role() IN ('admin', 'superadmin')
  OR (role IN ('cr', 'admin', 'superadmin') AND "tgmApprovalStatus" = 'approved')
  OR (
    public.current_app_role() = 'cr'
    AND role = 'student'
    AND EXISTS (
      SELECT 1 FROM public.current_cr_scope() cr
      WHERE (
          cr.division = public.users.division
          OR cr.division IS NULL
          OR cr.division = ''
          OR cr.division = 'All Divisions'
        )
        AND (
          cr.academic_batch = public.users."academicBatch"
          OR cr.academic_batch IS NULL
          OR cr.academic_batch = ''
        )
    )
  )
);
CREATE POLICY users_insert ON public.users FOR INSERT TO authenticated
WITH CHECK (id = auth.uid()::text);
CREATE POLICY users_update ON public.users FOR UPDATE TO authenticated
USING (id = auth.uid()::text OR public.current_app_role() = 'superadmin')
WITH CHECK (id = auth.uid()::text OR public.current_app_role() = 'superadmin');

CREATE POLICY admins_select ON public.admins FOR SELECT TO authenticated
USING (
  id = auth.uid()::text
  OR ("approvalStatus" = 'approved' AND "isWhitelisted")
  OR public.current_app_role() = 'superadmin'
);
CREATE POLICY admins_insert ON public.admins FOR INSERT TO authenticated
WITH CHECK (
  (id = auth.uid()::text AND "approvalStatus" = 'pending' AND NOT "isWhitelisted")
  OR public.current_app_role() = 'superadmin'
);
CREATE POLICY admins_manage ON public.admins FOR ALL TO authenticated
USING (public.current_app_role() = 'superadmin')
WITH CHECK (public.current_app_role() = 'superadmin');

CREATE POLICY submissions_select ON public.submissions FOR SELECT TO authenticated
USING (
  "studentId" = auth.uid()::text
  OR public.current_app_role() IN ('admin', 'superadmin')
  OR (
    public.current_app_role() = 'cr'
    AND EXISTS (
      SELECT 1 FROM public.users student
      WHERE student.id = "studentId" AND student."crId" = auth.uid()::text
    )
  )
);
CREATE POLICY submissions_insert ON public.submissions FOR INSERT TO authenticated
WITH CHECK ("studentId" = auth.uid()::text);
CREATE POLICY submissions_update ON public.submissions FOR UPDATE TO authenticated
USING (
  "studentId" = auth.uid()::text
  OR public.current_app_role() IN ('admin', 'superadmin')
  OR (
    public.current_app_role() = 'cr'
    AND EXISTS (
      SELECT 1 FROM public.users student
      WHERE student.id = "studentId" AND student."crId" = auth.uid()::text
    )
  )
);
CREATE POLICY submissions_delete ON public.submissions FOR DELETE TO authenticated
USING ("studentId" = auth.uid()::text OR public.current_app_role() = 'superadmin');

REVOKE ALL ON public.users, public.admins, public.submissions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users, public.admins, public.submissions TO authenticated;
