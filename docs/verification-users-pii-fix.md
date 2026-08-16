# Verifying the `users` PII column fix

Everything the fix in `bf2add6` needs before it can be called done. Written
down because none of it has run yet: the Ruah Supabase project was not
reachable at the time, so the change is **built and pushed but unapplied and
unverified against real data**.

Nothing here is optional. Work top to bottom.

---

## What is already verified, and how

These hold without a database and are green today:

| Check | Command | Result |
|---|---|---|
| Types | `npx tsc --noEmit` | 0 errors |
| Build | `npx next build` | compiles, `/api/request-distances` emitted |
| Unit tests | `npm test` | 62/62 |

The vulnerability analysis itself also stands without a database — it was
derived by reading `20260804020000_rls_consolidated.sql` §4b (the column
whitelist names `anon` only), `can_view_user()` (unconditional arm for every
caregiver row), and the two self-serve `supabase.auth.signUp` call sites.

---

## What is NOT verified

Everything below needs a live Ruah database — one with `users`, real accounts,
and at least one family/caregiver pair sharing a match.

- The two migrations have never been executed.
- `npm run rls:check` has never run, so PHASE 5 has never passed.
- Whether PostgREST embeds through `users_admin` is still **open**. Six admin
  pages depend on it. See step 5.

---

## Step 0 — point `.env.local` at ONE project

Every value must come from the same Supabase project. A URL from one project
and a key from another returns `Invalid API key`, which reads like a typo and
is not.

```bash
awk -F= '{print $1" length "length($2)}' .env.local
```

`NEXT_PUBLIC_SUPABASE_URL` ~40 chars, both keys 40+ (`sb_publishable_` /
`sb_secret_`) or 200+ (legacy `eyJ…`). Any zero-length value means the
placeholder was never replaced.

Confirm it is the Ruah project, not an empty one:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY 1;
```

Must list `users`, `matches`, `messages`, `caregiver_profiles`,
`family_profiles`, `service_requests`, `notifications`, `agent_decisions`.
If it does not, stop — this is the wrong project.

---

## Step 1 — run the additive migration

`supabase/migrations/20260805000000_user_views.sql`, whole file, SQL Editor.

Purely additive. Old code and new code both work after it, which is why it is
separate from step 3.

| Verification block | Expect |
|---|---|
| A | `user_self` and `users_admin`, grantee `authenticated` |
| B | `reloptions` NULL or containing `security_invoker=false` |
| C | **one row** — `authenticated` still holds table-level SELECT on `users` |

C being empty means step 3 already ran. Do not continue.

---

## Step 2 — click through the app

`npm run dev`, then check each of these. All were touched by the commit.

- `/family/dashboard`, `/caregiver/dashboard` — own-row reads now come from
  `user_self`. Name and avatar render → correct.
- `/caregiver/requests` — the **"N mi away"** chip. It now comes from
  `/api/request-distances`; the browser no longer sees any family's zipcode.
- `/admin/caregivers`, `/admin/families` — the embed-dependent pages. Rows
  listed with email visible → the embed works.
- Ban a test account and load any page — must redirect to `/banned` **and show
  the reason**. `src/proxy.ts` reads `ban_reason` through `user_self`; if that
  read fails, `userData` is null and the redirect stops firing silently. This
  is the single most important click in this list.

---

## Step 3 — run the revoking migration

`supabase/migrations/20260805000100_users_column_grants.sql`.

Refuses to run if step 1 has not been applied.

| Verification block | Expect |
|---|---|
| A | **zero rows** — no client role holds email/phone/zipcode/ban_reason |
| B | a healthy column list: id, full_name, avatar_url, city, state, role, … |
| C | **zero rows** — no table-level SELECT survives |

`information_schema` filters by the current role and can under-report. If a
result looks impossible, re-check against the catalogs, which do not filter:

```sql
SELECT has_column_privilege('authenticated','public.users','email','SELECT')     AS auth_email,
       has_column_privilege('authenticated','public.users','full_name','SELECT') AS auth_name;
```

After step 3: `auth_email` false, `auth_name` true.

---

## Step 4 — regression suite

```bash
npm run rls:check
```

PHASES 1–4 are pre-existing and should stay green. PHASE 5 is new and covers
the half that was never asserted — the authenticated path.

The two lines that matter most:

```
admin users_admin embeds caregiver_profiles (admin console depends on it)
admin users_admin embeds family_profiles (admin console depends on it)
```

---

## Step 5 — if the embeds FAIL

`/admin/caregivers` and `/admin/families` will render empty. The fix is to move
those two pages' user reads to a server route holding the service role behind
`requireAdmin()` — the `/api/admin/verify-caregiver` pattern. Roughly half an
hour. The rest of the change is unaffected.

To answer this question without a Ruah database at all, run
`supabase/checks/postgrest_view_embed_probe.sql` in any empty project. It
reproduces the same shape on throwaway tables.

---

## Still open after all of this

Same class of defect, deliberately not fixed in `bf2add6`:

- **`caregiver_profiles`** — correct row gate, no column gate. A matched family
  reads `id_photo_path` and `selfie_path`. Paths only; confirm the storage
  bucket is private.
- **`family_profiles`** — any caregiver-role account reads the entire row of
  any family with an open request, including `onboarding_answers` (children's
  ages, schedule, budget). Needs a product decision about what a caregiver
  should see before matching, which is why it is not a pure security patch.
