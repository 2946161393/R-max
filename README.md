# Ruah

A two-sided childcare marketplace (families ↔ caregivers) with an AI coordinator —
"Ruah" — that contacts caregivers on a family's behalf, follows up, records what
was committed to, and reports back. Chinese-speaking families in the US are the
wedge, so every layout has to survive zh/en string-length differences.

Stack: Next.js 16 (App Router) · React 19 · Tailwind v4 · Supabase (hosted) ·
Anthropic API. Deployed on Vercel.

---

## 1. Setup

### Prerequisites

- **Node.js ≥ 22.6** (`node -v`). Next 16 itself only needs ≥ 20.9, but the test
  suite runs TypeScript directly through Node's type stripping, which landed in
  22.6. On an older Node the app runs and `npm test` does not.
- npm (the repo has a `package-lock.json` — please don't switch to yarn/pnpm).
- A code editor. No Docker, no local Postgres — see §4.

### Access you need from the founder (ask before you start)

| What | Why | How you get it |
|---|---|---|
| Supabase project invite | The database and auth live there; there is no local DB | Founder invites your email in Supabase → Project Settings → Team |
| `.env.local` values | App won't boot without them | Founder sends them **directly** (1Password / Signal / etc.), never in git or Slack-public |
| Anthropic API key | The AI routes call Claude | Same as above, or use your own key on the org's account |
| Your email in the admin allowlist | To open `/admin/*` | Founder adds it to `src/lib/admin/emails.ts` |
| GitHub push access | We commit straight to `main` (§7) | Founder adds you as a collaborator |
| Vercel team invite (optional) | Only if you need to look at prod logs / cron runs | Founder invites you |

### Steps

```bash
git clone <repo-url> ruahruah
cd ruahruah
npm install
cp .env.example .env.local     # then paste in the real values
npm run dev                    # http://localhost:3000
```

That's it. `npm run dev` talks to the **hosted, shared** Supabase project — the
same data the founder sees. There is no local database to migrate or seed.

Scripts: `npm run dev` · `npm run build` · `npm start` · `npm run lint` ·
`npm test` · `npm run test:watch`.

`npm test` uses Node's built-in runner — no test framework dependency, no build
step. It currently covers `src/lib/followup/guardrails.ts` (54 cases). `npm run
lint` reports a few hundred pre-existing `no-explicit-any` errors across the
codebase; that backlog predates the current work and is not a gate on anything.

### Environment variables

All five live in `.env.local`, which is gitignored. `.env.example` lists the
names with empty values.

| Variable | Used by | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | everything | Public — shipped to the browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ~45 client components, `src/proxy.ts` | Public. RLS is the only guard on these paths |
| `SUPABASE_SERVICE_ROLE_KEY` | server routes under `src/app/api/` | **Bypasses RLS.** Server-only — never import it into a `'use client'` file |
| `ANTHROPIC_API_KEY` | `/api/chat`, `/api/contact`, `/api/ai-followup` | |
| `CRON_SECRET` | `/api/ai-followup` | Bearer token the Vercel cron presents; also how you invoke the agent by hand (§5) |

### First run — sanity check

1. Open http://localhost:3000 — the marketing page renders.
2. Log in at `/login` with an account the founder gives you (see §3), or register
   a fresh one at `/register`.
3. If you are on the admin allowlist, `/admin` should load. If you get bounced to
   `/`, your email isn't in `src/lib/admin/emails.ts` yet.

---

## 2. Codebase map

```
src/
  app/
    (auth)/login, (auth)/register     auth entry points
    family/…       dashboard, post, matches, requests, chat, activity, profile
    caregiver/…    dashboard, requests, availability, verify, chat, profile
                   /caregiver/[id] is the PUBLIC profile page — not role-gated
    admin/…        matching, families, caregivers, moderation, operations, analytics
    messages/…     shared inbox + thread
    api/
      ai-followup       the agent (cron-driven). See §5
      match             family request → ranked caregivers
      contact           family asks Ruah to reach out to a caregiver
      chat              conversational assistant used across family/caregiver UIs
      approve-proposal  family accepts/declines what the agent proposed
      admin/*           verify-caregiver, verification-photos (signed URLs)
    trust, privacy, terms, concierge, search
  lib/
    supabase/client.ts   browser client (anon key)
    supabase/server.ts   cookie-bound server client
    admin/emails.ts      the admin allowlist — single source of truth
    admin/server.ts      requireAdmin(); identity from the session, never the body
    chat/prompts.ts      server-side system prompts for /api/chat, keyed by name
    followup/guardrails.ts  pure functions the agent's tools are checked against
    followup/guardrails.test.ts  their test suite — `npm test`
  components/            ContactEmail, RequestSummaryCard, SiteFooter, FamilyNav
  proxy.ts               Next 16's renamed middleware — auth + role routing
supabase/
  migrations/            SQL you run BY HAND in the Supabase SQL Editor (§4)
  seeds/agent_test_seed.sql   19 matches across 9 lifecycle states
```

**Routing note:** `src/proxy.ts` is the middleware (Next 16 renamed
`middleware.ts` → `proxy.ts`). It redirects by role: `/admin/*` needs an
allowlisted email, `/family/*` needs `role === 'family'`, and the private
`/caregiver/*` subpages need `role === 'caregiver'`. Admins can enter all three.

**Read this before writing Next.js code:** this version has breaking changes from
what you (and your AI tools) probably remember. The docs ship with the install —
`node_modules/next/dist/docs/`. `AGENTS.md` says the same thing to coding agents.

---

## 3. Accounts, roles, and test data

- **The entire database is test data.** There are no real users. Accounts are
  hand-registered by the founder; ask for a family login and a caregiver login
  rather than deleting or repurposing existing ones.
- Roles: `family`, `caregiver`, plus the admin allowlist. A user's role decides
  which dashboard they land on, enforced in `src/proxy.ts`.
- **Never delete or edit rows in `caregiver_profiles`, `family_profiles`, or
  `auth.users`** — every account was registered by hand, and a deleted one costs
  the founder a re-registration. Same for table definitions, RLS policies, and
  triggers: ask first.
- Storage buckets in use: `avatars` (public) and `verifications` (private; the
  admin route hands out 1-hour signed URLs).

For exercising the agent, run `supabase/seeds/agent_test_seed.sql` in the SQL
Editor. Every seeded primary key starts with `5eed`, the teardown is idempotent,
and it also cleans up rows the agent wrote against seeded matches. It touches only
`matches`, `messages`, `notifications`, and upserts `service_requests`.

---

## 4. The database

**The schema lives only in the hosted Supabase project.** There is no local
migration history and no `supabase db push` in this workflow.

- Files under `supabase/migrations/` are SQL the **founder runs manually** in the
  Supabase SQL Editor. Write the file, then ask them to run it — don't attempt DDL
  from the app or from a script.
- To read the live schema, hit PostgREST's OpenAPI doc with the service-role key:
  `GET $NEXT_PUBLIC_SUPABASE_URL/rest/v1/` returns every table and column.
- Main tables: `users`, `family_profiles`, `caregiver_profiles`, `service_requests`,
  `matches`, `messages`, `notifications`, `agent_decisions`, `verifications`,
  `reports`. (`applications` is legacy — superseded by `matches`.)

### Schema truths that will bite you

These were each learned the hard way. Verify against the live schema; don't guess.

1. **Two keyspaces.** `matches.caregiver_id` → `caregiver_profiles.id`, but
   `messages.sender_id` / `receiver_id` → `users.id`. Every message write needs the
   profile → user hop. Never hand a profile id to a message column.
2. **`messages.match_id` must always be set** on new messages. Legacy rows have
   nulls; thread features depend on it being there.
3. **Platform messages carry `sender_type='ruah'` AND `is_ai=true`.** A Ruah
   message *to a caregiver* has the **family's** user id as sender (and the mirror
   for family-directed ones). UI must branch on `sender_type`, never on
   `sender_id` — otherwise Ruah's words render as a human's.
4. **`matches.expires_at` has two meanings.** Legacy: the 48h acceptance window
   (admin + `/api/contact` flows). Newer: a commitment deadline the agent recorded.
   Corroborate with the message thread before treating a passed deadline as a
   broken promise.
5. **`matches.status` vocabulary:** `pending`, `admin_matched`, `accepted`,
   `declined`, `stalled`, `pending_family_approval`, plus terminal `hired` /
   `closed`. It was convention-only for a long time; a CHECK-constraint migration
   sits in `supabase/migrations/20260802100500_matches_status_check.sql` — check
   with the founder whether it has been applied before you rely on it.

---

## 5. The AI coordinator

`src/app/api/ai-followup/route.ts` is the agent. One tool-using Claude run per
day (Vercel cron, 08:00 UTC — see `vercel.json`) sees every open match and decides
per match: nudge, wait, escalate, or close. Every tool call — executed *or* blocked
by a guardrail — writes a row to `agent_decisions`. That table is the audit and
evaluation surface; read it first when you're wondering why the agent did
something.

Run it locally:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/ai-followup
```

It's a `GET`. **It writes to the shared database** — messages, status changes,
notifications, all visible to the founder. Seed first (§3) and say so in chat
before you fire it.

### Three product principles — enforced in tool code, not prompts

1. **Visibility** — a silent status change equals not doing it. Closing a match
   requires the note the family will receive.
2. **Promises as data** — a message that promises future action is rejected unless
   a deadline is recorded on the match. Later runs honor recorded deadlines.
3. **Caregiver closure** — a caregiver who *was contacted* on a match is owed the
   outcome when it closes. One who never knew the match existed must *not* get a
   closure note.

Plus contact guardrails: 24h cooldown and 3-per-7-days cap, both **per caregiver
across all her matches**. All of this lives in `src/lib/followup/guardrails.ts` as
pure functions — that's the file to change if a rule changes, not the prompt.

---

## 6. Design direction

Keep the existing purple-blue identity. The redesign target is *workflow* — "what
just happened, what should I do next" — not color. The NEEDS-YOU card pattern (a
status chip plus one-tap actions) is approved. Design tokens live in the `@theme`
block of `src/app/globals.css`.

Every screen carries both Chinese and English strings; assume a Chinese string can
be half the width of its English counterpart, or double. Don't ship fixed-width
buttons.

---

## 7. How we work

- **Commit to `main` and push directly.** No feature branches, no PRs — the founder
  reviews in the browser, not in a diff. Small commits, plain engineering messages.
- **Ask before touching the DB.** Any DDL, RLS policy, trigger, or profile/auth row
  goes through the founder. Write the SQL into `supabase/migrations/` and hand it
  over.
- **Strategy and design work:** propose in text first and stop for review before
  writing code. Fully-specified tasks: just execute and report what you actually
  did.
- **Coding agents:** `CLAUDE.md` and `AGENTS.md` at the repo root carry the same
  context in a form Claude Code reads automatically. If you learn something the
  hard way, add it there so nobody relearns it.

---

## 8. Security rules for anything you add

Learned from an audit on 2026-08-04 that found the anon key could read every
user's email and phone and rewrite arbitrary `users` rows. Three rules came out
of it, and `/api/approve-proposal` is the reference implementation of all three:

1. **Identity comes from the session, never from the body.** If a route needs to
   know who is calling, it calls `supabase.auth.getUser()`. A `userId` in the
   request body is a claim, not proof. Admin routes go through `requireAdmin()`.
2. **Every route authenticates before it spends anything.** The old `/api/chat`
   and `/api/contact` called Anthropic before checking anything, so an anonymous
   caller could run up the API bill.
3. **Never `select('*')` on a table a stranger can reach.** `users` and
   `caregiver_profiles` are readable by logged-out visitors (the public profile
   page needs them), scoped by column-level grants. `select('*')` both defeats
   that and fails outright against a column-restricted table.

Two more rules came out of enabling RLS across every table:

4. **Relationship lookups in a policy go in a `SECURITY DEFINER` helper.** An
   inline `EXISTS` from one RLS-protected table into another applies the second
   table's policies, which reach back into the first, and Postgres recurses.
   The helpers in §1 of the P0 migration exist for that reason — don't inline them.
5. **Public browsing reads `caregiver_public`, never `caregiver_profiles`.** The
   base table is own-row plus match participants; the view is the vetted,
   column-limited window that strangers may see.

Run `npm run rls:check` after any policy or query change. It exercises the
database the way the app does — anonymous, then as a family, a caregiver, and
an admin — and asserts both that the attack is dead and that every dashboard,
inbox, thread, job board and admin page still loads. It is read-only: write
probes point a foreign key at a nonexistent id so a wrongly-permissive policy
still cannot persist a row, and it sweeps for residue before exiting.

The grant model, the policy set and the remaining gaps are documented in
`supabase/migrations/20260804020000_rls_consolidated.sql` — one file, run as a
single transaction, safe to re-run.

## 9. Known-open — intentional, don't "fix" in passing

- **RBAC:** admin is a hardcoded email list; `users.role` is advisory. The list is
  mirrored in SQL as `public.is_ruah_admin()` — the two must stay in sync.
- **RLS audit:** the anon holes are closed; the authenticated side is not fully
  scoped yet. A logged-in user can still read other users' email/phone and
  insert a notification addressed to anyone. See the "KNOWN GAPS" block at the
  bottom of the lockdown migration.
- **Auto-replies:** `family_profiles.auto_replies` is still collected by the
  family profile UI, but the route that consumed it (`/api/ai-autoreply`) was
  deleted as an unauthenticated service-role hole. Either rebuild it properly or
  drop the UI.
- **`applications` table:** legacy, superseded by `matches`. Cleanup pending.
- **Duplicate-insertion bug:** near-identical matches get created seconds apart
  (surfaced by the agent's Aug 2 escalation). Source not yet found.
- **Supply gap:** every caregiver lists only `childcare`, so `/api/match` now says
  so honestly for zero-supply services instead of returning bad matches.
