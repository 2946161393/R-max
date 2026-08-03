-- =====================================================================
-- agent_decisions
--
-- One row per tool call made by the ai-followup agent
-- (src/app/api/ai-followup/route.ts) — whether the call executed or was
-- rejected by a guardrail. This is the audit and evaluation surface: it is
-- how you tell whether the agent's judgment was any good, and it is the only
-- place a blocked call is recorded.
--
-- RUN: paste into the Supabase SQL Editor and execute. Safe to run twice.
--
-- Notes on two deliberate choices:
--
--   match_id ... ON DELETE SET NULL — the agent_test_seed.sql teardown does
--   `DELETE FROM matches WHERE id::text LIKE '5eed%'`. A RESTRICT/NO ACTION
--   foreign key would make that DELETE fail once the agent had written
--   decisions against seeded matches, breaking seed idempotency. SET NULL
--   keeps the audit row (reasoning, outcome, verdict) after the match is gone.
--   It is also nullable by design: search_caregivers and propose_new_match
--   are not scoped to an existing match.
--
--   RLS enabled with no policies — this table is written only by the cron
--   route using the service-role key, which bypasses RLS. Every new table in
--   this project is reachable through PostgREST, so leaving RLS off would
--   expose the agent's full reasoning log to any anon caller. No existing
--   table's RLS is touched.
-- =====================================================================

CREATE TABLE IF NOT EXISTS agent_decisions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id      uuid REFERENCES matches(id) ON DELETE SET NULL,
  run_id        uuid NOT NULL,
  step_index    integer NOT NULL,
  tool_name     text NOT NULL,
  tool_input    jsonb NOT NULL DEFAULT '{}'::jsonb,
  reasoning     text,
  executed      boolean NOT NULL DEFAULT false,
  outcome       jsonb,
  blocked_by    text,
  human_verdict text CHECK (human_verdict IN ('good', 'bad', 'unsure')),
  human_note    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Replay a single run in order — the common review query.
CREATE UNIQUE INDEX IF NOT EXISTS agent_decisions_run_step_idx
  ON agent_decisions (run_id, step_index);

-- "What has the agent done to this match?"
CREATE INDEX IF NOT EXISTS agent_decisions_match_idx
  ON agent_decisions (match_id) WHERE match_id IS NOT NULL;

-- "Show me everything still unlabelled" — the grading queue.
CREATE INDEX IF NOT EXISTS agent_decisions_unverdicted_idx
  ON agent_decisions (created_at DESC) WHERE human_verdict IS NULL;

-- "Which guardrail is firing most?"
CREATE INDEX IF NOT EXISTS agent_decisions_blocked_idx
  ON agent_decisions (blocked_by) WHERE blocked_by IS NOT NULL;

ALTER TABLE agent_decisions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE  agent_decisions IS
  'Audit log of ai-followup agent tool calls. One row per call, executed or blocked.';
COMMENT ON COLUMN agent_decisions.reasoning IS
  'The agent''s stated reason for the call. Required on write tools; falls back to the assistant narration for read tools.';
COMMENT ON COLUMN agent_decisions.blocked_by IS
  'Guardrail identifier when executed = false. NULL when the call ran.';
COMMENT ON COLUMN agent_decisions.human_verdict IS
  'Human grade of this decision: good | bad | unsure. NULL until reviewed.';
