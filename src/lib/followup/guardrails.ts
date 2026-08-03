// Contact guardrails for the ai-followup agent.
//
// These are pure functions over a contact ledger so they can be tested
// directly. That matters more than usual here: the agent has consistently
// self-limited in practice, so these paths do not run on a normal day. A
// backstop that never fires is a backstop nobody has checked.

export const CONTACT_COOLDOWN_HOURS = 24
export const CONTACT_WEEKLY_CAP = 3
export const CONTACT_WINDOW_DAYS = 7

/** One platform-initiated contact to a caregiver, on any of their matches. */
export type Contact = { at: string; match_id: string | null }

export type Block = { blocked_by: string; message: string }

/**
 * Rejects if the caregiver was contacted inside the cooldown, or has hit the
 * weekly cap. Both windows count contacts across every match the caregiver
 * holds — a different match does not reset either one.
 */
export function checkCaregiverContactAllowed(
  contacts: Contact[],
  now: number = Date.now()
): Block | null {
  const recent = contacts.filter(c => now - new Date(c.at).getTime() < CONTACT_COOLDOWN_HOURS * 3600_000)
  if (recent.length > 0) {
    const last = recent[recent.length - 1]
    const hoursAgo = ((now - new Date(last.at).getTime()) / 3600_000).toFixed(1)
    return {
      blocked_by: 'caregiver_contact_cooldown_24h',
      message:
        `Rejected: this caregiver was contacted by the platform ${hoursAgo}h ago (on match ${last.match_id ?? 'unknown'}), ` +
        `inside the ${CONTACT_COOLDOWN_HOURS}h cooldown. The cooldown is per caregiver, not per match — a different match ` +
        `does not reset it. Consider informing the family instead, or leaving this match for a later run.`,
    }
  }

  const week = contacts.filter(c => now - new Date(c.at).getTime() < CONTACT_WINDOW_DAYS * 86400_000)
  if (week.length >= CONTACT_WEEKLY_CAP) {
    return {
      blocked_by: 'caregiver_contact_weekly_cap',
      message:
        `Rejected: this caregiver has already received ${week.length} platform-initiated messages in the last ` +
        `${CONTACT_WINDOW_DAYS} days, at or above the cap of ${CONTACT_WEEKLY_CAP}. Contacting them again risks losing them.`,
    }
  }

  return null
}

/** Rejects unless the family on the match has explicitly expressed interest. */
export function checkFamilyInterested(familyInterested: unknown): Block | null {
  if (familyInterested !== true) {
    return {
      blocked_by: 'family_not_interested',
      message:
        `Rejected: family_interested on this match is ${JSON.stringify(familyInterested)}, not true. ` +
        `A caregiver is only contacted on behalf of a family that has actually expressed interest. ` +
        `If you want to move this match, confirm with the family first.`,
    }
  }
  return null
}

/**
 * Closing a match must never be silent for the family. A status change the
 * family cannot see is the same as not doing it.
 */
export function checkFamilyClosureNote(familyMessage: unknown): Block | null {
  if (typeof familyMessage !== 'string' || !familyMessage.trim()) {
    return {
      blocked_by: 'family_closure_note_required',
      message:
        'Rejected: closing a match must not be silent. Pass family_message — the note the family will ' +
        'see explaining what happened and where they now stand. A silent status change is the same as ' +
        'not doing it.',
    }
  }
  return null
}

/**
 * A caregiver who was platform-contacted on a match is owed the outcome when
 * that match closes. A caregiver who never knew the match existed must NOT
 * get a closure note — it would be her first contact about it, pure noise.
 */
export function checkCaregiverClosureNote(args: {
  platformContactedOnMatch: boolean
  caregiverEngaged: boolean
  caregiverMessage: string | null | undefined
}): Block | null {
  const provided = typeof args.caregiverMessage === 'string' && args.caregiverMessage.trim().length > 0

  if (args.platformContactedOnMatch && !provided) {
    return {
      blocked_by: 'caregiver_closure_note_required',
      message:
        'Rejected: this caregiver was previously contacted on this match, so she is owed the outcome — ' +
        'pass caregiver_message with a short closure note (nothing for her to act on). Closure notes are ' +
        'never blocked by the contact cooldown, but they do count toward her future contact budget.',
    }
  }

  if (provided && !args.platformContactedOnMatch && !args.caregiverEngaged) {
    return {
      blocked_by: 'caregiver_unaware_of_match',
      message:
        'Rejected: this caregiver was never contacted on this match and has not engaged with it — she ' +
        'likely does not know it exists. A closure note would be her first contact about it: noise, and a ' +
        'spend of her attention. Close with the family note only.',
    }
  }

  return null
}

/**
 * Narrow patterns for prose promises the platform cannot keep unless they are
 * recorded as data. Deliberately excludes open-ended reassurances like "we'll
 * keep looking" — an open service request already encodes that.
 */
export const PROMISE_PATTERNS: RegExp[] = [
  /we(?:'|’)?ll\s+(?:close|follow\s*up|check\s+back|circle\s+back)/i,
  /we\s+will\s+(?:close|follow\s*up|check\s+back|circle\s+back)/i,
  /if\s+we\s+don(?:'|’)?t\s+hear/i,
]

/** True when the content promises future action and no deadline was recorded. */
export function detectsProseOnlyPromise(content: string, deadlineRecorded: boolean): boolean {
  if (deadlineRecorded) return false
  return PROMISE_PATTERNS.some(p => p.test(content))
}
