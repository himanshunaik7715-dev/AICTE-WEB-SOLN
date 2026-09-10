BEGIN;
-- A narrow path to complete missing fields on existing student records.
-- Nonempty verified values can only change through administrator approval.
CREATE FUNCTION public.complete_missing_student_fields(patch jsonb) RETURNS public.users
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE u public.users; field text; val text;
BEGIN
 SELECT * INTO u FROM public.users WHERE id=auth.uid()::text AND role='student' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Student profile required'; END IF;
 FOR field,val IN SELECT * FROM jsonb_each_text(patch) LOOP
  IF field NOT IN ('name','studentUid','erpNo','rollNo','phoneNumber','department','course','division','academicBatch') THEN RAISE EXCEPTION 'Protected onboarding field'; END IF;
  IF coalesce(to_jsonb(u)->>field,'')<>'' AND to_jsonb(u)->>field IS DISTINCT FROM val THEN RAISE EXCEPTION 'Existing academic values require administrator approval'; END IF;
 END LOOP;
 IF coalesce(patch->>'phoneNumber',u."phoneNumber") !~ '^[6-9][0-9]{9}$' OR coalesce(patch->>'erpNo',u."erpNo") !~ '^[0-9]{6,12}$' THEN RAISE EXCEPTION 'Invalid contact or ERP value'; END IF;
 UPDATE public.users SET name=coalesce(patch->>'name',name),"studentUid"=coalesce(patch->>'studentUid',"studentUid"),"erpNo"=coalesce(patch->>'erpNo',"erpNo"),"rollNo"=coalesce(patch->>'rollNo',"rollNo"),"phoneNumber"=coalesce(patch->>'phoneNumber',"phoneNumber"),department=coalesce(patch->>'department',department),course=coalesce(patch->>'course',course),division=coalesce(patch->>'division',division),"academicBatch"=coalesce(patch->>'academicBatch',"academicBatch") WHERE id=u.id RETURNING * INTO u;
 RETURN u;
END $$;
REVOKE ALL ON FUNCTION public.complete_missing_student_fields(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_missing_student_fields(jsonb) TO authenticated;
INSERT INTO public.portal_migrations VALUES('004_onboarding_compatibility',now());
COMMIT;
