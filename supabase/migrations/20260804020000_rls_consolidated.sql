-- =====================================================================
-- RLS: drop whatever is there and install the whole intended set, once.
--
-- Supersedes and replaces two earlier drafts (20260804000000_rls_lockdown
-- and 20260804010000_rls_p0_policies). NEITHER WAS EVER APPLIED — probing
-- the live database found 0 of 11 helper functions, 0 of 2 views, and a
-- policy set that still let an anonymous caller read every user's email and
-- every family's children's ages. Those two files are deleted; this is the
-- single source of truth.
--
-- ── HOW TO RUN ───────────────────────────────────────────────────────
-- Paste this ENTIRE file into the Supabase SQL Editor and run it once.
-- Do not run it in pieces — everything between BEGIN and COMMIT is one
-- transaction, so it either lands completely or changes nothing at all.
-- The verification block after COMMIT then prints the resulting state.
--
-- ── IDEMPOTENT ───────────────────────────────────────────────────────
-- Re-running produces the same end state. Policies are dropped by
-- enumeration (whatever they are called), views are dropped before being
-- recreated because their column shape may have changed, and functions use
-- CREATE OR REPLACE.
--
-- ── SCOPE ────────────────────────────────────────────────────────────
-- It governs exactly eight tables:
--
--     users, family_profiles, caregiver_profiles, service_requests,
--     matches, messages, notifications, agent_decisions
--
-- Policies on any OTHER table (verifications, reports, applications, …)
-- are left strictly alone. Those tables having RLS enabled is not a defect
-- and this file will not touch them — dropping policies it did not write
-- would turn them into deny-all.
--
-- ── TWO DESIGN NOTES, both load-bearing ──────────────────────────────
--
-- 1. WHY EVERY RELATIONSHIP LOOKUP IS A SECURITY DEFINER FUNCTION.
--    A policy on `matches` that subqueries `service_requests` runs that
--    subquery WITH `service_requests`' policies applied — which subquery
--    `matches` — which recurses until Postgres errors out. Every helper in
--    §2 is SECURITY DEFINER so it reads base tables with RLS bypassed and
--    returns a plain boolean or uuid. Do not inline one back into an EXISTS.
--
-- 2. WHY PUBLIC BROWSING IS A VIEW.
--    Caregiver profiles must be readable by strangers (that is the
--    marketplace) while id_photo_path, selfie_path, onboarding_answers and
--    the internal ops columns must not be. RLS is row-level and cannot say
--    "this row, fewer columns"; column GRANTs are role-level and cannot say
--    "all of my row, fewer of yours". A view does both, so browsing reads
--    caregiver_public and the base table is locked to own-row + participants.
--
-- ROLLBACK is at the very bottom.
-- =====================================================================

BEGIN;

-- =====================================================================
-- §1  DROP THE EXISTING SET on the eight governed tables.
--
--     By enumeration, not by name: the live database was found carrying a
--     policy set this project did not write, and dropping by name would
--     silently leave the unknown ones in place. A permissive leftover ORs
--     with ours and reopens the hole.
-- =====================================================================

DO $$
DECLARE
  t text;
  pol record;
  dropped int := 0;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','family_profiles','caregiver_profiles','service_requests',
    'matches','messages','notifications','agent_decisions'
  ] LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
      RAISE NOTICE 'dropped policy %.% ', t, pol.policyname;
      dropped := dropped + 1;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'total policies dropped: %', dropped;
END $$;

-- Views are dropped rather than replaced: CREATE OR REPLACE VIEW refuses a
-- changed column list, and an earlier draft of caregiver_public had one.
DROP VIEW IF EXISTS public.caregiver_public;
DROP VIEW IF EXISTS public.open_request_stats;


-- =====================================================================
-- §2  IDENTITY AND RELATIONSHIP HELPERS
--     All SECURITY DEFINER, all STABLE, all with a pinned search_path so a
--     shadowed table name cannot hijack them. They return yes/no or "which
--     id am I" — never row data.
-- =====================================================================

-- Mirrors src/lib/admin/emails.ts — CHANGE ONE, CHANGE THE OTHER.
CREATE OR REPLACE FUNCTION public.is_ruah_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce(auth.jwt() ->> 'email', '') IN (
    'zwang168@seas.upenn.edu',
    'zijinwang97@gmail.com',
    'zijinwang168@gmail.com'
  );
$$;

-- The caller's role. The messages audience rule treats a family sender
-- differently from a caregiver sender.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.my_family_profile_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT id FROM public.family_profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.my_caregiver_profile_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT id FROM public.caregiver_profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.shares_match_with_family(fid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.matches m
    JOIN public.service_requests sr ON sr.id = m.request_id
    WHERE sr.family_id = fid
      AND m.caregiver_id = public.my_caregiver_profile_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.shares_match_with_caregiver(cid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.matches m
    JOIN public.service_requests sr ON sr.id = m.request_id
    WHERE m.caregiver_id = cid
      AND sr.family_id = public.my_family_profile_id()
  );
$$;

-- Used by the ANON policy on users. Must be SECURITY DEFINER: anon has no
-- read privilege on caregiver_profiles at all now, so an inline EXISTS would
-- be false for every row and logged-out visitors would see no profiles.
CREATE OR REPLACE FUNCTION public.is_caregiver_user(target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.caregiver_profiles WHERE user_id = target);
$$;

CREATE OR REPLACE FUNCTION public.caregiver_has_match_on_request(rid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.matches
    WHERE request_id = rid AND caregiver_id = public.my_caregiver_profile_id()
  );
$$;

-- Job board: this family has work posted, so caregivers may see the posting
-- and enough of the family to judge it.
CREATE OR REPLACE FUNCTION public.family_has_open_request(fid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.service_requests WHERE family_id = fid AND status = 'open'
  );
$$;

CREATE OR REPLACE FUNCTION public.my_request_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT id FROM public.service_requests WHERE family_id = public.my_family_profile_id();
$$;

-- Which users the caller may see beyond their own row.
CREATE OR REPLACE FUNCTION public.can_view_user(target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT
    target = auth.uid()
    -- any caregiver's row: the public profile page is public by design
    OR EXISTS (SELECT 1 FROM public.caregiver_profiles cp WHERE cp.user_id = target)
    -- a family the caller shares a match with, or one advertising work
    OR EXISTS (
      SELECT 1 FROM public.family_profiles fp
      WHERE fp.user_id = target
        AND (
          public.shares_match_with_family(fp.id)
          OR (public.current_user_role() = 'caregiver' AND public.family_has_open_request(fp.id))
        )
    )
    -- anyone already in a thread with the caller
    OR EXISTS (
      SELECT 1 FROM public.messages m
      WHERE (m.sender_id = auth.uid() AND m.receiver_id = target)
         OR (m.receiver_id = auth.uid() AND m.sender_id = target)
    );
$$;


-- =====================================================================
-- §3  PUBLIC BROWSE VIEWS
--     security_invoker = false (the default, stated explicitly so it reads
--     as intent rather than oversight): these run as their owner and so see
--     past the base tables' RLS. That is the point — they are the vetted,
--     column-limited window onto locked tables.
-- =====================================================================

CREATE VIEW public.caregiver_public
WITH (security_invoker = false) AS
SELECT
  cp.id, cp.user_id, cp.bio, cp.years_experience, cp.languages, cp.services,
  cp.hourly_rate_min, cp.hourly_rate_max, cp.is_verified,
  cp.background_check_status, cp.rating, cp.review_count, cp.created_at,
  cp.availability_type, cp.overnight_ok, cp.last_active_at,
  -- Nested object, not flat columns, so callers that used to embed
  -- `users ( ... )` keep reading row.users.full_name unchanged.
  jsonb_build_object(
    'id',         u.id,
    'full_name',  u.full_name,
    'avatar_url', u.avatar_url,
    'city',       u.city,
    'state',      u.state
  ) AS users
FROM public.caregiver_profiles cp
JOIN public.users u ON u.id = cp.user_id
WHERE coalesce(u.is_banned, false) = false
  AND coalesce(u.is_shadow_banned, false) = false;

-- Deliberately absent: id_photo_path, selfie_path, verification_status,
-- verification_submitted_at, onboarding_answers, availability_schedule,
-- matching_status, match_no_response_count — and any email, phone, zipcode.

-- Applicant counts for the job board: a caregiver may know HOW MANY others
-- applied without being able to read those match rows.
CREATE VIEW public.open_request_stats
WITH (security_invoker = false) AS
SELECT sr.id AS request_id, count(m.id) AS match_count
FROM public.service_requests sr
LEFT JOIN public.matches m ON m.request_id = sr.id
WHERE sr.status = 'open'
GROUP BY sr.id;


-- =====================================================================
-- §4  PRIVILEGES
--     RLS decides which ROWS. Grants decide which TABLES and COLUMNS.
--     Both are needed; neither substitutes for the other.
-- =====================================================================

-- 4a. Logged-out callers write nothing, anywhere. No product path does a
--     write without a session, so this costs nothing.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE USAGE, UPDATE ON ALL SEQUENCES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon;

-- 4b. Reset anon's reads to nothing, then hand back only what a logged-out
--     visitor needs: the public caregiver profile page.
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM anon;

-- users: name/photo/city/state are public on a profile page.
-- email, phone, zipcode and ban_reason are not.
GRANT SELECT (
  id, full_name, avatar_url, city, state, role, created_at,
  is_banned, is_shadow_banned
) ON public.users TO anon;

-- The browse surface. Note this comes AFTER the blanket revoke above,
-- which also covers views.
GRANT SELECT ON public.caregiver_public   TO anon, authenticated;
GRANT SELECT ON public.open_request_stats TO authenticated;

-- 4c. Policy helpers must be callable by the roles whose policies use them.
REVOKE EXECUTE ON FUNCTION
  public.is_ruah_admin(), public.current_user_role(),
  public.my_family_profile_id(), public.my_caregiver_profile_id(),
  public.shares_match_with_family(uuid), public.shares_match_with_caregiver(uuid),
  public.family_has_open_request(uuid), public.my_request_ids(),
  public.can_view_user(uuid), public.is_caregiver_user(uuid),
  public.caregiver_has_match_on_request(uuid)
FROM public;

GRANT EXECUTE ON FUNCTION
  public.is_ruah_admin(), public.current_user_role(),
  public.my_family_profile_id(), public.my_caregiver_profile_id(),
  public.shares_match_with_family(uuid), public.shares_match_with_caregiver(uuid),
  public.family_has_open_request(uuid), public.my_request_ids(),
  public.can_view_user(uuid), public.is_caregiver_user(uuid),
  public.caregiver_has_match_on_request(uuid)
TO anon, authenticated;


-- =====================================================================
-- §5  users
-- =====================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_ruah_admin() OR public.can_view_user(id));

CREATE POLICY users_select_anon ON public.users
  FOR SELECT TO anon
  USING (
    coalesce(is_banned, false) = false
    AND coalesce(is_shadow_banned, false) = false
    AND public.is_caregiver_user(id)
  );

CREATE POLICY users_insert_self ON public.users
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY users_update_own_or_admin ON public.users
  FOR UPDATE TO authenticated
  USING      (id = auth.uid() OR public.is_ruah_admin())
  WITH CHECK (id = auth.uid() OR public.is_ruah_admin());

-- No DELETE policy: accounts are hand-registered, removed in the dashboard.


-- =====================================================================
-- §6  family_profiles
-- =====================================================================

ALTER TABLE public.family_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY family_profiles_select ON public.family_profiles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_ruah_admin()
    OR public.shares_match_with_family(id)
    OR (public.current_user_role() = 'caregiver' AND public.family_has_open_request(id))
  );

CREATE POLICY family_profiles_insert_self ON public.family_profiles
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY family_profiles_update_own ON public.family_profiles
  FOR UPDATE TO authenticated
  USING      (user_id = auth.uid() OR public.is_ruah_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_ruah_admin());

-- No anon policy: logged-out visitors never see a family.


-- =====================================================================
-- §7  caregiver_profiles   (base table; browsing uses caregiver_public)
-- =====================================================================

ALTER TABLE public.caregiver_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY caregiver_profiles_select ON public.caregiver_profiles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_ruah_admin()
    OR public.shares_match_with_caregiver(id)
  );

CREATE POLICY caregiver_profiles_insert_self ON public.caregiver_profiles
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY caregiver_profiles_update_own ON public.caregiver_profiles
  FOR UPDATE TO authenticated
  USING      (user_id = auth.uid() OR public.is_ruah_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_ruah_admin());


-- =====================================================================
-- §8  service_requests
--     The owning family; any caregiver while OPEN (job board); the
--     caregiver on a match against it once it is not.
-- =====================================================================

ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_requests_select ON public.service_requests
  FOR SELECT TO authenticated
  USING (
    family_id = public.my_family_profile_id()
    OR public.is_ruah_admin()
    OR (status = 'open' AND public.current_user_role() = 'caregiver')
    OR public.caregiver_has_match_on_request(id)
  );

CREATE POLICY service_requests_insert_own ON public.service_requests
  FOR INSERT TO authenticated
  WITH CHECK (family_id = public.my_family_profile_id());

CREATE POLICY service_requests_update_own ON public.service_requests
  FOR UPDATE TO authenticated
  USING      (family_id = public.my_family_profile_id() OR public.is_ruah_admin())
  WITH CHECK (family_id = public.my_family_profile_id() OR public.is_ruah_admin());

CREATE POLICY service_requests_delete_own ON public.service_requests
  FOR DELETE TO authenticated
  USING (family_id = public.my_family_profile_id() OR public.is_ruah_admin());


-- =====================================================================
-- §9  matches
--     Against the real schema: matches has NO family_id. The family side is
--     request_id -> service_requests.family_id; the caregiver side is
--     caregiver_id -> caregiver_profiles.id, a PROFILE id, not a user id.
-- =====================================================================

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY matches_select ON public.matches
  FOR SELECT TO authenticated
  USING (
    caregiver_id = public.my_caregiver_profile_id()
    OR request_id IN (SELECT public.my_request_ids())
    OR public.is_ruah_admin()
  );

-- A caregiver applies to a request; an admin matches on a family's behalf.
CREATE POLICY matches_insert ON public.matches
  FOR INSERT TO authenticated
  WITH CHECK (
    caregiver_id = public.my_caregiver_profile_id()
    OR public.is_ruah_admin()
  );

CREATE POLICY matches_update_participants ON public.matches
  FOR UPDATE TO authenticated
  USING (
    caregiver_id = public.my_caregiver_profile_id()
    OR request_id IN (SELECT public.my_request_ids())
    OR public.is_ruah_admin()
  )
  WITH CHECK (
    caregiver_id = public.my_caregiver_profile_id()
    OR request_id IN (SELECT public.my_request_ids())
    OR public.is_ruah_admin()
  );

CREATE POLICY matches_delete_admin ON public.matches
  FOR DELETE TO authenticated USING (public.is_ruah_admin());


-- =====================================================================
-- §10  messages
--      Participation AND the Ruah audience rule from src/lib/messages.ts:
--        - an ordinary message is visible to both participants;
--        - a Ruah message is always visible to its RECEIVER;
--        - the SENDER sees it only when the sender is the family, because
--          Ruah impersonates the family's id for caregiver-directed
--          outreach ("sent on your behalf") but reuses the caregiver's id
--          as an FK necessity for family-directed reports ABOUT her — and
--          she must never read those.
--      Probing the live database found 4 such reports readable by the
--      caregiver they concern. The client filter was the only thing
--      hiding them; now the database enforces it.
-- =====================================================================

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY messages_select_audience ON public.messages
  FOR SELECT TO authenticated
  USING (
    public.is_ruah_admin()
    OR (
      (sender_id = auth.uid() OR receiver_id = auth.uid())
      AND (
        NOT (coalesce(sender_type, '') = 'ruah' OR coalesce(is_ai, false))
        OR receiver_id = auth.uid()
        OR (sender_id = auth.uid() AND public.current_user_role() = 'family')
      )
    )
  );

-- Send as yourself, and never as the platform: sender_type='ruah' / is_ai
-- are written by service-role code only. Probing found this forgeable.
CREATE POLICY messages_insert_self ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND coalesce(sender_type, '') <> 'ruah'
    AND coalesce(is_ai, false) = false
  );

-- The only client-side update is the receiver marking a message read.
CREATE POLICY messages_update_receiver ON public.messages
  FOR UPDATE TO authenticated
  USING      (receiver_id = auth.uid())
  WITH CHECK (receiver_id = auth.uid());


-- =====================================================================
-- §11  notifications — strictly your own.
--      Cross-user notices go through /api/notify, which runs service-role
--      after checking the two parties actually share a match.
-- =====================================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_ruah_admin());

CREATE POLICY notifications_insert_self ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE TO authenticated
  USING      (user_id = auth.uid() OR public.is_ruah_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_ruah_admin());

CREATE POLICY notifications_delete_own ON public.notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_ruah_admin());


-- =====================================================================
-- §12  agent_decisions — audit trail, admin-readable, service-role written.
-- =====================================================================

ALTER TABLE public.agent_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_decisions_select_admin ON public.agent_decisions
  FOR SELECT TO authenticated USING (public.is_ruah_admin());

COMMIT;


-- =====================================================================
-- §13  VERIFICATION — runs after COMMIT. Every row should read OK.
-- =====================================================================

-- 13a. Objects exist. Expect functions 11, views 2, and 26 policies across
--      the eight governed tables.
SELECT 'helper functions' AS thing, count(*) AS found, 11 AS expected
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN
  ('is_ruah_admin','current_user_role','my_family_profile_id','my_caregiver_profile_id',
   'shares_match_with_family','shares_match_with_caregiver','family_has_open_request',
   'my_request_ids','can_view_user','is_caregiver_user','caregiver_has_match_on_request')
UNION ALL
SELECT 'browse views', count(*), 2 FROM pg_views
WHERE schemaname = 'public' AND viewname IN ('caregiver_public','open_request_stats')
UNION ALL
SELECT 'policies on governed tables', count(*), 26 FROM pg_policies
WHERE schemaname = 'public' AND tablename IN
  ('users','family_profiles','caregiver_profiles','service_requests',
   'matches','messages','notifications','agent_decisions')
UNION ALL
SELECT 'governed tables with RLS on', count(*), 8 FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity
  AND c.relname IN ('users','family_profiles','caregiver_profiles','service_requests',
                    'matches','messages','notifications','agent_decisions');

-- 13b. Per-table breakdown. Expect users 4, family_profiles 3,
--      caregiver_profiles 3, service_requests 4, matches 4, messages 3,
--      notifications 4, agent_decisions 1.
SELECT tablename, count(*) AS policy_count,
       string_agg(policyname || '(' || cmd || ')', ', ' ORDER BY policyname) AS policies
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN
  ('users','family_profiles','caregiver_profiles','service_requests',
   'matches','messages','notifications','agent_decisions')
GROUP BY tablename ORDER BY tablename;

-- 13c. No blanket-true policy survived anywhere in the schema. ZERO rows.
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (coalesce(qual,'') IN ('true','(true)')
    OR coalesce(with_check,'') IN ('true','(true)'));

-- 13d. What anon can still reach. Expect ONLY:
--      caregiver_public (SELECT) and users (SELECT on the 9 allowed columns).
SELECT table_name, string_agg(DISTINCT privilege_type, ', ') AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee = 'anon'
GROUP BY table_name ORDER BY table_name;

SELECT table_name, string_agg(column_name, ', ' ORDER BY column_name) AS columns
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND grantee = 'anon' AND privilege_type = 'SELECT'
GROUP BY table_name ORDER BY table_name;


-- =====================================================================
-- ROLLBACK — restores permissive behaviour immediately, holes included.
-- Disabling RLS is enough; the policies stay in place but go inert.
-- =====================================================================
--
--   ALTER TABLE public.users              DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.family_profiles    DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.caregiver_profiles DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.service_requests   DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.matches            DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.messages           DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.notifications      DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.agent_decisions    DISABLE ROW LEVEL SECURITY;
--   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public
--     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon;
-- =====================================================================
