'use client'

import { useEffect, useRef, useState } from 'react'

/* Cal.com inline booking embed.

   Why a script and not a plain <iframe src={bookingUrl}>: Cal.com's booking
   page hides its own content when it detects it is framed and no embed handshake
   arrives from the parent. Framed directly it paints briefly, then blanks — this
   was verified against the live link in a bare page and in this one. Their embed
   script is the supported way to frame Cal.com; it creates the iframe itself,
   completes the handshake, and keeps the frame sized to the content.

   The script is the only third-party code on this page. If it is blocked or
   fails, the fallback link below still gets the family to the booking page, so a
   blocked script costs the embed, never the booking. */

const EMBED_SCRIPT = 'https://app.cal.com/embed/embed.js'
const CAL_ORIGIN = 'https://cal.com'
const NAMESPACE = 'concierge'

type CalApi = ((...args: unknown[]) => void) & {
  q?: unknown[][]
  ns?: Record<string, CalApi>
  loaded?: boolean
}

declare global {
  interface Window {
    Cal?: CalApi
  }
}

/* Cal.com's official loader, ported from the snippet in their embed docs. It
   puts a queue on window.Cal so calls made before embed.js finishes downloading
   are replayed once it does. */
function calLoader(onScriptError: () => void): CalApi {
  if (window.Cal) return window.Cal

  const push = (target: CalApi, args: unknown[]) => {
    target.q = target.q || []
    target.q.push(args)
  }

  const cal = function (...args: unknown[]) {
    if (!cal.loaded) {
      cal.ns = {}
      cal.q = cal.q || []
      const script = document.createElement('script')
      script.src = EMBED_SCRIPT
      script.async = true
      script.addEventListener('error', onScriptError)
      document.head.appendChild(script)
      cal.loaded = true
    }

    if (args[0] === 'init') {
      const namespace = args[1]
      if (typeof namespace === 'string') {
        const api = function (...inner: unknown[]) {
          push(api, inner)
        } as CalApi
        cal.ns![namespace] = cal.ns![namespace] || api
        push(cal.ns![namespace], args)
        push(cal, ['initNamespace', namespace])
      } else {
        push(cal, args)
      }
      return
    }

    push(cal, args)
  } as CalApi

  window.Cal = cal
  return cal
}

export default function CalEmbed({
  calLink,
  bookingUrl,
  fallbackLabel,
}: {
  /** Team/event slug, e.g. `ruah-team/talk-with-the-ruah-team`. */
  calLink: string
  /** Full booking URL, used by the always-available fallback link. */
  bookingUrl: string
  fallbackLabel: string
}) {
  const container = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)
  const [scriptFailed, setScriptFailed] = useState(false)

  useEffect(() => {
    const el = container.current
    /* Initialise once per element. React runs effects twice in development, and
       asking Cal.com to embed twice into the same node leaves it flickering
       between a rendered calendar and an empty frame. */
    if (!el || initialized.current) return
    initialized.current = true

    const cal = calLoader(() => setScriptFailed(true))
    cal('init', NAMESPACE, { origin: CAL_ORIGIN })
    cal.ns![NAMESPACE]('inline', {
      elementOrSelector: el,
      calLink,
      config: { layout: 'month_view' },
    })

    return () => {
      /* Leave nothing behind for a remount to stack a second embed on. */
      el.replaceChildren()
      initialized.current = false
    }
  }, [calLink])

  return (
    <div>
      {!scriptFailed && (
        <div
          ref={container}
          /* min-height holds the space Cal.com is about to fill, so the page
             below does not jump when the embed finishes loading. */
          className="bg-surface rounded-card border border-line overflow-hidden min-h-[42rem]"
        />
      )}
      <p className="text-xs text-ink-faint mt-4">
        <a
          href={bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-strong font-medium hover:underline"
        >
          {fallbackLabel} →
        </a>
      </p>
    </div>
  )
}
