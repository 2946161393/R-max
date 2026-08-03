-- =====================================================================
-- matches.decline_reason
--
-- Stores the caregiver's one-tap Pass reason (B5). Read by the follow-up
-- agent (so it can propose better alternatives) and shown to the family
-- in the pass notification. NULL for matches declined without a reason.
--
-- Expected values from the UI chips: 'schedule' | 'distance' | 'rate' |
-- 'not_taking_new_families' — deliberately NOT constrained, so the agent
-- and future UI can record richer reasons without a migration.
--
-- RUN: paste into the Supabase SQL Editor. Safe to run twice.
-- =====================================================================

ALTER TABLE matches ADD COLUMN IF NOT EXISTS decline_reason text;

COMMENT ON COLUMN matches.decline_reason IS
  'Why the caregiver passed (chip value or free text). NULL = no reason given.';
