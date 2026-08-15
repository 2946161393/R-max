-- =====================================================================
-- STEP 1 of 2 — the two views. PURELY ADDITIVE: run this whenever.
--
-- Nothing existing changes. No grant is revoked, no policy is touched, no
-- query that works today stops working. It only adds two read paths that
-- STEP 2 will depend on.
--
-- ── WHY THIS IS SPLIT IN TWO ─────────────────────────────────────────
-- Step 2 revokes `users.email/phone/zipcode/ban_reason` from
-- `authenticated`. The application commit that goes with it reads those
-- columns from the views below instead. Run either one alone and something
-- is broken for as long as the other is missing:
--
--   migration first  → deployed code still does select('*') on users,
--                      which Postgres rejects outright. Every dashboard
--                      breaks until the deploy lands.
--   deploy first     → new code reads user_self, which does not exist yet.
--                      Every dashboard breaks until the migration lands.
--
-- Splitting removes the window entirely:
--
--   1. run THIS file            (additive — old code unaffected)
--   2. deploy the application   (new code reads the views, which now exist)
--   3. run 20260805000100       (revoke — old code is already gone)
--
-- Between 1 and 3 both the old and the new code work, so the deploy can
-- take as long as it takes and a rollback at any point is safe.
--
-- ── WHY VIEWS AND NOT A WIDER GRANT ──────────────────────────────────
-- Column grants are ROLE-level. They cannot say "all of your own row,
-- fewer of everyone else's" — the same limitation that made
-- caregiver_public a view rather than a policy. Two callers legitimately
-- need the restricted columns: every user on their OWN row (the profile
-- page edits email/zipcode, and src/proxy.ts reads ban_reason to render
-- the ban screen), and admins on EVERY row (six admin pages list and
-- search by email). Both are admitted through a view whose WHERE clause is
-- the gate, rather than by widening the grant for everybody.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

BEGIN;

-- =====================================================================
-- user_self — the caller's own row, whole.
--
--   security_invoker = false so the view reads the base table with RLS
--   bypassed; `id = auth.uid()` IS the gate. Same construction as
--   caregiver_public. A caller with no session has auth.uid() = NULL and
--   matches nothing, which is why anon gets zero rows rather than an error.
-- =====================================================================

DROP VIEW IF EXISTS public.user_self;

CREATE VIEW public.user_self
WITH (security_invoker = false) AS
SELECT * FROM public.users WHERE id = auth.uid();

REVOKE ALL ON public.user_self FROM anon, authenticated;
GRANT SELECT ON public.user_self TO authenticated;


-- =====================================================================
-- users_admin — every row, whole, for the admin console only.
--
--   is_ruah_admin() mirrors src/lib/admin/emails.ts — CHANGE ONE, CHANGE
--   THE OTHER. It reads the email claim off the caller's JWT, so a
--   non-admin selecting from this view gets zero rows rather than an error.
--
--   The admin pages select with a nested caregiver_profiles /
--   family_profiles resource. PostgREST resolves embeds on a view through
--   the view's source relation, so `SELECT *` off a single base table keeps
--   those embeds working — but that is a PostgREST behaviour, not something
--   this file can guarantee. phaseColumnGrants in scripts/rls-regression.mjs
--   asserts both embeds explicitly; run `npm run rls:check` after this.
-- =====================================================================

DROP VIEW IF EXISTS public.users_admin;

CREATE VIEW public.users_admin
WITH (security_invoker = false) AS
SELECT * FROM public.users WHERE public.is_ruah_admin();

REVOKE ALL ON public.users_admin FROM anon, authenticated;
GRANT SELECT ON public.users_admin TO authenticated;

COMMIT;


-- =====================================================================
-- VERIFICATION — runs after COMMIT.
-- =====================================================================

-- A. Both views exist, readable by authenticated and nobody else.
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('user_self', 'users_admin')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee;

-- B. Neither view is security_invoker — that would apply the caller's own
--    RLS to the base read and defeat the point. Expect reloptions to be
--    NULL or to contain security_invoker=false.
SELECT c.relname, c.reloptions
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('user_self', 'users_admin');

-- C. Nothing was taken away by this file. `authenticated` should STILL hold
--    a table-level SELECT on users at this point — step 2 removes it.
--    Expect one row.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'users'
  AND grantee = 'authenticated' AND privilege_type = 'SELECT';


-- =====================================================================
-- ROLLBACK (only before step 2 — after it, this locks admins out):
--
--   DROP VIEW IF EXISTS public.user_self;
--   DROP VIEW IF EXISTS public.users_admin;
-- =====================================================================
