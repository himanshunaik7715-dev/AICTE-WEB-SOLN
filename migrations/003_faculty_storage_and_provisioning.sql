BEGIN;
CREATE FUNCTION public.save_teacher_details(full_designation text, faculty_id text, image_path text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT FROM public.users WHERE id=auth.uid()::text AND role='admin') THEN RAISE EXCEPTION 'Teacher access required'; END IF;
 IF length(trim(full_designation)) NOT BETWEEN 2 AND 120 OR length(coalesce(faculty_id,''))>64 THEN RAISE EXCEPTION 'Invalid teacher details'; END IF;
 IF image_path IS NOT NULL AND (image_path NOT LIKE auth.uid()::text || '/%' OR NOT EXISTS(SELECT FROM storage.objects WHERE bucket_id='faculty-photos' AND name=image_path)) THEN RAISE EXCEPTION 'Upload your photo before saving'; END IF;
 UPDATE public.teachers SET designation=trim(full_designation),employee_id=nullif(trim(faculty_id),''),photo_path=coalesce(image_path,photo_path),updated_at=now() WHERE user_id=auth.uid()::text;
END $$;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('faculty-photos','faculty-photos',false,2097152,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO NOTHING;
CREATE POLICY faculty_photo_read ON storage.objects FOR SELECT TO authenticated
USING(bucket_id='faculty-photos' AND (split_part(name,'/',1)=auth.uid()::text OR public.current_app_role()='superadmin'));
CREATE POLICY faculty_photo_create ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='faculty-photos' AND split_part(name,'/',1)=auth.uid()::text
 AND EXISTS(SELECT FROM public.users WHERE id=auth.uid()::text AND role='admin'));
-- Replacements use new object paths. Existing photos are preserved; no public writes/deletes.
CREATE FUNCTION public.provision_academic_scope(batch text, department text, course text, division text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF public.current_app_role() IS DISTINCT FROM 'superadmin' THEN RAISE EXCEPTION 'Superadmin access required'; END IF;
 IF batch !~ '^20[0-9]{2}-20[0-9]{2}$' OR right(batch,4)::int-left(batch,4)::int<>4 OR length(trim(department)) NOT BETWEEN 2 AND 120 OR length(trim(course)) NOT BETWEEN 2 AND 80 THEN RAISE EXCEPTION 'Invalid academic scope'; END IF;
 IF left(batch,4)::int>=2025 AND division !~ '^[A-Z]$' THEN RAISE EXCEPTION 'An explicit division is required'; END IF;
 RETURN portal_private.provision_scope(batch,department,course,division);
END $$;
CREATE FUNCTION public.set_reviewer_assignment(reviewer text, academic_scope bigint, reviewer_group text, is_active boolean) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE role_name text; aid bigint;
BEGIN
 IF public.current_app_role() IS DISTINCT FROM 'superadmin' THEN RAISE EXCEPTION 'Superadmin access required'; END IF;
 SELECT role INTO role_name FROM public.users WHERE id=reviewer AND role IN ('cr','admin') AND "tgmApprovalStatus"='approved' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Approved reviewer required'; END IF;
 IF role_name='cr' AND coalesce(reviewer_group,'')<>'' THEN RAISE EXCEPTION 'CR assignments do not have a TG group'; END IF;
 INSERT INTO public.reviewer_assignments(reviewer_id,scope_id,reviewer_role,tg_group,active)
 VALUES(reviewer,academic_scope,role_name,coalesce(reviewer_group,''),is_active)
 ON CONFLICT(reviewer_id,scope_id,reviewer_role,tg_group) DO UPDATE SET active=excluded.active RETURNING id INTO aid;
 -- Inactive links remain as history but are ineffective in all authorization/options queries.
 RETURN aid;
END $$;
REVOKE ALL ON FUNCTION public.save_teacher_details(text,text,text),public.provision_academic_scope(text,text,text,text),public.set_reviewer_assignment(text,bigint,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_teacher_details(text,text,text),public.provision_academic_scope(text,text,text,text),public.set_reviewer_assignment(text,bigint,text,boolean) TO authenticated;
INSERT INTO public.portal_migrations VALUES('003_faculty_storage_and_provisioning',now());
COMMIT;
