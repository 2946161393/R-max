-- =====================================================================
-- Lock the tables the consolidated RLS migration deliberately left alone.
--
-- 20260804020000_rls_consolidated.sql governs eight tables and explicitly
-- does not touch the rest, on the reasoning that dropping policies it did
-- not write could turn a working table into deny-all. Correct as a default,
-- but it left the remaining tables unexamined. This closes them.
--
-- ── WHY THIS FILE WAS REISSUED ───────────────────────────────────────
-- The first version failed with 42P01. It named its targets in one static
-- statement:
--
--     REVOKE ALL PRIVILEGES ON TABLE public.a, public.b, public.c FROM ...
--
-- A static multi-table reference is resolved as a whole at parse time, so
-- the moment ONE table in the list is gone the entire statement errors and
-- the transaction dies — even though the DO block further down was already
-- existence-guarded. Three `_backup_*` tables were dropped between writing
-- and running it, and that was enough.
--
-- Every table reference here is now dynamic, inside a guard: the loop looks
-- the table up in pg_class first and skips it silently if it is absent. The
-- file therefore survives any further drops, and re-running it is a no-op.
--
-- ── WHAT WAS FOUND, AND WHAT REMAINS ─────────────────────────────────
-- Probed after 20260804020000 landed, as a NON-ADMIN logged-in family:
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
-- The three `_backup_*` copies of matches, messages and notifications were
-- readable in full by every logged-in account — locking the originals while
-- their backups stayed open would have defeated the whole exercise. They
-- have since been DROPPED, which resolves them permanently and is why this
-- file no longer mentions them outside this note.
--
-- The four that remain leak nothing today only because three of them are
-- empty and `applications` already carries a restrictive policy. They are
-- landmines the moment anything writes to them — `verifications` in
-- particular shares its name with the private identity-document bucket.
--
-- Nothing in src/ reads any of the four. Verified by grep: the four
-- `verifications` hits in the app are all `supabase.storage.from(...)`,
-- the storage bucket, not this table. `applications` is legacy, superseded
-- by matches. So revoking client access costs the product nothing.
--
-- WHY REVOKE RATHER THAN DROP: dropping is a data decision and this is a
-- security migration. Revoking makes them unreachable from the browser
-- while leaving them intact for service_role and the SQL Editor.
--
-- Idempotent. Safe to re-run. One transaction.
-- =====================================================================

BEGIN;

DO $$
DECLARE
  t        text;
  pol      record;
  locked   int := 0;
  skipped  int := 0;
BEGIN
  -- The ungoverned set. Add to this list rather than writing a new file;
  -- absent names are skipped, so stale entries are harmless.
  FOREACH t IN ARRAY ARRAY[
    'verifications',
    'availability',
    'applications',
    'reviews'
  ] LOOP

    -- GUARD. Every reference below is built from `t` and executed only
    -- past this point, so a dropped table costs a NOTICE and nothing else.
    IF NOT EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      RAISE NOTICE 'skipping %: not present', t;
      skipped := skipped + 1;
      CONTINUE;
    END IF;

    -- 1. Remove every client privilege. PostgREST only exposes what
    --    anon/authenticated hold privileges on, so this takes the table
    --    off the API surface entirely rather than relying on a policy.
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon, authenticated', t
    );

    -- 2. Drop any existing policy. With no grants they are unreachable
    --    anyway, but leaving a permissive one behind would quietly reopen
    --    the table the moment a grant reappears.
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
      RAISE NOTICE '  dropped policy %.%', t, pol.policyname;
    END LOOP;

    -- 3. Belt and braces: RLS on with no policy. Grants and RLS fail
    --    independently, and a blanket `GRANT ... ON ALL TABLES IN SCHEMA
    --    public` is exactly how these tables became readable in the first
    --    place. Requiring both to be wrong is the point.
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    RAISE NOTICE 'locked %: no client grants, RLS on, zero policies', t;
    locked := locked + 1;

  END LOOP;

  RAISE NOTICE '---- % table(s) locked, % skipped as absent ----', locked, skipped;
END $$;

COMMIT;


-- =====================================================================
-- VERIFICATION — runs after COMMIT. These read the catalogs and filter by
-- name, so they are safe whether or not a given table still exists.
-- =====================================================================

-- A. No client role holds any privilege on the four. Expect ZERO rows.
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
  AND table_name IN ('verifications','availability','applications','reviews')
ORDER BY table_name, grantee;

-- B. Each one that still exists has RLS on and no policies.
--    Expect rls_enabled = true and policy_count = 0 on every row returned.
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       (SELECT count(*) FROM pg_policies p
         WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policy_count
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND c.relname IN ('verifications','availability','applications','reviews')
ORDER BY c.relname;

-- C. Catch-all: ANY base table in public that is neither governed by
--    20260804020000 nor locked above — i.e. anything new or missed that a
--    client role can still reach. Expect ZERO rows. If a row appears here,
--    add it to the list at the top of this file and re-run.
SELECT c.relname AS unaccounted_table,
       string_agg(DISTINCT g.grantee || ':' || g.privilege_type, ', ') AS client_grants
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN information_schema.role_table_grants g
  ON g.table_schema = 'public' AND g.table_name = c.relname
 AND g.grantee IN ('anon', 'authenticated')
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND c.relname NOT IN (
    'users','family_profiles','caregiver_profiles','service_requests',
    'matches','messages','notifications','agent_decisions'
  )
GROUP BY c.relname
ORDER BY c.relname;

-- D. Whole-schema policy census. Expect 26 on 'governed' and 0 on 'other'.
SELECT
  CASE WHEN tablename IN ('users','family_profiles','caregiver_profiles',
                          'service_requests','matches','messages',
                          'notifications','agent_decisions')
       THEN 'governed' ELSE 'other' END AS bucket,
  count(*) AS policies
FROM pg_policies WHERE schemaname = 'public'
GROUP BY 1 ORDER BY 1;

-- E. Nothing anywhere in public is blanket-true. Expect ZERO rows.
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (coalesce(qual,'') IN ('true','(true)')
    OR coalesce(with_check,'') IN ('true','(true)'));


-- =====================================================================
-- ROLLBACK — per table, for whichever ones you want back:
--
--   GRANT SELECT ON public.applications TO authenticated;
--   ALTER TABLE public.applications DISABLE ROW LEVEL SECURITY;
-- =====================================================================
