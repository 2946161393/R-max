-- =====================================================================
-- CHECK constraint on matches.status — full blessed vocabulary
--
-- Until now the vocabulary was convention only (probed live: any string
-- was accepted). This locks it to the eight known states, including the
-- two new terminal states 'hired' and 'closed' (B3) BEFORE any code
-- writes them, so the constraint never blocks the rollout.
--
-- ── STEP 1: PRE-CHECK — run this first, expect ZERO rows ──────────────
-- Any row returned is out-of-vocabulary and must be fixed before Step 2,
-- or the ALTER TABLE will fail while validating existing rows.

SELECT status, count(*) AS rows, array_agg(id ORDER BY created_at DESC) AS match_ids
FROM matches
WHERE status IS NOT NULL
  AND status NOT IN (
    'pending', 'admin_matched', 'accepted', 'declined',
    'stalled', 'pending_family_approval', 'hired', 'closed'
  )
GROUP BY status;

-- ── STEP 2: the constraint — run only after Step 1 returns zero rows ──
-- (NULL stays allowed: the column is nullable today and legacy writes
-- omit it; code treats NULL as 'pending'-ish. Tightening to NOT NULL is
-- a separate decision.)

ALTER TABLE matches
  ADD CONSTRAINT matches_status_check
  CHECK (status IS NULL OR status IN (
    'pending', 'admin_matched', 'accepted', 'declined',
    'stalled', 'pending_family_approval', 'hired', 'closed'
  ));

-- Re-running: the ADD CONSTRAINT errors harmlessly if it already exists.
-- To rerun cleanly: ALTER TABLE matches DROP CONSTRAINT IF EXISTS
-- matches_status_check; then re-add.
