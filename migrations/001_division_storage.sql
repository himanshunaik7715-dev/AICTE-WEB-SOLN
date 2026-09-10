-- Additive compatibility migration. Never run supabase-schema.sql as a prerequisite.
-- Apply only after a verified backup and live catalog review. Existing rows/IDs remain.
BEGIN;
SET LOCAL lock_timeout = '10s';
CREATE SCHEMA IF NOT EXISTS portal_private;
REVOKE ALL ON SCHEMA portal_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public.portal_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.academic_scopes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  academic_batch text NOT NULL, department text NOT NULL, course text NOT NULL, division text NOT NULL,
  partition_name text UNIQUE, enabled boolean NOT NULL DEFAULT true,
  UNIQUE(academic_batch,department,course,division)
);
CREATE TABLE public.student_registry (
  student_id text PRIMARY KEY REFERENCES public.users(id),
  scope_id bigint NOT NULL REFERENCES public.academic_scopes(id),
  UNIQUE(student_id,scope_id)
);
CREATE TABLE public.students (
  student_id text NOT NULL, scope_id bigint NOT NULL,
  student_uid text, erp_no text, roll_no text, phone_number text,
  PRIMARY KEY(student_id,scope_id),
  FOREIGN KEY(student_id,scope_id) REFERENCES public.student_registry(student_id,scope_id)
    DEFERRABLE INITIALLY DEFERRED
) PARTITION BY LIST(scope_id);
CREATE TABLE public.teachers (
  user_id text PRIMARY KEY REFERENCES public.users(id), department text NOT NULL DEFAULT '',
  designation text NOT NULL DEFAULT 'Teacher Guardian Mentor (TGM)', employee_id text,
  photo_path text, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.crs (user_id text PRIMARY KEY REFERENCES public.users(id));
CREATE TABLE public.super_admins (user_id text PRIMARY KEY REFERENCES public.users(id));
CREATE TABLE public.reviewer_assignments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reviewer_id text NOT NULL REFERENCES public.users(id), scope_id bigint NOT NULL REFERENCES public.academic_scopes(id),
  reviewer_role text NOT NULL CHECK(reviewer_role IN ('cr','admin')),
  tg_group text NOT NULL DEFAULT '', active boolean NOT NULL DEFAULT true,
  UNIQUE(reviewer_id,scope_id,reviewer_role,tg_group), UNIQUE(id,scope_id,reviewer_role)
);
CREATE TABLE public.student_reviewer_links (
  student_id text NOT NULL, scope_id bigint NOT NULL,
  reviewer_role text NOT NULL CHECK(reviewer_role IN ('cr','admin')), assignment_id bigint NOT NULL,
  PRIMARY KEY(student_id,reviewer_role),
  FOREIGN KEY(student_id,scope_id) REFERENCES public.student_registry(student_id,scope_id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY(assignment_id,scope_id,reviewer_role) REFERENCES public.reviewer_assignments(id,scope_id,reviewer_role)
);
CREATE TABLE public.academic_change_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id text NOT NULL REFERENCES public.users(id), original_scope_id bigint NOT NULL REFERENCES public.academic_scopes(id),
  requested_scope_id bigint NOT NULL REFERENCES public.academic_scopes(id), reason text NOT NULL CHECK(length(reason) BETWEEN 5 AND 1000),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz, decided_by text REFERENCES public.users(id), remarks text
);
CREATE UNIQUE INDEX academic_one_pending ON public.academic_change_requests(student_id) WHERE status='pending';
CREATE TABLE portal_private.assignment_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, student_id text NOT NULL,
  old_cr_id text, old_tgm_id text, reason text NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION portal_private.department_key(value text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
 SELECT CASE WHEN lower(regexp_replace(coalesce(value,''),'[^a-zA-Z]','','g'))
 IN ('iot','internetofthingsiot','cseiot','cseinternetofthings') THEN 'Internet of Things (IoT)'
 ELSE trim(coalesce(value,'')) END
$$;
CREATE OR REPLACE FUNCTION portal_private.course_key(course text, department text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE WHEN portal_private.department_key(department)='Internet of Things (IoT)'
 AND (coalesce(trim(course),'')='' OR lower(regexp_replace(course,'[^a-zA-Z]','','g')) IN ('iot','cseiot','cseinternetofthings'))
 THEN 'CSE(IOT)' ELSE coalesce(nullif(upper(trim(course)),''),upper(trim(department))) END
$$;
CREATE OR REPLACE FUNCTION portal_private.provision_scope(batch text, dept text, course_code text, div text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE sid bigint; pname text;
BEGIN
  PERFORM pg_advisory_xact_lock(20250908);
  INSERT INTO public.academic_scopes(academic_batch,department,course,division)
  VALUES(trim(coalesce(batch,'')),portal_private.department_key(dept),portal_private.course_key(course_code,dept),upper(trim(coalesce(div,''))))
  ON CONFLICT(academic_batch,department,course,division) DO NOTHING;
  SELECT id INTO sid FROM public.academic_scopes WHERE academic_batch=trim(coalesce(batch,''))
    AND department=portal_private.department_key(dept) AND course=portal_private.course_key(course_code,dept) AND division=upper(trim(coalesce(div,'')));
  pname := 'students_' || regexp_replace(coalesce(nullif(batch,''),'legacy'),'[^0-9]','_','g') || '_'
    || CASE WHEN portal_private.department_key(dept)='Internet of Things (IoT)' THEN 'iot' ELSE 'course' END
    || '_div_' || lower(regexp_replace(coalesce(nullif(div,''),'legacy'),'[^a-zA-Z0-9]','','g')) || '_s' || sid;
  IF NOT EXISTS(SELECT FROM public.academic_scopes WHERE id=sid AND partition_name IS NOT NULL) THEN
    EXECUTE format('CREATE TABLE portal_private.%I PARTITION OF public.students FOR VALUES IN (%s)',pname,sid);
    EXECUTE format('ALTER TABLE portal_private.%I ENABLE ROW LEVEL SECURITY',pname);
    EXECUTE format('REVOKE ALL ON portal_private.%I FROM PUBLIC, anon, authenticated',pname);
    UPDATE public.academic_scopes SET partition_name=pname WHERE id=sid;
  END IF;
  RETURN sid;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA portal_private FROM PUBLIC,anon,authenticated;

-- Every existing student/reviewer scope gets a real partition, including legacy records.
DO $$ DECLARE u record; BEGIN
 FOR u IN SELECT DISTINCT "academicBatch",department,course,division FROM public.users WHERE role IN ('student','cr','admin') LOOP
   PERFORM portal_private.provision_scope(u."academicBatch",u.department,u.course,u.division);
 END LOOP;
END $$;
INSERT INTO public.student_registry(student_id,scope_id)
SELECT u.id,s.id FROM public.users u JOIN public.academic_scopes s ON s.academic_batch=trim(coalesce(u."academicBatch",''))
 AND s.department=portal_private.department_key(u.department) AND s.course=portal_private.course_key(u.course,u.department)
 AND s.division=upper(trim(coalesce(u.division,''))) WHERE u.role='student';
INSERT INTO public.students SELECT u.id,r.scope_id,u."studentUid",u."erpNo",u."rollNo",u."phoneNumber"
FROM public.users u JOIN public.student_registry r ON r.student_id=u.id;
INSERT INTO public.teachers(user_id,department) SELECT id,department FROM public.users WHERE role='admin';
INSERT INTO public.crs SELECT id FROM public.users WHERE role='cr';
INSERT INTO public.super_admins SELECT id FROM public.users WHERE role='superadmin';
INSERT INTO public.reviewer_assignments(reviewer_id,scope_id,reviewer_role,tg_group)
SELECT u.id,s.id,u.role,trim(g.value) FROM public.users u JOIN public.academic_scopes s
 ON s.academic_batch=trim(coalesce(u."academicBatch",'')) AND s.department=portal_private.department_key(u.department)
 AND s.course=portal_private.course_key(u.course,u.department) AND s.division=upper(trim(coalesce(u.division,'')))
 CROSS JOIN LATERAL unnest(CASE WHEN u.role='admin' THEN string_to_array(coalesce(nullif(u."customRole",''),''),',') ELSE ARRAY[''] END) g(value)
 WHERE u.role IN ('cr','admin') ON CONFLICT DO NOTHING;
INSERT INTO public.student_reviewer_links(student_id,scope_id,reviewer_role,assignment_id)
SELECT u.id,r.scope_id,a.reviewer_role,min(a.id) FROM public.users u JOIN public.student_registry r ON r.student_id=u.id
JOIN public.reviewer_assignments a ON a.scope_id=r.scope_id AND ((a.reviewer_role='cr' AND a.reviewer_id=u."crId")
 OR (a.reviewer_role='admin' AND a.reviewer_id=u."tgmId" AND a.tg_group=coalesce(u."tgGroup",'')))
GROUP BY u.id,r.scope_id,a.reviewer_role;
-- Preserve incompatible old values as audit evidence; effective authorization ignores them.
INSERT INTO portal_private.assignment_audit(student_id,old_cr_id,old_tgm_id,reason)
SELECT u.id,u."crId",u."tgmId",'Legacy assignment requires reconciliation'
FROM public.users u WHERE u.role='student' AND (
 (nullif(u."crId",'') IS NOT NULL AND NOT EXISTS(SELECT FROM public.student_reviewer_links l WHERE l.student_id=u.id AND l.reviewer_role='cr')) OR
 (nullif(u."tgmId",'') IS NOT NULL AND NOT EXISTS(SELECT FROM public.student_reviewer_links l WHERE l.student_id=u.id AND l.reviewer_role='admin')));

CREATE OR REPLACE FUNCTION public.current_app_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT role FROM public.users WHERE id=auth.uid()::text AND "tgmApprovalStatus"='approved'
$$;
CREATE OR REPLACE FUNCTION public.portal_can_read_student(target text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT target=auth.uid()::text OR public.current_app_role()='superadmin' OR EXISTS(
 SELECT FROM public.student_registry r JOIN public.reviewer_assignments a ON a.scope_id=r.scope_id
 JOIN public.users reviewer ON reviewer.id=a.reviewer_id
 JOIN public.academic_scopes scope ON scope.id=r.scope_id
 WHERE r.student_id=target AND a.reviewer_id=auth.uid()::text AND a.active AND scope.enabled
 AND reviewer.role=a.reviewer_role AND reviewer."tgmApprovalStatus"='approved'
 AND (scope.academic_batch < '2025' OR scope.division ~ '^[A-Z]$')
 AND (a.reviewer_role='cr' OR EXISTS(SELECT FROM public.student_reviewer_links l
 WHERE l.student_id=target AND l.assignment_id=a.id)))
$$;
CREATE OR REPLACE FUNCTION portal_private.sync_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE sid bigint; old_sid bigint;
BEGIN
 IF NEW.role='student' THEN
  SELECT id INTO sid FROM public.academic_scopes WHERE academic_batch=trim(coalesce(NEW."academicBatch",''))
   AND department=portal_private.department_key(NEW.department) AND course=portal_private.course_key(NEW.course,NEW.department)
   AND division=upper(trim(coalesce(NEW.division,''))) AND enabled;
  IF sid IS NULL THEN RAISE EXCEPTION 'Academic scope is not provisioned; contact administration'; END IF;
  SELECT scope_id INTO old_sid FROM public.student_registry WHERE student_id=NEW.id FOR UPDATE;
  IF old_sid IS DISTINCT FROM sid AND old_sid IS NOT NULL THEN
   INSERT INTO portal_private.assignment_audit(student_id,old_cr_id,old_tgm_id,reason)
   VALUES(NEW.id,OLD."crId",OLD."tgmId",'Academic scope changed');
   DELETE FROM public.student_reviewer_links WHERE student_id=NEW.id;
  END IF;
  INSERT INTO public.student_registry VALUES(NEW.id,sid) ON CONFLICT(student_id) DO UPDATE SET scope_id=excluded.scope_id;
  UPDATE public.students SET scope_id=sid,student_uid=NEW."studentUid",erp_no=NEW."erpNo",roll_no=NEW."rollNo",phone_number=NEW."phoneNumber" WHERE student_id=NEW.id;
  IF NOT FOUND THEN INSERT INTO public.students VALUES(NEW.id,sid,NEW."studentUid",NEW."erpNo",NEW."rollNo",NEW."phoneNumber"); END IF;
 ELSIF NEW.role='admin' THEN
  INSERT INTO public.teachers(user_id,department) VALUES(NEW.id,NEW.department) ON CONFLICT(user_id) DO UPDATE SET department=excluded.department;
 ELSIF NEW.role='cr' THEN INSERT INTO public.crs VALUES(NEW.id) ON CONFLICT DO NOTHING;
 ELSIF NEW.role='superadmin' THEN INSERT INTO public.super_admins VALUES(NEW.id) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER portal_sync_profile AFTER INSERT OR UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION portal_private.sync_profile();

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
-- Replace known baseline trigger; fail closed even if the baseline was never applied.
DROP TRIGGER IF EXISTS trg_protect_user_privileges ON public.users;
CREATE TRIGGER trg_protect_user_privileges BEFORE INSERT OR UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.protect_user_privileges();

CREATE FUNCTION public.get_reviewer_options() RETURNS TABLE(assignment_id bigint,reviewer_id text,reviewer_role text,name text,tg_group text,scope_id bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT a.id,u.id,a.reviewer_role,u.name,a.tg_group,a.scope_id FROM public.student_registry r
 JOIN public.reviewer_assignments a ON a.scope_id=r.scope_id JOIN public.users u ON u.id=a.reviewer_id
 JOIN public.academic_scopes s ON s.id=r.scope_id
 WHERE r.student_id=auth.uid()::text AND a.active AND u.role=a.reviewer_role AND u."tgmApprovalStatus"='approved' AND s.enabled
 AND (s.academic_batch < '2025' OR s.division ~ '^[A-Z]$') ORDER BY a.reviewer_role,u.name,a.tg_group
$$;
CREATE FUNCTION public.assign_student_reviewer(candidate_id bigint) RETURNS public.users
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.reviewer_assignments; sid bigint; result public.users;
BEGIN
 SELECT * INTO result FROM public.users WHERE id=auth.uid()::text AND role='student' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Student access required'; END IF;
 SELECT scope_id INTO sid FROM public.student_registry WHERE student_id=result.id FOR UPDATE;
 SELECT * INTO a FROM public.reviewer_assignments WHERE id=candidate_id FOR UPDATE;
 IF NOT FOUND OR a.scope_id<>sid OR NOT EXISTS(SELECT FROM public.get_reviewer_options() o WHERE o.assignment_id=candidate_id) THEN RAISE EXCEPTION 'Reviewer is outside your verified academic scope'; END IF;
 INSERT INTO public.student_reviewer_links VALUES(result.id,sid,a.reviewer_role,a.id)
 ON CONFLICT(student_id,reviewer_role) DO UPDATE SET scope_id=excluded.scope_id,assignment_id=excluded.assignment_id;
 IF a.reviewer_role='cr' THEN
  UPDATE public.users SET "crId"=a.reviewer_id,"crName"=(SELECT name FROM public.users WHERE id=a.reviewer_id) WHERE id=result.id RETURNING * INTO result;
 ELSE
  UPDATE public.users SET "tgmId"=a.reviewer_id,"tgmName"=(SELECT name FROM public.users WHERE id=a.reviewer_id),"tgGroup"=a.tg_group WHERE id=result.id RETURNING * INTO result;
 END IF;
 RETURN result;
END $$;
CREATE FUNCTION public.request_academic_change(destination_scope bigint, change_reason text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE sid bigint; rid bigint;
BEGIN
 SELECT scope_id INTO sid FROM public.student_registry WHERE student_id=auth.uid()::text;
 IF sid IS NULL OR public.current_app_role()<>'student' THEN RAISE EXCEPTION 'Student access required'; END IF;
 IF sid=destination_scope OR NOT EXISTS(SELECT FROM public.academic_scopes WHERE id=destination_scope AND enabled) THEN RAISE EXCEPTION 'Invalid destination scope'; END IF;
 INSERT INTO public.academic_change_requests(student_id,original_scope_id,requested_scope_id,reason) VALUES(auth.uid()::text,sid,destination_scope,trim(change_reason)) RETURNING id INTO rid;
 RETURN rid;
END $$;
CREATE FUNCTION public.decide_academic_change(request_id bigint, approve boolean, decision_remarks text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.academic_change_requests; s public.academic_scopes; current_scope bigint;
BEGIN
 IF public.current_app_role() IS DISTINCT FROM 'superadmin' THEN RAISE EXCEPTION 'Superadmin access required'; END IF;
 SELECT * INTO r FROM public.academic_change_requests WHERE id=request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
 IF r.status<>'pending' THEN RAISE EXCEPTION 'Request already decided'; END IF;
 PERFORM 1 FROM public.users WHERE id=r.student_id FOR UPDATE;
 SELECT scope_id INTO current_scope FROM public.student_registry WHERE student_id=r.student_id FOR UPDATE;
 IF current_scope<>r.original_scope_id THEN RAISE EXCEPTION 'Student scope changed; refresh the request'; END IF;
 SELECT * INTO s FROM public.academic_scopes WHERE id=r.requested_scope_id AND enabled;
 IF NOT FOUND THEN RAISE EXCEPTION 'Scope is unavailable'; END IF;
 IF approve THEN
  UPDATE public.users SET "academicBatch"=s.academic_batch,department=s.department,course=s.course,division=s.division WHERE id=r.student_id;
 END IF;
 UPDATE public.academic_change_requests SET status=CASE WHEN approve THEN 'approved' ELSE 'rejected' END,decided_at=now(),decided_by=auth.uid()::text,remarks=decision_remarks WHERE id=r.id;
END $$;

-- Remove legacy permissive policies before installing the complete policy set.
-- Flush deferred backfill FK checks before ALTER TABLE on PostgreSQL.
SET CONSTRAINTS ALL IMMEDIATE;
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT schemaname,tablename,policyname FROM pg_policies WHERE schemaname='public' AND tablename IN ('users','admins','submissions') LOOP
 EXECUTE format('DROP POLICY %I ON %I.%I',p.policyname,p.schemaname,p.tablename); END LOOP;
END $$;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_read ON public.users FOR SELECT TO authenticated USING(id=auth.uid()::text OR public.current_app_role()='superadmin' OR (role='student' AND public.portal_can_read_student(id)));
CREATE POLICY users_create ON public.users FOR INSERT TO authenticated WITH CHECK(id=auth.uid()::text);
CREATE POLICY users_modify ON public.users FOR UPDATE TO authenticated USING(id=auth.uid()::text OR public.current_app_role()='superadmin') WITH CHECK(id=auth.uid()::text OR public.current_app_role()='superadmin');
CREATE POLICY admins_read ON public.admins FOR SELECT TO authenticated USING(id=auth.uid()::text OR public.current_app_role()='superadmin');
CREATE POLICY admins_create ON public.admins FOR INSERT TO authenticated WITH CHECK((id=auth.uid()::text AND NOT "isWhitelisted" AND "approvalStatus"='pending') OR public.current_app_role()='superadmin');
CREATE POLICY admins_manage ON public.admins FOR ALL TO authenticated USING(public.current_app_role()='superadmin') WITH CHECK(public.current_app_role()='superadmin');
CREATE POLICY submissions_read ON public.submissions FOR SELECT TO authenticated USING(public.portal_can_read_student("studentId"));
CREATE POLICY submissions_create ON public.submissions FOR INSERT TO authenticated WITH CHECK("studentId"=auth.uid()::text AND public.current_app_role()='student');
CREATE POLICY submissions_modify ON public.submissions FOR UPDATE TO authenticated USING(public.portal_can_read_student("studentId")) WITH CHECK(public.portal_can_read_student("studentId"));
-- No DELETE policy: preserve submitted academic records.
REVOKE ALL ON public.users,public.admins,public.submissions FROM anon;
REVOKE UPDATE ON public.users FROM authenticated;
GRANT SELECT,INSERT ON public.users TO authenticated;
GRANT UPDATE("phoneNumber","driveRootFolderId") ON public.users TO authenticated;
-- Privileged/profile/assignment mutations use audited RPCs, not broad browser updates.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['academic_scopes','student_registry','students','teachers','crs','super_admins','reviewer_assignments','student_reviewer_links','academic_change_requests','portal_migrations'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
 END LOOP;
END $$;
CREATE POLICY scopes_read ON public.academic_scopes FOR SELECT TO authenticated USING(enabled);
CREATE POLICY registry_read ON public.student_registry FOR SELECT TO authenticated USING(public.portal_can_read_student(student_id));
CREATE POLICY students_read ON public.students FOR SELECT TO authenticated USING(public.portal_can_read_student(student_id));
CREATE POLICY teachers_read ON public.teachers FOR SELECT TO authenticated USING(user_id=auth.uid()::text OR public.current_app_role()='superadmin');
CREATE POLICY crs_read ON public.crs FOR SELECT TO authenticated USING(user_id=auth.uid()::text OR public.current_app_role()='superadmin');
CREATE POLICY superadmins_read ON public.super_admins FOR SELECT TO authenticated USING(user_id=auth.uid()::text OR public.current_app_role()='superadmin');
CREATE POLICY assignments_read ON public.reviewer_assignments FOR SELECT TO authenticated USING(reviewer_id=auth.uid()::text OR public.current_app_role()='superadmin');
CREATE POLICY links_read ON public.student_reviewer_links FOR SELECT TO authenticated USING(public.portal_can_read_student(student_id));
CREATE POLICY requests_read ON public.academic_change_requests FOR SELECT TO authenticated USING(student_id=auth.uid()::text OR public.current_app_role()='superadmin');
REVOKE ALL ON FUNCTION public.get_reviewer_options(),public.assign_student_reviewer(bigint),public.request_academic_change(bigint,text),public.decide_academic_change(bigint,boolean,text),public.portal_can_read_student(text),public.current_app_role() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_reviewer_options(),public.assign_student_reviewer(bigint),public.request_academic_change(bigint,text),public.decide_academic_change(bigint,boolean,text),public.portal_can_read_student(text),public.current_app_role() TO authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA portal_private FROM PUBLIC,anon,authenticated;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.users WHERE role='student')<>(SELECT count(*) FROM public.students) THEN RAISE EXCEPTION 'Student backfill count mismatch'; END IF;
END $$;
INSERT INTO public.portal_migrations(version) VALUES('001_division_storage');
COMMIT;

