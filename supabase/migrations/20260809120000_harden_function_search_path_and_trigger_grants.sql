-- Audit function layer (tiếp theo chuỗi audit view).
-- 1) Pin search_path cho mọi function mình sở hữu trong public (bỏ qua function của extension, vd pgvector).
DO $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS f
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public' AND p.prokind = 'f' AND p.proconfig IS NULL
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, auth, extensions, net, cron, pg_temp', r.f);
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'search_path pinned on % function(s)', n;
END $$;

-- 2) Trigger function không gọi trực tiếp được; EXECUTE chỉ bị kiểm lúc CREATE TRIGGER,
--    không kiểm lúc trigger chạy => gỡ grant thừa cho PUBLIC/anon/authenticated.
DO $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS f
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public' AND p.prorettype = 'trigger'::regtype
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.f);
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'execute revoked on % trigger function(s)', n;
END $$;
