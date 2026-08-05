-- =====================================================================
-- Lock the tables the consolidated RLS migration deliberately left alone.
--
-- 20260804020000_rls_consolidated.sql governs eight tables and explicitly
-- does not touch the rest, on the reasoning that dropping policies it did
-- not write could turn a working table into deny-all. Correct as a default,
-- but it left seven tables unexamined. Probing them after that migration
-- landed, as a NON-ADMIN logged-in family:
--
--   table                  rows   anon              authenticated
--   _backup_matches           9   DENIED (42501)    9 ROWS      <-- leak
--   _backup_messages          2   DENIED (42501)    2 ROWS      <-- leak
--   _backup_notifications    48   DENIED (42501)    48 ROWS     <-- leak
--   verifications             0   DENIED (42501)    0 ROWS
--   availability              0   DENIED (42501)    0 ROWS
--   applications              3   DENIED (42501)    0 ROWS      (already scoped)
--   reviews                   0   DENIED (42501)    0 ROWS
--
-- The three `_backup_*` tables are copies of matches, messages and
-- notifications taken before some earlier change. Locking the originals
-- while their backups stay world-readable to any logged-in account defeats
-- the entire exercise: 48 notifications and 2 message bodies were readable
-- by every user on the platform. anon was already shut out — the previous
-- migration's blanket REVOKE covered them — but authenticated was not.
--
-- The empty tables (verifications, availability, reviews) leak nothing
-- today only because they contain nothing. They are landmines the moment
-- anything writes to them, and `verifications` in particular is the table
-- name matching the private identity-document bucket. They get locked too.
--
-- Nothing in src/ reads ANY of these seven — verified by grep; the four
-- `verifications` hits in the app are all `supabase.storage.from(...)`,
-- the storage bucket, not this table. So revoking client access costs the
-- product nothing.
--
-- WHY REVOKE RATHER THAN DROP: these are the founder's backups. Revoking
-- the grants makes them unreachable from the browser while leaving them
-- fully intact for service_role and the SQL Editor. Dropping them is a
-- separate decision and this migration does not make it.
--
-- Idempotent. Safe to re-run. One transaction.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. No client role reaches these tables at all. PostgREST only exposes
--    what anon/authenticated hold privileges on, so this removes them
--    from the API surface entirely rather than relying on a policy.
-- ---------------------------------------------------------------------

REVOKE ALL PRIVILEGES ON TABLE
  public._backup_matches,
  public._backup_messages,
  public._backup_notifications,
  public.verifications,
  public.availability,
  public.applications,
  public.reviews
FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Belt and braces: enable RLS with no permissive policy, so that even
--    if a future migration re-grants SELECT by accident (a blanket
--    `GRANT ... ON ALL TABLES IN SCHEMA public`, which is exactly how
--    this happened the first time), the rows still do not come back.
--    Grants and RLS fail independently; requiring both to be wrong is
--    the point.
-- ---------------------------------------------------------------------

DO $$
DECLARE
  t text;
  pol record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    '_backup_matches','_backup_messages','_backup_notifications',
    'verifications','availability','applications','reviews'
  ] LOOP
    -- Skip anything that does not exist, so the file survives a future
    -- cleanup that drops the backups.
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      RAISE NOTICE 'skipping %, not present', t;
      CONTINUE;
    END IF;

    -- Drop existing policies: with no grants they are unreachable anyway,
    -- and leaving a permissive one behind would quietly re-open the table
    -- the moment a grant reappears.
    FOR pol IN SELECT policyname FROM pg_policies
               WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
      RAISE NOTICE 'dropped policy %.%', t, pol.policyname;
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    RAISE NOTICE 'locked % (RLS on, no policies, no client grants)', t;
  END LOOP;
END $$;

COMMIT;


-- =====================================================================
-- VERIFICATION — runs after COMMIT.
-- =====================================================================

-- A. No client role holds any privilege on the seven. Expect ZERO rows.
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon','authenticated')
  AND table_name IN ('_backup_matches','_backup_messages','_backup_notifications',
                     'verifications','availability','applications','reviews')
ORDER BY table_name, grantee;

-- B. All seven have RLS on and zero policies. Expect rls_enabled = true
--    and policy_count = 0 for every row present.
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       (SELECT count(*) FROM pg_policies p
         WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policy_count
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND c.relname IN ('_backup_matches','_backup_messages','_backup_notifications',
                    'verifications','availability','applications','reviews')
ORDER BY c.relname;

-- C. Whole-schema recount, now that both migrations are in. Every public
--    table should be accounted for: 26 policies across the 8 governed
--    tables, and 0 across everything else.
SELECT
  CASE WHEN tablename IN ('users','family_profiles','caregiver_profiles',
                          'service_requests','matches','messages',
                          'notifications','agent_decisions')
       THEN 'governed' ELSE 'other' END AS bucket,
  count(*) AS policies
FROM pg_policies WHERE schemaname = 'public'
GROUP BY 1 ORDER BY 1;

-- D. Nothing anywhere in public is blanket-true. Expect ZERO rows.
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (coalesce(qual,'') IN ('true','(true)')
    OR coalesce(with_check,'') IN ('true','(true)'));


-- =====================================================================
-- ROLLBACK
--   GRANT SELECT ON public._backup_matches, public._backup_messages,
--                   public._backup_notifications, public.verifications,
--                   public.availability, public.applications, public.reviews
--     TO anon, authenticated;
--   -- and DISABLE ROW LEVEL SECURITY on each if you need the old behaviour.
-- =====================================================================
