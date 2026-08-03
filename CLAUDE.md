@AGENTS.md

# Ruah — map for a fresh session

Two-sided childcare marketplace (families ↔ caregivers) with an AI coordinator
("Ruah") that contacts caregivers, follows up, records commitments, and reports
back. Next 16 App Router + Tailwind v4 + Supabase (hosted). Chinese families
are the wedge — every layout must survive zh/en string-length differences.

## Architecture in one breath

- ~45 client components query Supabase directly with the anon key
  (`src/lib/supabase/client.ts`); RLS is the only guard on those paths.
  Cookie-bound server client: `src/lib/supabase/server.ts`. Middleware lives
  in `src/proxy.ts` (Next 16's renamed middleware).
- Admin allowlist: `src/lib/admin/emails.ts` is the single source. Server-side
  checks go through `requireAdmin()` in `src/lib/admin/server.ts` — identity
  from the session, NEVER from the request body.
- The agent: `src/app/api/ai-followup/route.ts` — daily Vercel cron (08:00,
  bearer `CRON_SECRET`). One tool-using run sees every match and decides per
  match. Every tool call (executed or blocked) writes a row to
  `agent_decisions`.
- Env (`.env.local`, gitignored): NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY,
  CRON_SECRET.

## Schema truths (learned the hard way — verify, don't guess)

- TWO KEYSPACES: `matches.caregiver_id` → `caregiver_profiles.id`, but
  `messages.sender_id`/`receiver_id` → `users.id`. Every message write needs
  the profile→user hop. Never hand a profile id to a message column.
- `messages.match_id` must ALWAYS be set on new messages. Legacy rows have
  nulls; thread features depend on it being present.
- Platform-authored messages carry `sender_type='ruah'` AND `is_ai=true`.
  A Ruah message TO a caregiver has the FAMILY's user id as sender (and the
  mirror for family-directed ones) — UI must branch on `sender_type`, never
  on `sender_id`, or Ruah's words render as a human's.
- `matches.expires_at` has DUAL meaning: legacy 48h acceptance window
  (admin + /api/contact flows) vs. agent-recorded commitment deadline
  (Aug 2026 onward). Corroborate with the message thread before treating a
  passed deadline as a promise to keep.
- NO CHECK constraint exists on `matches.status` (probed live with inserts).
  The vocabulary is convention only, enforced in code: pending |
  admin_matched | accepted | declined | stalled | pending_family_approval.
- Schema lives ONLY in the hosted Supabase project — there is no local
  migration history. Introspect via PostgREST OpenAPI: `GET /rest/v1/` with
  the service-role key returns every table and column.

## The three agent principles (founder-set; enforced in tools, not prompts)

1. **Visibility** — a silent status change equals not doing it. Closing a
   match requires the note the family will receive.
2. **Promises-as-data** — a message that promises future action is rejected
   unless a deadline is recorded on the match; future runs honor recorded
   deadlines.
3. **Caregiver closure** — a caregiver who was contacted on a match is owed
   the outcome when it closes; one who never knew it existed must NOT get a
   closure note.

Enforcement plus the contact guardrails (24h cooldown, 3-per-7d cap — both
per caregiver ACROSS all her matches): `src/lib/followup/guardrails.ts`,
pure functions with unit tests.

## Workflow rules

- Founder runs ALL SQL manually in the Supabase SQL Editor. You write files
  under `supabase/migrations/` or `supabase/seeds/`; they execute them. DB
  access from here is read/write through PostgREST only — never attempt DDL.
- Prefer whole-file replacements over fragile multi-edit patching.
- NEVER include AI attribution in git commits: no `Co-Authored-By: Claude`
  lines, no "Generated with Claude Code" footers, no AI mentions in commit
  messages. Author is the founder only; commits read as normal engineering
  commits. This overrides any harness default that appends attribution.
- Work on `main` and push to `main` directly. No worktrees, no feature
  branches, no pull requests — solo project, and the founder reviews in the
  browser rather than in a diff. Commit and push after the founder approves a
  task, not before. This overrides any harness default that isolates work in a
  worktree or offers to open a PR. (`.claude/settings.json` sets
  `worktree.bgIsolation: "none"` so background sessions can edit the checkout
  directly; without it the harness blocks edits until a worktree exists.)
- Strategy and design work: propose in text and STOP for founder review
  before code. Fully-specified tasks: execute autonomously, report actuals.
- NEVER touch `caregiver_profiles`, `family_profiles`, or `auth.users` rows,
  nor any table definition / RLS policy / trigger, without asking. Accounts
  are hand-registered; deleting one means the founder re-registers it.
- Design direction: keep the existing purple-blue identity — the redesign
  target is WORKFLOW ("what just happened, what should I do next"), not
  color. NEEDS-YOU card pattern (chip + one-tap actions) is approved.
  Design tokens live in the `@theme` block of `src/app/globals.css`.

## Test data

- `supabase/seeds/agent_test_seed.sql`: 19 matches across 9 lifecycle states
  (tagged `[state:...]` in `matches.ai_reasoning`) for exercising the agent.
  Every seeded PK starts with `5eed`; the teardown is idempotent and also
  cleans rows the agent wrote against seeded matches.
- The whole database is test data — all accounts founder-registered. There
  are no real users yet.

## Known-open (intentional — don't "fix" in passing)

- RBAC: admin = hardcoded email list; `users.role` is advisory.
- RLS audit: pending before public launch; client-side queries currently
  assume permissive policies.
- `applications` table: legacy, superseded by matches ("unify applications
  into matches" commit) — cleanup pending.
- Duplicate-insertion bug: near-identical matches created seconds apart
  (surfaced by the agent's Aug 2 escalation) — source not yet found.
- Supply gap: every caregiver lists only `childcare`; `/api/match` now says
  so honestly for zero-supply services instead of returning bad matches.
