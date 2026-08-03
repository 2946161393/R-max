// Audience rules for platform-authored (Ruah) messages, shared by the thread
// view and the conversations list.

export const isRuahMessage = (m: any) => m?.sender_type === 'ruah' || m?.is_ai === true

/**
 * A Ruah message renders only for its receiver, plus the party it was sent on
 * behalf of. Mechanically, Ruah impersonates the FAMILY's sender_id for
 * caregiver-directed outreach — that IS on the family's behalf, so the family
 * sees it ("sent on your behalf"). Family-directed progress/closure reports
 * reuse the caregiver's sender_id as an FK necessity and are NOT on her
 * behalf — the caregiver must never see Ruah's reports about her to the family.
 */
export function ruahMessageVisibleTo(
  m: any,
  viewer: { id?: string; role?: string } | null | undefined
): boolean {
  if (!isRuahMessage(m)) return true
  if (!viewer?.id) return false
  if (m.receiver_id === viewer.id) return true
  return m.sender_id === viewer.id && viewer.role === 'family'
}
