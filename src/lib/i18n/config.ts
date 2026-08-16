// Locale plumbing shared by server and client. No React, no 'use client' —
// src/app/layout.tsx (a server component) and the client provider both import
// this, so it must stay importable from either side.

export const LOCALES = ['en', 'zh'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'

// Locale lives in a cookie, not localStorage. layout.tsx is a server component
// and has to know the locale before the first byte in order to stamp
// <html lang>; localStorage is client-only, so the page would render as `en`
// and then flip. A cookie is readable in both places.
export const LOCALE_COOKIE = 'ruah_locale'

// One year. Nothing about a language choice needs to expire sooner.
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

export function normalizeLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE
}

// What goes in <html lang>. Screen readers and the browser's own translation
// prompt key off this, so it has to be a real BCP-47 tag, not our short code.
export const HTML_LANG: Record<Locale, string> = {
  en: 'en',
  zh: 'zh-CN',
}

export const LOCALE_LABEL: Record<Locale, string> = {
  en: 'EN',
  zh: '中文',
}
