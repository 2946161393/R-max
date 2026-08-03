-- =====================================================================
-- agent_test_seed.sql
-- Seeds 19 matches across the 9 lifecycle states the ai-followup agent
-- (src/app/api/ai-followup/route.ts) must decide between.
--
-- RUN: paste into the Supabase SQL Editor and execute. Idempotent -
-- running it twice produces identical counts.
--
-- MARKING STRATEGY
--   Every seeded row's primary key starts with the hex literal '5eed'.
--     service_requests  5eed0000-...
--     matches           5eed1111-...
--     messages          5eed2222-...
--     notifications     5eed3333-...   (only used by the optional block below)
--   The teardown targets id::text LIKE '5eed%', so it can never reach the
--   9 pre-existing matches, 2 pre-existing messages, 16 pre-existing
--   service_requests or 48 pre-existing notifications. Verified: zero
--   pre-existing rows in any of those tables start with '5eed'.
--   Text columns additionally carry a human-visible '[SEED:agent_test]' tag,
--   and matches.ai_reasoning carries '[state:<name>]' which the verification
--   query below groups on.
--
-- GUARDRAILS HONORED
--   - INSERT/DELETE only on matches, messages, notifications.
--   - service_requests are UPSERTed (ON CONFLICT DO UPDATE), never deleted.
--   - caregiver_profiles, family_profiles, auth.users, RLS, triggers: untouched.
--   - All backdating uses explicit created_at values (now() - interval ...).
--     Relative offsets keep the seed valid whenever it is re-run; the agent's
--     48-hour cutoff is evaluated against wall clock at run time.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Teardown. Child-first so foreign keys stay satisfied.
-- ---------------------------------------------------------------------
DELETE FROM messages      WHERE id::text LIKE '5eed%';

-- Messages the ai-followup agent wrote during a test run carry random ids,
-- not the 5eed prefix, but they reference seeded matches. Without this the
-- matches DELETE below fails on messages_match_id_fkey and the script stops
-- being idempotent the moment the agent has been run once.
DELETE FROM messages
  WHERE match_id IN (SELECT id FROM matches WHERE id::text LIKE '5eed%');

-- Likewise, matches the agent proposed against a seeded service request are
-- not 5eed-prefixed; they would otherwise accumulate on every run.
DELETE FROM messages
  WHERE match_id IN (
    SELECT id FROM matches
     WHERE ai_reasoning LIKE '[agent-proposed]%'
       AND request_id IN (SELECT id FROM service_requests WHERE id::text LIKE '5eed%')
  );

-- Notifications the agent created carry random ids but reference matches via
-- data->>'matchId' / data->>'followupSentFor'. Remove the ones tied to seeded
-- or agent-proposed matches so repeated cycles do not accumulate junk.
-- (Escalation notifications about PRE-EXISTING matches are left alone — those
-- are real admin todos about real data problems.)
DELETE FROM notifications
  WHERE (data->>'matchId') IN (
          SELECT id::text FROM matches WHERE id::text LIKE '5eed%'
          UNION
          SELECT id::text FROM matches
           WHERE ai_reasoning LIKE '[agent-proposed]%'
             AND request_id IN (SELECT id FROM service_requests WHERE id::text LIKE '5eed%'))
     OR (data->>'followupSentFor') IN (SELECT id::text FROM matches WHERE id::text LIKE '5eed%');

DELETE FROM matches
  WHERE ai_reasoning LIKE '[agent-proposed]%'
    AND request_id IN (SELECT id FROM service_requests WHERE id::text LIKE '5eed%');

DELETE FROM notifications WHERE id::text LIKE '5eed%';
DELETE FROM matches       WHERE id::text LIKE '5eed%';

-- ---------------------------------------------------------------------
-- 2. Service requests (upsert - never deleted, per guardrail).
--    Each match gets its own request so family attribution is unambiguous.
--    States 1-8 use status 'open'; state 9 (abandoned) uses 'filled', which
--    is the existing inactive value in this database.
-- ---------------------------------------------------------------------
INSERT INTO service_requests (id, family_id, service_type, title, description, status, created_at) VALUES
  ('5eed0000-0000-4000-8000-000000000001', '2355c6f8-7c94-4a0b-8901-2b1adce2c026', 'childcare', '[SEED:agent_test] After-school childcare, weekday afternoons', '[SEED:agent_test] Seeded service request backing too_early match #1.', 'open', now() - interval '3 days'),
  ('5eed0000-0000-4000-8000-000000000002', 'e229058e-f90a-42cb-9158-513277d0f564', 'chef', '[SEED:agent_test] Part-time family chef, 3 dinners a week', '[SEED:agent_test] Seeded service request backing too_early match #2.', 'open', now() - interval '3 days'),
  ('5eed0000-0000-4000-8000-000000000003', '74320233-3410-4492-841c-52f77db3919d', 'childcare', '[SEED:agent_test] After-school childcare, weekday afternoons', '[SEED:agent_test] Seeded service request backing first_followup match #3.', 'open', now() - interval '6 days'),
  ('5eed0000-0000-4000-8000-000000000004', '0b4c6612-6919-43e1-8333-7961276bd971', 'manual', '[SEED:agent_test] Household help and errands, flexible hours', '[SEED:agent_test] Seeded service request backing first_followup match #4.', 'open', now() - interval '6 days'),
  ('5eed0000-0000-4000-8000-000000000005', '4d71f02f-d3a1-44d8-be4f-b4d3091613dd', 'childcare', '[SEED:agent_test] After-school childcare, weekday afternoons', '[SEED:agent_test] Seeded service request backing second_followup match #5.', 'open', now() - interval '8 days'),
  ('5eed0000-0000-4000-8000-000000000006', '94ecbb47-e10b-44c6-adfc-82f10c7e59ac', 'chef', '[SEED:agent_test] Part-time family chef, 3 dinners a week', '[SEED:agent_test] Seeded service request backing second_followup match #6.', 'open', now() - interval '8 days'),
  ('5eed0000-0000-4000-8000-000000000007', 'dc151f4b-a2c0-4069-9c9f-63ece67e29fd', 'childcare', '[SEED:agent_test] After-school childcare, weekday afternoons', '[SEED:agent_test] Seeded service request backing long_stalled match #7.', 'open', now() - interval '12 days'),
  ('5eed0000-0000-4000-8000-000000000008', '158867d7-5f23-444c-80f7-d751d4571c1c', 'manual', '[SEED:agent_test] Household help and errands, flexible hours', '[SEED:agent_test] Seeded service request backing long_stalled match #8.', 'open', now() - interval '12 days'),
  ('5eed0000-0000-4000-8000-000000000009', '22906fbd-c144-4aeb-9af9-45e09bb9d86d', 'childcare', '[SEED:agent_test] After-school childcare, weekday afternoons', '[SEED:agent_test] Seeded service request backing declined match #9.', 'open', now() - interval '6 days'),
  ('5eed0000-0000-4000-8000-000000000010', '48e5f0be-c191-4892-a20a-8e059603070c', 'chef', '[SEED:agent_test] Part-time family chef, 3 dinners a week', '[SEED:agent_test] Seeded service request backing declined match #10.', 'open', now() - interval '6 days'),
  ('5eed0000-0000-4000-8000-000000000011', '867c8b05-566e-4131-b75c-00f3fac7b4e5', 'childcare', '[SEED:agent_test] After-school childcare, weekday afternoons', '[SEED:agent_test] Seeded service request backing accepted_silent match #11.', 'open', now() - interval '7 days'),
  ('5eed0000-0000-4000-8000-000000000012', '0db172d6-d95c-42d1-bfad-fa54d70b5e3f', 'manual', '[SEED:agent_test] Household help and errands, flexible hours', '[SEED:agent_test] Seeded service request backing accepted_silent match #12.', 'open', now() - interval '7 days'),
  ('5eed0000-0000-4000-8000-000000000013', '890b5cea-2a0c-4f95-82ea-e7b3a34fa25c', 'childcare', '[SEED:agent_test] After-school childcare, weekday afternoons', '[SEED:agent_test] Seeded service request backing accepted_active match #13.', 'open', now() - interval '9 days'),
  ('5eed0000-0000-4000-8000-000000000014', 'd2b73e55-1ebe-4510-8556-40a4aa3a9161', 'chef', '[SEED:agent_test] Part-time family chef, 3 dinners a week', '[SEED:agent_test] Seeded service request backing accepted_active match #14.', 'open', now() - interval '9 days'),
  ('5eed0000-0000-4000-8000-000000000015', '2355c6f8-7c94-4a0b-8901-2b1adce2c026', 'childcare', '[SEED:agent_test] After-school childcare, weekday afternoons', '[SEED:agent_test] Seeded service request backing rate_limit_trap match #15.', 'open', now() - interval '7 days'),
  ('5eed0000-0000-4000-8000-000000000016', 'e229058e-f90a-42cb-9158-513277d0f564', 'chef', '[SEED:agent_test] Part-time family chef, 3 dinners a week', '[SEED:agent_test] Seeded service request backing rate_limit_trap match #16.', 'open', now() - interval '7 days'),
  ('5eed0000-0000-4000-8000-000000000017', '74320233-3410-4492-841c-52f77db3919d', 'manual', '[SEED:agent_test] Household help and errands, flexible hours', '[SEED:agent_test] Seeded service request backing rate_limit_trap match #17.', 'open', now() - interval '7 days'),
  ('5eed0000-0000-4000-8000-000000000018', '0b4c6612-6919-43e1-8333-7961276bd971', 'childcare', '[SEED:agent_test] After-school childcare, weekday afternoons', '[SEED:agent_test] Seeded service request backing abandoned match #18.', 'filled', now() - interval '20 days'),
  ('5eed0000-0000-4000-8000-000000000019', '4d71f02f-d3a1-44d8-be4f-b4d3091613dd', 'manual', '[SEED:agent_test] Household help and errands, flexible hours', '[SEED:agent_test] Seeded service request backing abandoned match #19.', 'filled', now() - interval '20 days')
ON CONFLICT (id) DO UPDATE SET
  family_id    = EXCLUDED.family_id,
  service_type = EXCLUDED.service_type,
  title        = EXCLUDED.title,
  description  = EXCLUDED.description,
  status       = EXCLUDED.status,
  created_at   = EXCLUDED.created_at;

-- ---------------------------------------------------------------------
-- 3. Matches - 19 rows across 9 states.
--
--    Qualifying = what ai-followup selects: caregiver_interested IS NULL
--    AND created_at < now() - 48h AND status <> 'declined'.
--
--    state 1 too_early       12h old  -> below the 48h cutoff, must NOT fire
--    state 2 first_followup  60h old  -> fires
--    state 3 second_followup 5d old   -> fires, already has a 'ruah' message
--    state 4 long_stalled    9d old   -> fires; status 'admin_matched' proves
--                                        the filter is NOT status='pending'-only
--    state 5 declined        3d old   -> excluded by status='declined'
--    state 6 accepted_silent 4d old   -> excluded by caregiver_interested=true
--    state 7 accepted_active 6d old   -> excluded, and has a live thread
--    state 8 rate_limit_trap 60/72/96h, ONE caregiver x THREE families
--    state 9 abandoned       5d old, request already 'filled'
--
--    Caregiver assignment is deliberate: caregivers 0-7 each hold exactly
--    ONE qualifying match, and caregiver 7935561a ('1234567') holds THREE.
--    That makes the rate-limit trap the unique maximum, so a cross-match
--    limit can be measured without noise from the other states.
-- ---------------------------------------------------------------------
INSERT INTO matches (id, request_id, caregiver_id, status, caregiver_interested, family_interested, ai_score, ai_reasoning, initiated_by, initiator_message, created_at, expires_at) VALUES
  ('5eed1111-0000-4000-8000-000000000001', '5eed0000-0000-4000-8000-000000000001', 'c06814b2-c256-486f-97db-0aa04fcca0a9', 'pending', NULL, true, 0.82, '[SEED:agent_test][state:too_early] Match #1 - Mango x Zijin Wang. Seeded to exercise the ai-followup decision branch for "too_early".', 'family', '[SEED:agent_test] Hi Mango, we think you would be a great fit for our family.', now() - interval '12 hours', now() - interval '12 hours' + interval '48 hours'),
  ('5eed1111-0000-4000-8000-000000000002', '5eed0000-0000-4000-8000-000000000002', 'ed8f8186-8d71-48dc-8ba3-2c274dd9681b', 'pending', NULL, true, 0.82, '[SEED:agent_test][state:too_early] Match #2 - Jialiang x Zijin Wang. Seeded to exercise the ai-followup decision branch for "too_early".', 'family', '[SEED:agent_test] Hi Jialiang, we think you would be a great fit for our family.', now() - interval '12 hours', now() - interval '12 hours' + interval '48 hours'),
  ('5eed1111-0000-4000-8000-000000000003', '5eed0000-0000-4000-8000-000000000003', 'aabf46a7-da41-4251-ade6-9a2e3fd07eec', 'pending', NULL, true, 0.82, '[SEED:agent_test][state:first_followup] Match #3 - Mary x Jin. Seeded to exercise the ai-followup decision branch for "first_followup".', 'family', '[SEED:agent_test] Hi Mary, we think you would be a great fit for our family.', now() - interval '60 hours', now() - interval '60 hours' + interval '48 hours'),
  ('5eed1111-0000-4000-8000-000000000004', '5eed0000-0000-4000-8000-000000000004', '68938462-8f4b-4fb4-8560-352cb07a8bbb', 'pending', NULL, true, 0.82, '[SEED:agent_test][state:first_followup] Match #4 - wang fang x Mango. Seeded to exercise the ai-followup decision branch for "first_followup".', 'family', '[SEED:agent_test] Hi wang fang, we think you would be a great fit for our family.', now() - interval '60 hours', now() - interval '60 hours' + interval '48 hours'),
  ('5eed1111-0000-4000-8000-000000000005', '5eed0000-0000-4000-8000-000000000005', '73824abd-c8a0-4b1f-a11d-31902c330b33', 'pending', NULL, true, 0.82, '[SEED:agent_test][state:second_followup] Match #5 - J J x Z. Seeded to exercise the ai-followup decision branch for "second_followup".', 'family', '[SEED:agent_test] Hi J J, we think you would be a great fit for our family.', now() - interval '5 days', now() - interval '5 days' + interval '48 hours'),
  ('5eed1111-0000-4000-8000-000000000006', '5eed0000-0000-4000-8000-000000000006', 'a4228ba5-4fbd-46f6-8809-7eed1b182244', 'pending', NULL, true, 0.82, '[SEED:agent_test][state:second_followup] Match #6 - 123456 x zwang. Seeded to exercise the ai-followup decision branch for "second_followup".', 'family', '[SEED:agent_test] Hi 123456, we think you would be a great fit for our family.', now() - interval '5 days', now() - interval '5 days' + interval '48 hours'),
  ('5eed1111-0000-4000-8000-000000000007', '5eed0000-0000-4000-8000-000000000007', '82b1b61f-8337-4bff-8ea2-3995c46d824c', 'admin_matched', NULL, true, 0.82, '[SEED:agent_test][state:long_stalled] Match #7 - jin x zjw w. Seeded to exercise the ai-followup decision branch for "long_stalled".', 'family', '[SEED:agent_test] Hi jin, we think you would be a great fit for our family.', now() - interval '9 days', now() - interval '9 days' + interval '48 hours'),
  ('5eed1111-0000-4000-8000-000000000008', '5eed0000-0000-4000-8000-000000000008', 'd379ea78-5e49-4eaf-9618-0c1646854358', 'admin_matched', NULL, true, 0.82, '[SEED:agent_test][state:long_stalled] Match #8 - zxcvbnm x Zhang Qiang. Seeded to exercise the ai-followup decision branch for "long_stalled".', 'family', '[SEED:agent_test] Hi zxcvbnm, we think you would be a great fit for our family.', now() - interval '9 days', now() - interval '9 days' + interval '48 hours'),
  ('5eed1111-0000-4000-8000-000000000009', '5eed0000-0000-4000-8000-000000000009', 'aabf46a7-da41-4251-ade6-9a2e3fd07eec', 'declined', false, true, 0.82, '[SEED:agent_test][state:declined] Match #9 - Mary x Fang Wang. Seeded to exercise the ai-followup decision branch for "declined".', 'family', '[SEED:agent_test] Hi Mary, we think you would be a great fit for our family.', now() - interval '3 days', now() - interval '3 days' + interval '48 hours'),
  ('5eed1111-0000-4000-8000-000000000010', '5eed0000-0000-4000-8000-000000000010', '68938462-8f4b-4fb4-8560-352cb07a8bbb', 'declined', NULL, false, 0.82, '[SEED:agent_test][state:declined] Match #10 - wang fang x Zijin. Seeded to exercise the ai-followup decision branch for "declined".', 'family', '[SEED:agent_test] Hi wang fang, we think you would be a great fit for our family.', now() - interval '3 days', now() - interval '3 days' + interval '48 hours'),
  ('5eed1111-0000-4000-8000-000000000011', '5eed0000-0000-4000-8000-000000000011', '73824abd-c8a0-4b1f-a11d-31902c330b33', 'accepted', true, true, 0.82, '[SEED:agent_test][state:accepted_silent] Match #11 - J J x Jin. Seeded to exercise the ai-followup decision branch for "accepted_silent".', 'family', '[SEED:agent_test] Hi J J, we think you would be a great fit for our family.', now() - interval '4 days', now() - interval '4 days' + interval '48 hours'),
  ('5eed1111-0000-4000-8000-000000000012', '5eed0000-0000-4000-8000-000000000012', 'a4228ba5-4fbd-46f6-8809-7eed1b182244', 'accepted', true, true, 0.82, '[SEED:agent_test][state:accepted_silent] Match #12 - 123456 x Zijin. Seeded to exercise the ai-followup decision branch for "accepted_silent".', 'family', '[SEED:agent_test] Hi 123456, we think you would be a great fit for our family.', now() - interval '4 days', now() - interval '4 days' + interval '48 hours'),
  ('5eed1111-0000-4000-8000-000000000013', '5eed0000-0000-4000-8000-000000000013', '82b1b61f-8337-4bff-8ea2-3995c46d824c', 'accepted', true, true, 0.82, '[SEED:agent_test][state:accepted_active] Match #13 - jin x 123456789. Seeded to exercise the ai-followup decision branch for "accepted_active".', 'family', '[SEED:agent_test] Hi jin, we think you would be a great fit for our family.', now() - interval '6 days', now() - interval '6 days' + interval '48 hours'),
  ('5eed1111-0000-4000-8000-000000000014', '5eed0000-0000-4000-8000-000000000014', 'd379ea78-5e49-4eaf-9618-0c1646854358', 'accepted', true, true, 0.82, '[SEED:agent_test][state:accepted_active] Match #14 - zxcvbnm x asdfghjkl. Seeded to exercise the ai-followup decision branch for "accepted_active".', 'family', '[SEED:agent_test] Hi zxcvbnm, we think you would be a great fit for our family.', now() - interval '6 days', now() - interval '6 days' + interval '48 hours'),
  ('5eed1111-0000-4000-8000-000000000015', '5eed0000-0000-4000-8000-000000000015', '7935561a-3326-4ae1-9d40-c30710eed85e', 'pending', NULL, true, 0.82, '[SEED:agent_test][state:rate_limit_trap] Match #15 - 1234567 x Zijin Wang. Seeded to exercise the ai-followup decision branch for "rate_limit_trap".', 'family', '[SEED:agent_test] Hi 1234567, we think you would be a great fit for our family.', now() - interval '60 hours', now() - interval '60 hours' + interval '48 hours'),
  ('5eed1111-0000-4000-8000-000000000016', '5eed0000-0000-4000-8000-000000000016', '7935561a-3326-4ae1-9d40-c30710eed85e', 'pending', NULL, true, 0.82, '[SEED:agent_test][state:rate_limit_trap] Match #16 - 1234567 x Zijin Wang. Seeded to exercise the ai-followup decision branch for "rate_limit_trap".', 'family', '[SEED:agent_test] Hi 1234567, we think you would be a great fit for our family.', now() - interval '72 hours', now() - interval '72 hours' + interval '48 hours'),
  ('5eed1111-0000-4000-8000-000000000017', '5eed0000-0000-4000-8000-000000000017', '7935561a-3326-4ae1-9d40-c30710eed85e', 'pending', NULL, true, 0.82, '[SEED:agent_test][state:rate_limit_trap] Match #17 - 1234567 x Jin. Seeded to exercise the ai-followup decision branch for "rate_limit_trap".', 'family', '[SEED:agent_test] Hi 1234567, we think you would be a great fit for our family.', now() - interval '96 hours', now() - interval '96 hours' + interval '48 hours'),
  ('5eed1111-0000-4000-8000-000000000018', '5eed0000-0000-4000-8000-000000000018', 'c06814b2-c256-486f-97db-0aa04fcca0a9', 'pending', NULL, true, 0.82, '[SEED:agent_test][state:abandoned] Match #18 - Mango x Mango. Seeded to exercise the ai-followup decision branch for "abandoned".', 'family', '[SEED:agent_test] Hi Mango, we think you would be a great fit for our family.', now() - interval '5 days', now() - interval '5 days' + interval '48 hours'),
  ('5eed1111-0000-4000-8000-000000000019', '5eed0000-0000-4000-8000-000000000019', 'ed8f8186-8d71-48dc-8ba3-2c274dd9681b', 'pending', NULL, true, 0.82, '[SEED:agent_test][state:abandoned] Match #19 - Jialiang x Z. Seeded to exercise the ai-followup decision branch for "abandoned".', 'family', '[SEED:agent_test] Hi Jialiang, we think you would be a great fit for our family.', now() - interval '5 days', now() - interval '5 days' + interval '48 hours');

-- ---------------------------------------------------------------------
-- 4. Messages.
--    - 2 rows for state 3: a prior Ruah follow-up (sender_type 'ruah',
--      is_ai true, family user -> caregiver user, matching how ai-followup
--      addresses its own sends).
--    - 8 rows for state 7: two 4-message threads alternating
--      sender_type between 'family' and 'caregiver'.
-- ---------------------------------------------------------------------
INSERT INTO messages (id, match_id, sender_id, receiver_id, content, is_ai, sender_type, created_at) VALUES
  ('5eed2222-0000-4000-8000-000000000001', '5eed1111-0000-4000-8000-000000000005', '0d59d088-da9c-40de-9382-ef6eadebee8d', 'ba39e61e-ba47-4680-97f0-1ffe07f82c33', '[SEED:agent_test] Hi J J, just following up on the family''s inquiry - are you still available? - The Ruah Team', true, 'ruah', now() - interval '3 days'),
  ('5eed2222-0000-4000-8000-000000000002', '5eed1111-0000-4000-8000-000000000006', '8cc81639-59ba-4c14-a412-d2ae9f2ce21f', '8a2662ba-ae46-4fa7-bea0-e99f55b459b8', '[SEED:agent_test] Hi 123456, just following up on the family''s inquiry - are you still available? - The Ruah Team', true, 'ruah', now() - interval '3 days'),
  ('5eed2222-0000-4000-8000-000000000003', '5eed1111-0000-4000-8000-000000000013', 'aa11c001-0538-403b-832c-9fd101158247', 'e78fa820-23dd-4d26-a755-0fc7ac9de20f', '[SEED:agent_test] Hi! Thanks for accepting - when could you start?', false, 'family', now() - interval '5 days'),
  ('5eed2222-0000-4000-8000-000000000004', '5eed1111-0000-4000-8000-000000000013', 'e78fa820-23dd-4d26-a755-0fc7ac9de20f', 'aa11c001-0538-403b-832c-9fd101158247', '[SEED:agent_test] Happy to help! I could start next Monday if that works.', false, 'caregiver', now() - interval '4 days 20 hours'),
  ('5eed2222-0000-4000-8000-000000000005', '5eed1111-0000-4000-8000-000000000013', 'aa11c001-0538-403b-832c-9fd101158247', 'e78fa820-23dd-4d26-a755-0fc7ac9de20f', '[SEED:agent_test] Monday is perfect. Would 3pm to 6pm suit you?', false, 'family', now() - interval '4 days 12 hours'),
  ('5eed2222-0000-4000-8000-000000000006', '5eed1111-0000-4000-8000-000000000013', 'e78fa820-23dd-4d26-a755-0fc7ac9de20f', 'aa11c001-0538-403b-832c-9fd101158247', '[SEED:agent_test] That works for me. See you Monday at 3.', false, 'caregiver', now() - interval '4 days'),
  ('5eed2222-0000-4000-8000-000000000007', '5eed1111-0000-4000-8000-000000000014', '79acf419-eb2f-466f-8cac-1afcb8cc80c9', '2350e072-edc0-4473-be35-65393f10393b', '[SEED:agent_test] Hi! Thanks for accepting - when could you start?', false, 'family', now() - interval '5 days'),
  ('5eed2222-0000-4000-8000-000000000008', '5eed1111-0000-4000-8000-000000000014', '2350e072-edc0-4473-be35-65393f10393b', '79acf419-eb2f-466f-8cac-1afcb8cc80c9', '[SEED:agent_test] Happy to help! I could start next Monday if that works.', false, 'caregiver', now() - interval '4 days 20 hours'),
  ('5eed2222-0000-4000-8000-000000000009', '5eed1111-0000-4000-8000-000000000014', '79acf419-eb2f-466f-8cac-1afcb8cc80c9', '2350e072-edc0-4473-be35-65393f10393b', '[SEED:agent_test] Monday is perfect. Would 3pm to 6pm suit you?', false, 'family', now() - interval '4 days 12 hours'),
  ('5eed2222-0000-4000-8000-000000000010', '5eed1111-0000-4000-8000-000000000014', '2350e072-edc0-4473-be35-65393f10393b', '79acf419-eb2f-466f-8cac-1afcb8cc80c9', '[SEED:agent_test] That works for me. See you Monday at 3.', false, 'caregiver', now() - interval '4 days');

COMMIT;

-- =====================================================================
-- VERIFICATION - one row per state, plus a PASS/FAIL column.
-- Identical output on every run.
-- =====================================================================
WITH seeded AS (
  SELECT
    m.*,
    substring(m.ai_reasoning from '\[state:([a-z_]+)\]') AS state
  FROM matches m
  WHERE m.id::text LIKE '5eed%'
)
SELECT
  s.state,
  count(*)                                                   AS matches,
  count(DISTINCT s.caregiver_id)                             AS caregivers,
  count(DISTINCT sr.family_id)                               AS families,
  (SELECT count(*) FROM messages g WHERE g.match_id IN (SELECT id FROM seeded x WHERE x.state = s.state)) AS messages,
  count(*) FILTER (
    WHERE s.caregiver_interested IS NULL
      AND s.status <> 'declined'
      AND s.created_at < now() - interval '48 hours'
  )                                                          AS qualifies_for_followup,
  CASE WHEN count(*) >= 2 THEN 'PASS' ELSE 'FAIL' END        AS result
FROM seeded s
JOIN service_requests sr ON sr.id = s.request_id
GROUP BY s.state
ORDER BY s.state;

-- Rate-limit trap: must return exactly one row -> 3 qualifying matches,
-- 1 caregiver, 3 distinct families.
SELECT
  m.caregiver_id,
  count(*)                       AS qualifying_matches,
  count(DISTINCT sr.family_id)   AS distinct_families,
  CASE WHEN count(*) = 3 AND count(DISTINCT sr.family_id) = 3
       THEN 'PASS' ELSE 'FAIL' END AS result
FROM matches m
JOIN service_requests sr ON sr.id = m.request_id
WHERE m.id::text LIKE '5eed%'
  AND m.caregiver_interested IS NULL
  AND m.status <> 'declined'
  AND m.created_at < now() - interval '48 hours'
GROUP BY m.caregiver_id
HAVING count(*) > 1;

-- Blast-radius check: pre-existing data must be unchanged.
-- Expect 9 / 2 / 16 / 48 and 19 / 10.
SELECT
  (SELECT count(*) FROM matches          WHERE id::text NOT LIKE '5eed%') AS preexisting_matches,
  (SELECT count(*) FROM messages         WHERE id::text NOT LIKE '5eed%') AS preexisting_messages,
  (SELECT count(*) FROM service_requests WHERE id::text NOT LIKE '5eed%') AS preexisting_requests,
  (SELECT count(*) FROM notifications    WHERE id::text NOT LIKE '5eed%') AS preexisting_notifications,
  (SELECT count(*) FROM matches          WHERE id::text     LIKE '5eed%') AS seeded_matches,
  (SELECT count(*) FROM messages         WHERE id::text     LIKE '5eed%') AS seeded_messages;

-- =====================================================================
-- OPTIONAL - exercise the agent's de-duplication branch.
--
-- ai-followup does NOT look at messages to decide whether it already
-- followed up. It looks for a notification with type='message' whose
-- data JSONB contains {"followupSentFor": "<match id>"} (route.ts step 4).
-- So the state 3 rows above will still receive a follow-up.
--
-- Uncomment to make the two state 3 matches look already-followed-up,
-- which should cause the agent to skip them:
--
-- INSERT INTO notifications (id, user_id, type, title, body, data, created_at) VALUES
--   ('5eed3333-0000-4000-8000-000000000001', 'ba39e61e-ba47-4680-97f0-1ffe07f82c33', 'message',
--    '[SEED:agent_test] Following up on your match', 'Prior follow-up',
--    '{"isAi": true, "followupSentFor": "5eed1111-0000-4000-8000-000000000005"}'::jsonb, now() - interval '3 days'),
--   ('5eed3333-0000-4000-8000-000000000002', '8a2662ba-ae46-4fa7-bea0-e99f55b459b8', 'message',
--    '[SEED:agent_test] Following up on your match', 'Prior follow-up',
--    '{"isAi": true, "followupSentFor": "5eed1111-0000-4000-8000-000000000006"}'::jsonb, now() - interval '3 days');
-- =====================================================================
