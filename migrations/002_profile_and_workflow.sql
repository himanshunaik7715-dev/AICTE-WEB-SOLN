BEGIN;
CREATE FUNCTION public.update_student_profile(patch jsonb) RETURNS public.users
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result public.users;
BEGIN
 IF public.current_app_role() IS DISTINCT FROM 'student' THEN RAISE EXCEPTION 'Student access required'; END IF;
 IF jsonb_typeof(patch)<>'object' OR EXISTS(SELECT FROM jsonb_object_keys(patch) k WHERE k NOT IN ('phoneNumber','driveRootFolderId')) THEN RAISE EXCEPTION 'Only contact and Drive folder fields are editable'; END IF;
 IF patch ? 'phoneNumber' AND coalesce(patch->>'phoneNumber','') !~ '^[6-9][0-9]{9}$' THEN RAISE EXCEPTION 'Invalid phone number'; END IF;
 IF patch ? 'driveRootFolderId' AND coalesce(patch->>'driveRootFolderId','') !~ '^([a-zA-Z0-9_-]{3,}|https://drive\.google\.com/drive/(u/[0-9]+/)?folders/[a-zA-Z0-9_-]+(\?[^ ]*)?)$' THEN RAISE EXCEPTION 'Use a Google Drive folder ID or URL'; END IF;
 UPDATE public.users SET "phoneNumber"=CASE WHEN patch ? 'phoneNumber' THEN patch->>'phoneNumber' ELSE "phoneNumber" END,
 "driveRootFolderId"=CASE WHEN patch ? 'driveRootFolderId' THEN patch->>'driveRootFolderId' ELSE "driveRootFolderId" END
 WHERE id=auth.uid()::text RETURNING * INTO result;
 RETURN result;
END $$;

CREATE FUNCTION public.decide_registration(target text, approve boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE target_id text; actor_name text;
BEGIN
 IF public.current_app_role() IS DISTINCT FROM 'superadmin' THEN RAISE EXCEPTION 'Approved superadmin required'; END IF;
 SELECT name INTO actor_name FROM public.users WHERE id=auth.uid()::text;
 SELECT id INTO target_id FROM public.users WHERE id=target OR lower(email)=lower(target) FOR UPDATE;
 IF target_id IS NULL THEN RAISE EXCEPTION 'Application profile not found; complete registration first'; END IF;
 IF target_id=auth.uid()::text THEN RAISE EXCEPTION 'Cannot decide your own registration'; END IF;
 UPDATE public.users SET "tgmApprovalStatus"=CASE WHEN approve THEN 'approved' ELSE 'rejected' END,
 "approvedBy"=actor_name,"approvedAt"=now()::text WHERE id=target_id AND role IN ('cr','admin','superadmin');
 IF NOT FOUND THEN RAISE EXCEPTION 'Not a staff registration'; END IF;
 UPDATE public.admins SET "approvalStatus"=CASE WHEN approve THEN 'approved' ELSE 'rejected' END,"isWhitelisted"=approve
 WHERE id=target_id OR lower(email)=(SELECT lower(email) FROM public.users WHERE id=target_id);
END $$;

CREATE OR REPLACE FUNCTION public.protect_submission_workflow() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor text:=public.current_app_role(); student public.users;
BEGIN
 IF TG_OP='INSERT' THEN
  IF auth.uid() IS NOT NULL AND auth.role()<>'service_role' THEN NEW."studentId":=auth.uid()::text; END IF;
  SELECT * INTO student FROM public.users WHERE id=NEW."studentId" AND role='student';
  IF NOT FOUND THEN RAISE EXCEPTION 'Student profile required'; END IF;
  NEW."studentName":=student.name; NEW."studentRollNo":=student."rollNo"; NEW."studentErpNo":=student."erpNo";
  NEW."studentDepartment":=student.department; NEW."studentDivision":=student.division;
  IF NEW.status NOT IN ('imported','naming_error','skipped_not_pdf','pending_cr') THEN RAISE EXCEPTION 'Invalid initial submission state'; END IF;
  NEW."isCheckedByCR":=false; NEW."isVerifiedByTGM":=false;
  NEW."crCheckedAt":=NULL; NEW."crCheckedBy":=NULL; NEW."crRemarks":=NULL;
  NEW."tgmVerifiedAt":=NULL; NEW."tgmVerifiedBy":=NULL; NEW."tgmRemarks":=NULL; NEW."resubmissionRequestedBy":=NULL;
 ELSIF actor='student' THEN
  IF OLD.status NOT IN ('imported','naming_error','skipped_not_pdf','rejected','resubmission_requested') THEN RAISE EXCEPTION 'Submitted or approved records cannot be edited'; END IF;
  NEW.id:=OLD.id; NEW."studentId":=OLD."studentId";
  NEW."studentName":=OLD."studentName"; NEW."studentRollNo":=OLD."studentRollNo"; NEW."studentErpNo":=OLD."studentErpNo";
  NEW."studentDepartment":=OLD."studentDepartment"; NEW."studentDivision":=OLD."studentDivision";
  IF NEW.status NOT IN ('imported','naming_error','skipped_not_pdf','pending_cr','rejected','resubmission_requested') THEN RAISE EXCEPTION 'Students cannot approve submissions'; END IF;
  IF OLD.status IN ('rejected','resubmission_requested') THEN NEW.status:='pending_cr'; END IF;
  NEW."isCheckedByCR":=false; NEW."isVerifiedByTGM":=false;
  NEW."crCheckedAt":=NULL; NEW."crCheckedBy":=NULL; NEW."crRemarks":=NULL;
  NEW."tgmVerifiedAt":=NULL; NEW."tgmVerifiedBy":=NULL; NEW."tgmRemarks":=NULL; NEW."resubmissionRequestedBy":=NULL;
 ELSIF actor='cr' THEN
  IF OLD.status<>'pending_cr' OR NEW.status NOT IN ('pending_admin','rejected','resubmission_requested') THEN RAISE EXCEPTION 'Invalid CR transition'; END IF;
  IF (to_jsonb(NEW)-ARRAY['status','isCheckedByCR','crCheckedAt','crCheckedBy','crRemarks','resubmissionRequestedBy','updatedAt']) IS DISTINCT FROM
     (to_jsonb(OLD)-ARRAY['status','isCheckedByCR','crCheckedAt','crCheckedBy','crRemarks','resubmissionRequestedBy','updatedAt']) THEN RAISE EXCEPTION 'CR may only update review fields'; END IF;
  NEW."isCheckedByCR":=NEW.status='pending_admin'; NEW."crCheckedBy":=auth.uid()::text; NEW."crCheckedAt":=now()::text;
  NEW."resubmissionRequestedBy":=CASE WHEN NEW.status='resubmission_requested' THEN 'cr' ELSE NULL END;
 ELSIF actor='admin' THEN
  IF OLD.status<>'pending_admin' OR NOT OLD."isCheckedByCR" OR NEW.status NOT IN ('approved','rejected','resubmission_requested') THEN RAISE EXCEPTION 'Invalid TGM transition'; END IF;
  IF (to_jsonb(NEW)-ARRAY['status','isVerifiedByTGM','tgmVerifiedAt','tgmVerifiedBy','tgmRemarks','resubmissionRequestedBy','updatedAt']) IS DISTINCT FROM
     (to_jsonb(OLD)-ARRAY['status','isVerifiedByTGM','tgmVerifiedAt','tgmVerifiedBy','tgmRemarks','resubmissionRequestedBy','updatedAt']) THEN RAISE EXCEPTION 'TGM may only update review fields'; END IF;
  NEW."isVerifiedByTGM":=NEW.status='approved'; NEW."tgmVerifiedBy":=auth.uid()::text; NEW."tgmVerifiedAt":=now()::text;
  NEW."resubmissionRequestedBy":=CASE WHEN NEW.status='resubmission_requested' THEN 'tgm' ELSE NULL END;
 ELSIF auth.role() IS DISTINCT FROM 'service_role' AND actor IS DISTINCT FROM 'superadmin' THEN RAISE EXCEPTION 'Review access required';
 END IF;
 IF NEW."activityCategoryNo" NOT BETWEEN 1 AND 16 OR NEW."hoursSpent"<0 OR NEW."hoursSpent" IS NULL OR NEW.semester !~ '^SEM_[1-8]$' THEN RAISE EXCEPTION 'Invalid activity values'; END IF;
 IF TG_OP='INSERT' OR actor='student' THEN NEW."calculatedPoints":=floor(NEW."hoursSpent"/4); END IF;
 NEW."updatedAt":=now()::text; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_protect_submission_workflow ON public.submissions;
CREATE TRIGGER trg_protect_submission_workflow BEFORE INSERT OR UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.protect_submission_workflow();
REVOKE ALL ON FUNCTION public.update_student_profile(jsonb),public.decide_registration(text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_student_profile(jsonb),public.decide_registration(text,boolean) TO authenticated;
INSERT INTO public.portal_migrations VALUES('002_profile_and_workflow',now());
COMMIT;
