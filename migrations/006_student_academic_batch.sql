BEGIN;
CREATE OR REPLACE FUNCTION public.protect_user_privileges() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE protected_old jsonb; protected_new jsonb; missing_field text;
BEGIN
 NEW.email:=lower(trim(NEW.email));
 IF NEW.email !~ '^[^@]+@tcetmumbai\.in$' THEN RAISE EXCEPTION 'Institutional email required'; END IF;
 IF TG_OP='INSERT' AND auth.role() IS DISTINCT FROM 'service_role' THEN
  IF NEW.id IS DISTINCT FROM auth.uid()::text OR NOT EXISTS(SELECT FROM auth.users WHERE id=auth.uid() AND lower(email)=NEW.email) THEN RAISE EXCEPTION 'Identity mismatch'; END IF;
  NEW."tgmApprovalStatus":=CASE WHEN NEW.role='student' THEN 'approved' ELSE 'pending' END;
  NEW."approvedBy":=NULL; NEW."approvedAt":=NULL;
  NEW."crId":=NULL; NEW."tgmId":=NULL; NEW."crName":=NULL; NEW."tgmName":=NULL; NEW."tgGroup":=NULL;
 ELSIF TG_OP='UPDATE' THEN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.email IS DISTINCT FROM OLD.email THEN RAISE EXCEPTION 'Identity is immutable'; END IF;
  IF auth.role() IS DISTINCT FROM 'service_role' AND public.current_app_role() IS DISTINCT FROM 'superadmin' THEN
   protected_new:=to_jsonb(NEW)-ARRAY['phoneNumber','driveRootFolderId','crId','crName','tgmId','tgmName','tgGroup','updated_at'];
   protected_old:=to_jsonb(OLD)-ARRAY['phoneNumber','driveRootFolderId','crId','crName','tgmId','tgmName','tgGroup','updated_at'];
   IF OLD.role='student' THEN
    protected_new:=protected_new-ARRAY['name','erpNo','rollNo','department','course','division','academicBatch'];
    protected_old:=protected_old-ARRAY['name','erpNo','rollNo','department','course','division','academicBatch'];
    FOREACH missing_field IN ARRAY ARRAY['name','studentUid','erpNo','rollNo','department','course','division','academicBatch'] LOOP
     IF coalesce(to_jsonb(OLD)->>missing_field,'')='' THEN protected_new:=protected_new-missing_field; protected_old:=protected_old-missing_field; END IF;
    END LOOP;
   END IF;
   IF protected_new IS DISTINCT FROM protected_old
   THEN RAISE EXCEPTION 'Protected profile fields require administrator approval'; END IF;
   IF NEW."crId" IS DISTINCT FROM OLD."crId" AND NOT EXISTS(SELECT FROM public.student_reviewer_links l JOIN public.reviewer_assignments a ON a.id=l.assignment_id WHERE l.student_id=NEW.id AND a.reviewer_id=NEW."crId" AND a.reviewer_role='cr') THEN RAISE EXCEPTION 'Invalid CR assignment'; END IF;
   IF (NEW."tgmId",NEW."tgGroup") IS DISTINCT FROM (OLD."tgmId",OLD."tgGroup") AND NOT EXISTS(SELECT FROM public.student_reviewer_links l JOIN public.reviewer_assignments a ON a.id=l.assignment_id WHERE l.student_id=NEW.id AND a.reviewer_id=NEW."tgmId" AND a.tg_group=NEW."tgGroup" AND a.reviewer_role='admin') THEN RAISE EXCEPTION 'Invalid TGM assignment'; END IF;
  END IF;
  IF (NEW."academicBatch",NEW.department,NEW.course,NEW.division) IS DISTINCT FROM (OLD."academicBatch",OLD.department,OLD.course,OLD.division) THEN
   NEW."crId":=NULL; NEW."crName":=NULL; NEW."tgmId":=NULL; NEW."tgmName":=NULL; NEW."tgGroup":=NULL;
  END IF;
 END IF;
 NEW.updated_at:=now(); RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.edit_student_profile(patch jsonb) RETURNS public.users
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u public.users; saved public.users; s public.academic_scopes;
BEGIN
 IF public.current_app_role() IS DISTINCT FROM 'student' THEN RAISE EXCEPTION 'Student access required'; END IF;
 IF jsonb_typeof(patch) IS DISTINCT FROM 'object' OR EXISTS(SELECT FROM jsonb_object_keys(patch) k WHERE k NOT IN ('name','erpNo','rollNo','phoneNumber','scope_id')) THEN RAISE EXCEPTION 'Protected profile field'; END IF;
 SELECT * INTO u FROM public.users WHERE id=auth.uid()::text AND role='student' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Student profile required'; END IF;
 IF length(trim(coalesce(patch->>'name',''))) NOT BETWEEN 2 AND 120 OR coalesce(patch->>'erpNo','') !~ '^[0-9]{6,12}$' OR length(trim(coalesce(patch->>'rollNo',''))) NOT BETWEEN 1 AND 20 OR coalesce(patch->>'phoneNumber','') !~ '^[6-9][0-9]{9}$' THEN RAISE EXCEPTION 'Enter a valid name, ERP, roll number and phone number'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(patch->>'erpNo',0));
 IF EXISTS(SELECT FROM public.users WHERE "erpNo"=patch->>'erpNo' AND id<>u.id) THEN RAISE EXCEPTION 'ERP is already used by another profile'; END IF;
 SELECT * INTO s FROM public.academic_scopes WHERE id=(patch->>'scope_id')::bigint AND enabled FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Select a valid academic option for the selected batch'; END IF;
 UPDATE public.users SET name=trim(patch->>'name'),"erpNo"=patch->>'erpNo',"rollNo"=trim(patch->>'rollNo'),"phoneNumber"=patch->>'phoneNumber',"academicBatch"=s.academic_batch,department=s.department,course=s.course,division=s.division WHERE id=u.id RETURNING * INTO saved;
 INSERT INTO portal_private.profile_edit_audit(student_id,old_profile,new_profile) VALUES(u.id,to_jsonb(u),to_jsonb(saved));
 RETURN saved;
END $$;
REVOKE ALL ON FUNCTION public.edit_student_profile(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.edit_student_profile(jsonb) TO authenticated;
INSERT INTO public.portal_migrations VALUES('006_student_academic_batch',now());
COMMIT;

