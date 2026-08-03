// Notification audience + triage rules shared across dashboards.

/**
 * Internal ops notifications (agent escalations) — rendered only in /admin,
 * never to family or caregiver users. Filter with .neq('type', ...) at the
 * query so unread badges stay truthful too.
 */
export const INTERNAL_NOTIFICATION_TYPE = 'admin_escalation'

/**
 * True when the notification asks the user to do something, as opposed to
 * telling them something. Action items render first.
 */
export function isActionNotification(n: { type?: string; data?: any }): boolean {
  if (n?.data?.requiresApproval === true) return true // agent proposal awaiting family approval
  if (n?.type === 'caregiver_interested') return true // caregiver waiting on the family's answer
  if (n?.type === 'message' && n?.data?.isAi !== true) return true // a person wrote to you — reply
  return false
}
