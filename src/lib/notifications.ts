// Notification audience + triage rules shared across dashboards.

/**
 * Send a notification to SOMEONE ELSE.
 *
 * `notifications` is RLS-scoped to `user_id = auth.uid()`, so a browser can
 * only insert notifications addressed to itself. Anything aimed at another
 * user goes through /api/notify, which checks the two parties share a match
 * before writing it service-side. Notifications to yourself can still be a
 * direct insert.
 *
 * Fire-and-forget by design, like the inserts it replaces: a failed notice
 * must never block the action that triggered it.
 */
export async function notifyUser(input: {
  recipientUserId?: string
  audience?: 'admins'
  type: string
  title: string
  body?: string
  data?: Record<string, unknown>
}): Promise<boolean> {
  try {
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) {
      console.error('notifyUser failed', res.status, await res.text().catch(() => ''))
      return false
    }
    return true
  } catch (err) {
    console.error('notifyUser failed', err)
    return false
  }
}

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
