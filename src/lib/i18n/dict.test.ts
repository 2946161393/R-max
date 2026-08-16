import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DICT, en, zh } from './dict.ts'
import { LOCALES, DEFAULT_LOCALE, isLocale, normalizeLocale, HTML_LANG } from './config.ts'

// The Record<MessageKey, string> annotation on `zh` already makes a MISSING key
// a type error. These cover what the type cannot: a key present but empty, a
// key that exists only in zh, and copy that was pasted across without being
// translated. `npm test` runs them.

describe('i18n dictionary', () => {
  it('en and zh carry exactly the same keys', () => {
    const enKeys = Object.keys(en).sort()
    const zhKeys = Object.keys(zh).sort()

    const missingInZh = enKeys.filter(k => !zhKeys.includes(k))
    const extraInZh = zhKeys.filter(k => !enKeys.includes(k))

    assert.deepEqual(missingInZh, [], `missing from zh: ${missingInZh.join(', ')}`)
    assert.deepEqual(extraInZh, [], `in zh but not en: ${extraInZh.join(', ')}`)
  })

  it('no string is empty or whitespace-only in any locale', () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(DICT[locale])) {
        assert.equal(typeof value, 'string', `${locale}.${key} is not a string`)
        assert.ok(value.trim().length > 0, `${locale}.${key} is empty`)
      }
    }
  })

  it('every zh string that should differ from en actually does', () => {
    // Some strings are legitimately identical across locales — a person's name
    // in the demo card, for instance. Everything else being identical means the
    // English was pasted in and never translated.
    const ALLOWED_IDENTICAL = new Set(['home.card.matchName'])

    const untranslated = Object.keys(en).filter(
      k =>
        !ALLOWED_IDENTICAL.has(k) &&
        zh[k as keyof typeof en] === en[k as keyof typeof en]
    )

    assert.deepEqual(
      untranslated,
      [],
      `identical to the English, so probably untranslated: ${untranslated.join(', ')}`
    )
  })

  it('every zh string actually contains Chinese', () => {
    // Catches the other half of the same mistake: a string that was edited but
    // is still Latin-only. Keys whose value is deliberately symbolic (emoji,
    // punctuation, a proper noun) are exempt.
    const EXEMPT = new Set(['home.card.matchName'])
    const HAN = /\p{Script=Han}/u

    const noHan = Object.keys(zh).filter(
      k => !EXEMPT.has(k) && !HAN.test(zh[k as keyof typeof en])
    )

    assert.deepEqual(noHan, [], `zh value has no Chinese characters: ${noHan.join(', ')}`)
  })
})

describe('i18n config', () => {
  it('the default locale is one of the supported locales', () => {
    assert.ok(LOCALES.includes(DEFAULT_LOCALE))
  })

  it('every locale has an html lang tag', () => {
    for (const locale of LOCALES) {
      assert.ok(HTML_LANG[locale], `no HTML_LANG for ${locale}`)
    }
  })

  it('isLocale accepts supported codes and rejects everything else', () => {
    for (const locale of LOCALES) assert.equal(isLocale(locale), true)
    for (const bad of ['fr', '', 'ZH', 'en-US', null, undefined, 7, {}]) {
      assert.equal(isLocale(bad), false, `isLocale(${JSON.stringify(bad)}) should be false`)
    }
  })

  it('normalizeLocale falls back rather than throwing on junk', () => {
    // The cookie is attacker-controllable — it must never be trusted into an
    // index without passing through here first.
    assert.equal(normalizeLocale('zh'), 'zh')
    assert.equal(normalizeLocale('fr'), DEFAULT_LOCALE)
    assert.equal(normalizeLocale(undefined), DEFAULT_LOCALE)
    assert.equal(normalizeLocale('__proto__'), DEFAULT_LOCALE)
    assert.equal(normalizeLocale({ toString: () => 'zh' }), DEFAULT_LOCALE)
  })
})
