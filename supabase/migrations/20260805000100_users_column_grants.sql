-- =====================================================================
-- STEP 2 of 2 — close the PII column gap on `users`.
--
-- ⚠  RUN ORDER MATTERS. Do all three, in order:
--      1. supabase/migrations/20260805000000_user_views.sql   (additive)
--      2. deploy the application commit                       (reads views)
--      3. THIS FILE                                           (revoke)
--    Running this before the deploy breaks every dashboard, because the
--    code still in production does select('*') on users and Postgres
--    rejects that outright once the column grant is gone.
--
-- ── WHAT WAS WRONG ───────────────────────────────────────────────────
-- 20260804020000_rls_consolidated.sql §4b reset anon's reads and handed
-- back a column whitelist:
--
--     -- users: name/photo/city/state are public on a profile page.
--     -- email, phone, zipcode and ban_reason are not.
--     GRANT SELECT ( id, full_name, ... ) ON public.users TO anon;
--
-- That REVOKE/GRANT pair named `anon` only. `authenticated` was never
-- reset, so it kept the blanket `GRANT ... ON ALL TABLES IN SCHEMA public`
-- Supabase installs by default — the same blanket grant the
-- ungoverned-tables lock calls out as "exactly how these tables became
-- readable in the first place". The stated intent was therefore enforced
-- against logged-out visitors and nobody else.
--
-- Row access made that reachable rather than theoretical.
-- public.can_view_user() carries an UNCONDITIONAL arm:
--
--     -- any caregiver's row: the public profile page is public by design
--     OR EXISTS (SELECT 1 FROM caregiver_profiles cp WHERE cp.user_id = target)
--
-- No relationship required. Combined with self-serve signup
-- (supabase.auth.signUp in two pages), any account anyone can mint reads
-- every caregiver's row, and with no column gate that includes contact
-- details:
--
--     await supabase.from('users').select('full_name, email, phone, zipcode')
--
-- For a childcare marketplace that hands the caregiver side's phone number
-- and home zipcode to any signup. That is a physical-safety exposure, not
-- only a privacy one.
--
-- The row arm is left ALONE — it is correct. Public profile pages and
-- message threads legitimately need a caregiver's name and photo. The
-- defect is that "which rows" was doing a job only "which columns" can do.
-- This file fixes the column half and changes no policy.
--
-- ── WHY THE GRANT IS COMPUTED, NOT LISTED ────────────────────────────
-- A hand-written whitelist has to name every benign column, so it silently
-- drops any column this file's author did not know about — and the schema
-- lives only in the hosted project. The DO block inverts it: grant every
-- column EXCEPT a short denylist. A column added later is granted by
-- default; only the four named ones are withheld. Re-running picks up new
-- columns, which is why this is safe to re-run after a schema change.
--
-- Idempotent. Safe to re-run. One transaction.
-- =====================================================================

BEGIN;

-- Refuse to run before step 1. Without the views this would take the
-- restricted columns away with nothing to read them through, and the ban
-- screen (src/proxy.ts reads ban_reason) would silently stop rendering.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'user_self' AND c.relkind = 'v'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'users_admin' AND c.relkind = 'v'
  ) THEN
    RAISE EXCEPTION
      'run 20260805000000_user_views.sql first, and deploy the application, before this file';
  END IF;
END $$;


-- =====================================================================
-- §1  users: reset `authenticated` and re-grant everything but the PII.
-- =====================================================================

DO $$
DECLARE
  cols text;
  denied CONSTANT text[] := ARRAY['email', 'phone', 'zipcode', 'ban_reason'];
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'users'
    AND NOT (column_name = ANY (denied));

  IF cols IS NULL THEN
    RAISE EXCEPTION 'public.users has no grantable columns — aborting rather than locking the table';
  END IF;

  -- A column-level REVOKE cannot subtract from a table-level GRANT, so the
  -- table-level grant has to go first. Both statements are in one
  -- transaction, so `authenticated` is never left holding nothing.
  REVOKE SELECT ON public.users FROM authenticated;
  EXECUTE format('GRANT SELECT (%s) ON public.users TO authenticated', cols);

  RAISE NOTICE 'users → authenticated may read: %', cols;
  RAISE NOTICE 'users → withheld: %', array_to_string(denied, ', ');
END $$;

-- INSERT/UPDATE are untouched: users_insert_self and users_update_own_or_admin
-- already scope writes to the caller's own row, and a write privilege does not
-- imply a read privilege on the same column. The admin console's ban/unban
-- buttons keep writing to the base table.


-- =====================================================================
-- §2  Stop the recurrence.
--
--     This whole bug is one blanket grant nobody revoked. §4a of the
--     consolidated migration already did this for anon; authenticated was
--     left out, which is why `users` stayed wide open behind a policy that
--     looked closed.
--
--     CONSEQUENCE FOR FUTURE WORK: a newly created table is no longer
--     readable by logged-in callers until it is granted explicitly. It will
--     read as EMPTY rather than erroring, which is the confusing failure
--     mode — so any new table (e.g. a future `cases`) must ship its own
--     GRANT alongside its policies. Check C of
--     20260804030000_rls_lock_ungoverned_tables.sql exists to catch the
--     opposite mistake; this catches this one.
-- =====================================================================

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM authenticated;

COMMIT;


-- =====================================================================
-- VERIFICATION — runs after COMMIT.
-- =====================================================================

-- A. The four PII columns are granted to NO client role. Expect ZERO rows.
SELECT grantee, column_name
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'users'
  AND grantee IN ('anon', 'authenticated')
  AND privilege_type = 'SELECT'
  AND column_name IN ('email', 'phone', 'zipcode', 'ban_reason')
ORDER BY grantee, column_name;

-- B. authenticated still holds the benign columns — expect a healthy list
--    including id, full_name, avatar_url, city, state, role, is_banned.
SELECT string_agg(column_name, ', ' ORDER BY column_name) AS granted_to_authenticated
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'users'
  AND grantee = 'authenticated' AND privilege_type = 'SELECT';

-- C. No TABLE-level SELECT lingers on users for a client role. A
--    table-level grant re-admits every column and silently undoes §1.
--    Expect ZERO rows.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'users'
  AND grantee IN ('anon', 'authenticated')
  AND privilege_type = 'SELECT';

-- D. End-to-end, as a real non-admin session. The SQL Editor runs as
--    superuser and cannot show this — run `npm run rls:check`, which
--    asserts all of it in PHASE 5:
--
--      users.select('email')        → 42501 permission denied
--      users.select('*')            → 42501 permission denied
--      users.select('id,full_name') → rows
--      user_self.select('*')        → exactly 1 row, the caller's
--      users_admin.select('*')      → 0 rows as a non-admin, rows as admin
--      users_admin embeds           → caregiver_profiles / family_profiles


-- =====================================================================
-- ROLLBACK
--
--   GRANT SELECT ON public.users TO authenticated;   -- restores all columns
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO authenticated;
--
-- This re-opens the leak. The views can stay — the application reads them
-- either way, and leaving them costs nothing.
-- =====================================================================
