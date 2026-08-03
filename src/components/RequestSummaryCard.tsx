'use client'

// Structured summary of a service request, shown wherever a caregiver (or
// family) evaluates an outreach: caregiver dashboard cards and message
// threads. Renders only the fields that exist — chat-created requests are
// sparse and that's fine; the prose stays alongside.

// Live data uses full lowercase day names ("monday"); tolerate 3-letter too.
const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABEL: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
}
const dayValue = (days: any, d: string) => days[d] ?? days[d.slice(0, 3)]

function fmtTime(t?: string) {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hour = parseInt(h, 10)
  if (Number.isNaN(hour)) return t
  const suffix = hour >= 12 ? 'pm' : 'am'
  const display = hour % 12 || 12
  return m && m !== '00' ? `${display}:${m}${suffix}` : `${display}${suffix}`
}

function fmtSchedule(days: any): string | null {
  if (!days || typeof days !== 'object') return null
  const picked = DAY_ORDER.filter(d => dayValue(days, d))
  if (picked.length === 0) return null
  // If every picked day shares the same window, collapse: "Mon · Wed · Fri, 3pm–6pm"
  const windows = picked.map(d => {
    const t = dayValue(days, d)
    return t && typeof t === 'object' ? `${fmtTime(t.start)}–${fmtTime(t.end)}` : ''
  })
  const uniform = windows.every(w => w === windows[0])
  if (uniform && windows[0]) return `${picked.map(d => DAY_LABEL[d]).join(' · ')}, ${windows[0]}`
  return picked.map((d, i) => `${DAY_LABEL[d]} ${windows[i]}`.trim()).join(' · ')
}

export default function RequestSummaryCard({
  request,
  childrenAges,
  city,
}: {
  request: any
  childrenAges?: number[] | null
  city?: string | null
}) {
  if (!request) return null

  const schedule = fmtSchedule(request.schedule_days)
  const pay =
    request.pay_min && request.pay_max ? `$${request.pay_min}–${request.pay_max}/hr`
    : request.pay_min ? `From $${request.pay_min}/hr`
    : request.budget_hourly ? `~$${request.budget_hourly}/hr`
    : null
  const languages: string[] = request.languages?.length ? request.languages
    : request.languages_preferred?.length ? request.languages_preferred : []
  const startDate = request.start_date
    ? new Date(request.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  const fields: { label: string; value: string }[] = []
  if (schedule) fields.push({ label: 'Schedule', value: schedule })
  else if (request.schedule_type) fields.push({ label: 'Schedule', value: request.schedule_type === 'one_time' ? 'One-time' : 'Recurring' })
  if (request.hours_per_week) fields.push({ label: 'Hours', value: `${request.hours_per_week}/week` })
  if (pay) fields.push({ label: 'Pay', value: pay })
  if (city) fields.push({ label: 'Location', value: city })
  if (childrenAges?.length) fields.push({ label: 'Children', value: `ages ${[...childrenAges].sort((a, b) => a - b).join(', ')}` })
  if (languages.length) fields.push({ label: 'Languages', value: languages.join(', ') })
  if (startDate) fields.push({ label: 'Starts', value: startDate })

  const extras = [
    ...(request.requirements?.length ? [request.requirements.join(' · ')] : []),
    ...(request.extra_details ? [request.extra_details] : []),
  ]

  if (fields.length === 0 && extras.length === 0) return null

  return (
    <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
        {request.service_type ? `${request.service_type} request` : 'Request details'}
      </div>
      {fields.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {fields.map(f => (
            <div key={f.label} className="min-w-0">
              <span className="text-[11px] text-gray-400">{f.label}</span>
              <div className="text-xs font-medium text-gray-800 leading-snug break-words">{f.value}</div>
            </div>
          ))}
        </div>
      )}
      {extras.map((e, i) => (
        <p key={i} className="text-xs text-gray-500 leading-relaxed mt-2 line-clamp-3">{e}</p>
      ))}
    </div>
  )
}
