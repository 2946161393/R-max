'use client'

import { useEffect, useRef, useState } from 'react'
import { CONTACT_EMAIL } from '@/lib/contact'

/* Contact address that works without a mail client.

   A bare `mailto:` link looks dead to anyone whose browser has no mail handler
   registered — common for people who live in webmail. The href is correct and
   the click does nothing visible, so the address is unreachable for exactly the
   users least equipped to work around it.

   So every contact surface shows the address as text and offers to copy it,
   while keeping the mailto for people who do have a client. Three ways out
   instead of one. */

function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    /* The Clipboard API needs a secure context and can be refused outright.
       Fall back to a selection copy so the button still does something. */
    const field = document.createElement('textarea')
    field.value = text
    field.setAttribute('readonly', '')
    field.style.position = 'fixed'
    field.style.top = '0'
    field.style.opacity = '0'
    document.body.appendChild(field)
    field.select()
    let copied = false
    try {
      copied = document.execCommand('copy')
    } catch {
      copied = false
    }
    document.body.removeChild(field)
    return copied
  }
}

export default function ContactEmail({
  label,
  subject,
  className,
  tone = 'default',
  cta,
}: {
  /** Optional prefix, e.g. "Email us" — rendered as "Email us: address". */
  label?: string
  /** Optional mailto subject line. */
  subject?: string
  className?: string
  /** `muted` suits the footer, where the address sits among quiet nav links. */
  tone?: 'default' | 'muted'
  /** When set, renders a primary button carrying the mailto, with the address
      and copy control beneath it. For surfaces that had a prominent CTA before
      the address became visible. */
  cta?: string
}) {
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  async function handleCopy() {
    const ok = await copyToClipboard(CONTACT_EMAIL)
    setCopied(ok)
    setFailed(!ok)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setCopied(false)
      setFailed(false)
    }, 2000)
  }

  const href = subject
    ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`
    : `mailto:${CONTACT_EMAIL}`

  const linkTone = tone === 'muted' ? 'text-ink-muted hover:text-ink' : 'text-brand-strong hover:underline'
  const buttonTone = tone === 'muted' ? 'text-ink-faint hover:text-ink' : 'text-ink-faint hover:text-brand-strong'

  const addressLine = (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
      {label ? <span>{label}:</span> : null}
      <a href={href} className={className ?? linkTone}>
        {CONTACT_EMAIL}
      </a>
      <button
        type="button"
        onClick={handleCopy}
        /* The label says what the button does, not what just happened — the
           status message below carries that, so a screen reader is not told
           "Copied" by an element the user is about to press again. */
        aria-label={`Copy ${CONTACT_EMAIL} to clipboard`}
        className={`inline-flex items-center justify-center rounded p-1 transition ${buttonTone}`}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
      {/* Always mounted so the announcement lands, but visually silent unless
          the copy failed. Left in the layout while empty it would open a gap
          before the next character, which shows up as "address ⧉ ." mid-
          sentence in the legal pages. `sr-only` takes it out of flow, so the
          success case is carried by the icon swapping to a check. */}
      <span
        role="status"
        aria-live="polite"
        className={failed ? 'text-xs text-ink-faint' : 'sr-only'}
      >
        {copied ? 'Copied' : failed ? 'Press to select, then copy' : ''}
      </span>
    </span>
  )

  if (!cta) return addressLine

  return (
    <div>
      <a
        href={href}
        className="inline-block bg-brand-gradient text-white px-6 py-3 rounded-control font-semibold"
      >
        {cta}
      </a>
      <p className="text-sm text-ink-muted mt-3">{addressLine}</p>
    </div>
  )
}
