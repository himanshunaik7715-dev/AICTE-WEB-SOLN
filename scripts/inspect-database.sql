-- Read-only preflight. Run using an authorized SQL editor/connection.
-- Contains no writes and returns schema definitions, not student records.
BEGIN READ ONLY;
SELECT version();
SELECT schemaname, tablename, rowsecurity FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema') ORDER BY 1, 2;
SELECT table_schema, table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
SELECT n.nspname, c.relname, con.conname, pg_get_constraintdef(con.oid)
FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public';
SELECT schemaname, tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public';
SELECT * FROM pg_policies WHERE schemaname IN ('public', 'storage');
SELECT n.nspname, c.relname, t.tgname, pg_get_triggerdef(t.oid)
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND NOT t.tgisinternal;
SELECT p.oid::regprocedure, p.prosecdef, p.proconfig, pg_get_functiondef(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prokind = 'f';
SELECT table_schema, table_name, grantee, privilege_type FROM information_schema.table_privileges
WHERE table_schema IN ('public', 'storage') ORDER BY 1, 2, 3;
SELECT * FROM pg_publication_tables;
SELECT parent.oid::regclass AS parent_table, child.oid::regclass AS child_table,
       pg_get_expr(child.relpartbound, child.oid) AS partition_bound
FROM pg_inherits i JOIN pg_class parent ON parent.oid = i.inhparent
JOIN pg_class child ON child.oid = i.inhrelid;
ROLLBACK;
