-- =====================================================================
-- PROBE — can PostgREST embed a related table through a VIEW?
--
-- ── WHY THIS EXISTS ──────────────────────────────────────────────────
-- 20260805000000_user_views.sql introduces `users_admin`, and six admin
-- pages read it with a nested resource:
--
--     supabase.from('users_admin').select('*, caregiver_profiles ( id )')
--
-- PostgREST resolves an embed on a view by tracing the view back to its
-- source relation and using that relation's foreign keys. That is a
-- PostgREST behaviour, not a guarantee this repo can make — it depends on
-- the running version and on FK detection. If it ever stops working,
-- /admin/caregivers and /admin/families render EMPTY rather than erroring,
-- which is the failure mode nobody notices.
--
-- scripts/rls-regression.mjs asserts the real thing in PHASE 5 and is the
-- authoritative check. This file is the fallback for when there is no Ruah
-- database to point it at: it reproduces the same shape — one base table,
-- one child with a foreign key, one `SELECT *` view over the parent — on
-- throwaway tables, so the question can be settled in any empty project.
--
-- ── HOW TO RUN ───────────────────────────────────────────────────────
-- 1. Paste §1 into the Supabase SQL Editor and run it.
-- 2. From a browser address bar (no shell quoting to get wrong):
--
--      https://<PROJECT_REF>.supabase.co/rest/v1/probe_parent_view
--        ?select=*,probe_child(note)
--        &apikey=<PUBLISHABLE_OR_ANON_KEY>
--
--    The ref and the key MUST come from the same project — a key from
--    another project returns `Invalid API key`, which reads like a typo.
--
-- 3. Read the result:
--
--      EMBED WORKS   [{"id":"...","name":"alice","probe_child":[{"note":"hello"}]}]
--      EMBED BROKEN  {"code":"PGRST200","message":"Could not find a relationship ..."}
--
--    Broken means the admin console must read users through a server route
--    (the /api/admin/* pattern) instead of through the view.
--
-- 4. Run §2 to remove every object this created.
--
-- Creates only `probe_`-prefixed objects. Touches nothing else.
-- =====================================================================


-- =====================================================================
-- §1  SET UP
-- =====================================================================

BEGIN;

DROP VIEW  IF EXISTS public.probe_parent_view;
DROP TABLE IF EXISTS public.probe_child;
DROP TABLE IF EXISTS public.probe_parent;

CREATE TABLE public.probe_parent (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name    text,
  private text          -- stands in for users.email: present, must not leak
);

CREATE TABLE public.probe_child (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.probe_parent(id),   -- the FK the embed needs
  note      text
);

INSERT INTO public.probe_parent (id, name, private)
  VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'alice', 'secret');

INSERT INTO public.probe_child (parent_id, note)
  VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'hello');

-- Same construction as users_admin: security_invoker = false, SELECT * over
-- exactly one base table. If the real view ever stops matching this shape,
-- this probe stops being evidence about it.
CREATE VIEW public.probe_parent_view
WITH (security_invoker = false) AS
SELECT * FROM public.probe_parent;

GRANT SELECT ON public.probe_parent_view TO anon;
GRANT SELECT ON public.probe_child       TO anon;

COMMIT;

-- PostgREST caches the schema. A view created seconds ago may 404 until the
-- cache reloads; this nudges it. If the request still 404s, wait ~10s.
NOTIFY pgrst, 'reload schema';


-- =====================================================================
-- §2  TEAR DOWN — run this when finished. Idempotent.
-- =====================================================================
--
--   DROP VIEW  IF EXISTS public.probe_parent_view;
--   DROP TABLE IF EXISTS public.probe_child;
--   DROP TABLE IF EXISTS public.probe_parent;
--   NOTIFY pgrst, 'reload schema';
