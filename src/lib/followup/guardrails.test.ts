import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  checkCaregiverContactAllowed,
  checkFamilyInterested,
  checkFamilyClosureNote,
  checkCaregiverClosureNote,
  detectsProseOnlyPromise,
  CONTACT_COOLDOWN_HOURS,
  CONTACT_WEEKLY_CAP,
  CONTACT_WINDOW_DAYS,
  type Contact,
} from './guardrails.ts'

// A fixed "now" so every case is deterministic — these functions take `now`
// as a parameter precisely so tests never depend on wall clock.
const NOW = Date.parse('2026-08-04T12:00:00.000Z')

const hoursAgo = (h: number): string => new Date(NOW - h * 3600_000).toISOString()
const daysAgo = (d: number): string => new Date(NOW - d * 86400_000).toISOString()
const contact = (at: string, match_id: string | null = 'match-a'): Contact => ({ at, match_id })

describe('the guardrail constants', () => {
  // Pinned so a change to any of them has to be deliberate — these three
  // numbers are the founder-set contact policy, not implementation detail.
  test('are 24h cooldown, 3 contacts, 7 day window', () => {
    assert.equal(CONTACT_COOLDOWN_HOURS, 24)
    assert.equal(CONTACT_WEEKLY_CAP, 3)
    assert.equal(CONTACT_WINDOW_DAYS, 7)
  })
})

describe('checkCaregiverContactAllowed — 24h cooldown', () => {
  test('allows a caregiver who has never been contacted', () => {
    assert.equal(checkCaregiverContactAllowed([], NOW), null)
  })

  test('blocks a contact made one hour ago', () => {
    const block = checkCaregiverContactAllowed([contact(hoursAgo(1))], NOW)
    assert.equal(block?.blocked_by, 'caregiver_contact_cooldown_24h')
  })

  test('still blocks just inside the window (23.9h)', () => {
    const block = checkCaregiverContactAllowed([contact(hoursAgo(23.9))], NOW)
    assert.equal(block?.blocked_by, 'caregiver_contact_cooldown_24h')
  })

  test('allows at exactly 24h — the boundary is exclusive', () => {
    assert.equal(checkCaregiverContactAllowed([contact(hoursAgo(24))], NOW), null)
  })

  test('allows just outside the window (24.1h)', () => {
    assert.equal(checkCaregiverContactAllowed([contact(hoursAgo(24.1))], NOW), null)
  })

  test('reports how long ago the blocking contact was', () => {
    const block = checkCaregiverContactAllowed([contact(hoursAgo(3))], NOW)
    assert.match(block!.message, /3\.0h ago/)
  })
})

describe('checkCaregiverContactAllowed — the cooldown is per caregiver, not per match', () => {
  // The rule most likely to be reimplemented wrongly: a caregiver holding
  // three matches does not get three separate contact budgets.
  test('a contact on a DIFFERENT match still blocks this one', () => {
    const block = checkCaregiverContactAllowed([contact(hoursAgo(2), 'some-other-match')], NOW)
    assert.equal(block?.blocked_by, 'caregiver_contact_cooldown_24h')
    assert.match(block!.message, /per caregiver, not per match/)
  })

  test('contacts spread across several matches accumulate toward the weekly cap', () => {
    const ledger = [
      contact(daysAgo(5), 'match-a'),
      contact(daysAgo(4), 'match-b'),
      contact(daysAgo(3), 'match-c'),
    ]
    const block = checkCaregiverContactAllowed(ledger, NOW)
    assert.equal(block?.blocked_by, 'caregiver_contact_weekly_cap')
  })
})

describe('checkCaregiverContactAllowed — 3-per-7-days cap', () => {
  test('allows two contacts inside the window', () => {
    const ledger = [contact(daysAgo(5)), contact(daysAgo(3))]
    assert.equal(checkCaregiverContactAllowed(ledger, NOW), null)
  })

  test('blocks at exactly the cap — the comparison is >=', () => {
    const ledger = [contact(daysAgo(6)), contact(daysAgo(4)), contact(daysAgo(2))]
    const block = checkCaregiverContactAllowed(ledger, NOW)
    assert.equal(block?.blocked_by, 'caregiver_contact_weekly_cap')
  })

  test('ignores contacts that fell out of the 7 day window', () => {
    const ledger = [contact(daysAgo(9)), contact(daysAgo(8)), contact(daysAgo(7.5))]
    assert.equal(checkCaregiverContactAllowed(ledger, NOW), null)
  })

  test('counts only the in-window contacts when the ledger straddles the edge', () => {
    // Two inside, two outside — under the cap, so allowed.
    const ledger = [contact(daysAgo(10)), contact(daysAgo(8)), contact(daysAgo(5)), contact(daysAgo(3))]
    assert.equal(checkCaregiverContactAllowed(ledger, NOW), null)
  })
})

describe('checkCaregiverContactAllowed — precedence', () => {
  test('the cooldown is reported before the cap when both would fire', () => {
    const ledger = [contact(daysAgo(6)), contact(daysAgo(4)), contact(hoursAgo(1))]
    const block = checkCaregiverContactAllowed(ledger, NOW)
    assert.equal(block?.blocked_by, 'caregiver_contact_cooldown_24h')
  })
})

describe('checkCaregiverContactAllowed — malformed input', () => {
  // Documents current behaviour rather than endorsing it: an unparseable
  // timestamp yields NaN, every comparison against it is false, and the
  // contact is silently skipped. That is FAIL-OPEN — a corrupt row makes the
  // guardrail more permissive, not less. Worth revisiting.
  test('a contact with an unparseable timestamp is ignored, not blocked on', () => {
    assert.equal(checkCaregiverContactAllowed([contact('not-a-date')], NOW), null)
  })

  test('a bad row does not mask a good one', () => {
    const block = checkCaregiverContactAllowed([contact('not-a-date'), contact(hoursAgo(1))], NOW)
    assert.equal(block?.blocked_by, 'caregiver_contact_cooldown_24h')
  })
})

describe('checkFamilyInterested', () => {
  test('passes only on a literal true', () => {
    assert.equal(checkFamilyInterested(true), null)
  })

  for (const value of [false, null, undefined, 'true', 1, 0, {}]) {
    test(`blocks on ${JSON.stringify(value) ?? 'undefined'}`, () => {
      const block = checkFamilyInterested(value)
      assert.equal(block?.blocked_by, 'family_not_interested')
    })
  }

  test('names the offending value in the message, for the agent to read back', () => {
    const block = checkFamilyInterested(null)
    assert.match(block!.message, /is null, not true/)
  })
})

describe('checkFamilyClosureNote — a close is never silent', () => {
  test('passes with a real note', () => {
    assert.equal(checkFamilyClosureNote('No luck with this one — here is what is next.'), null)
  })

  for (const value of ['', '   ', '\n\t', null, undefined, 42, {}]) {
    test(`blocks on ${JSON.stringify(value) ?? 'undefined'}`, () => {
      const block = checkFamilyClosureNote(value)
      assert.equal(block?.blocked_by, 'family_closure_note_required')
    })
  }
})

describe('checkCaregiverClosureNote — who is owed an outcome', () => {
  test('a contacted caregiver with a note passes', () => {
    const block = checkCaregiverClosureNote({
      platformContactedOnMatch: true,
      caregiverEngaged: true,
      caregiverMessage: 'Thanks for considering this one — the family went another way.',
    })
    assert.equal(block, null)
  })

  test('a contacted caregiver with NO note is blocked — she is owed the outcome', () => {
    const block = checkCaregiverClosureNote({
      platformContactedOnMatch: true,
      caregiverEngaged: false,
      caregiverMessage: null,
    })
    assert.equal(block?.blocked_by, 'caregiver_closure_note_required')
  })

  test('whitespace does not count as a note', () => {
    const block = checkCaregiverClosureNote({
      platformContactedOnMatch: true,
      caregiverEngaged: false,
      caregiverMessage: '   ',
    })
    assert.equal(block?.blocked_by, 'caregiver_closure_note_required')
  })

  test('a caregiver who never knew the match existed must NOT be notified', () => {
    const block = checkCaregiverClosureNote({
      platformContactedOnMatch: false,
      caregiverEngaged: false,
      caregiverMessage: 'This match has been closed.',
    })
    assert.equal(block?.blocked_by, 'caregiver_unaware_of_match')
  })

  test('an engaged caregiver may be notified even without platform contact', () => {
    // She reached out herself, so the match is not news to her.
    const block = checkCaregiverClosureNote({
      platformContactedOnMatch: false,
      caregiverEngaged: true,
      caregiverMessage: 'Closing this one out — thanks for the interest.',
    })
    assert.equal(block, null)
  })

  test('silence is fine for a caregiver who was never contacted', () => {
    const block = checkCaregiverClosureNote({
      platformContactedOnMatch: false,
      caregiverEngaged: false,
      caregiverMessage: null,
    })
    assert.equal(block, null)
  })
})

describe('detectsProseOnlyPromise — promises must be data', () => {
  const promises = [
    "We'll follow up on Friday.",
    'We will follow up next week.',
    "We'll check back with her tomorrow.",
    'We will circle back once she replies.',
    "We'll close this out if nothing changes.",
    "If we don't hear from her by Monday, we'll move on.",
    'If we don’t hear back, we will try someone else.',   // curly apostrophe
    "WE'LL FOLLOW UP SOON.",                              // case insensitive
    "we’ll  follow   up",                                 // curly + loose spacing
  ]

  for (const content of promises) {
    test(`flags ${JSON.stringify(content)} when no deadline was recorded`, () => {
      assert.equal(detectsProseOnlyPromise(content, false), true)
    })
  }

  test('the same promise is fine once a deadline exists on the match', () => {
    assert.equal(detectsProseOnlyPromise("We'll follow up on Friday.", true), false)
  })

  const allowed = [
    "We'll keep looking for you.",           // open-ended: the open request encodes it
    'She has not replied yet.',
    'Are you available and interested?',
    'The family would love to connect.',
    '',
  ]

  for (const content of allowed) {
    test(`does not flag ${JSON.stringify(content)}`, () => {
      assert.equal(detectsProseOnlyPromise(content, false), false)
    })
  }
})
