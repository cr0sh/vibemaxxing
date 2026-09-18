import { describe, expect, test } from 'bun:test'
import {
  catalogPlaceholderMismatches,
  createTranslator,
  englishCatalog,
  isCatalogComplete,
  localeCatalogs,
  missingCatalogKeys,
  placeholderParity,
  preferredLocale,
  resolveLocale,
  SUPPORTED_LOCALES,
  type MessageKey,
  type MessageReference,
} from '../src/i18n/catalog'

describe('locale selection', () => {
  test('regional browser locales select the six supported languages', () => {
    expect(['en-GB', 'de-DE', 'fr-CA', 'es-MX', 'ja-JP', 'KO_kr'].map(resolveLocale))
      .toEqual(['en', 'de', 'fr', 'es', 'ja', 'ko'])
    expect(resolveLocale('pt-BR')).toBe('en')
    expect(resolveLocale(null)).toBe('en')
  })

  test('browser preference order includes English rather than skipping it', () => {
    expect(preferredLocale(['en-US', 'ko-KR'])).toBe('en')
    expect(preferredLocale(['pt-BR', 'ja-JP', 'de-DE'])).toBe('ja')
    expect(preferredLocale(['zh-CN'])).toBe('en')
  })

  test('a supported explicit choice wins, but an invalid saved choice does not', () => {
    expect(preferredLocale(['ko-KR'], 'fr-CA')).toBe('fr')
    expect(preferredLocale(['de-DE'], 'unsupported')).toBe('de')
  })
})

describe('localized messages', () => {
  test('interpolation preserves zero and does not reinterpret user text as keys or templates', () => {
    const t = createTranslator('en', { 'common.tokens': '[{amount}]' })
    expect(t('common.tokens', { amount: 0 })).toBe('[0]')
    expect(t('common.tokens', { amount: 'task.standard.0.title {other} <script>' }))
      .toBe('[task.standard.0.title {other} <script>]')
  })

  test('stored nested messages render in the current language without mutating history', () => {
    const failure: MessageReference = {
      key: 'ending.deadlineFailure',
      params: { title: { key: 'task.standard.0.title' }, company: 'Prompt & Circumstance' },
    }
    const before = structuredClone(failure)
    const english = createTranslator('en', {
      'ending.deadlineFailure': '{company}: {title}',
      'task.standard.0.title': 'Onboarding',
    })
    const german = createTranslator('de', {
      'ending.deadlineFailure': '{title} / {company}',
      'task.standard.0.title': 'Einarbeitung',
    })
    expect(english(failure)).toBe('Prompt & Circumstance: Onboarding')
    expect(german(failure)).toBe('Einarbeitung / Prompt & Circumstance')
    expect(failure).toEqual(before)
  })

  test('missing required interpolation values fail rather than leaking placeholders', () => {
    const t = createTranslator('en', { 'common.tokens': '{amount}' })
    expect(() => t('common.tokens')).toThrow(/amount/)
  })

  test('missing translated entries fall back to the English message', () => {
    expect(createTranslator('fr', {})('common.off')).toBe(createTranslator('en')('common.off'))
  })

  test('catalog validation rejects blank entries and changed placeholder contracts', () => {
    expect(isCatalogComplete(englishCatalog)).toBe(true)
    expect(missingCatalogKeys({ ...englishCatalog, 'common.off': '' })).toEqual(['common.off'])
    expect(catalogPlaceholderMismatches({ ...englishCatalog, 'common.tokens': '{other}' })).toEqual(['common.tokens'])
    expect(placeholderParity('{first} then {second}', '{second} / {first}')).toBe(true)
  })

  test('every shipped locale covers the catalog without blank entries or changed placeholders', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(missingCatalogKeys(localeCatalogs[locale]), `${locale} missing translations`).toEqual([])
      expect(catalogPlaceholderMismatches(localeCatalogs[locale]), `${locale} interpolation contract`).toEqual([])
    }
  })

  test('localized dialogue preserves product, model, and company identities', () => {
    const names = [
      'Vibemaxxer', 'Tiro Labs', 'Tiro Max', 'Tiro', 'Mapple Spark Ultra', 'Mapple Spark',
      'Mapple', 'ConvexLM Reasoning', 'ConvexLM Pro', 'Mercury', 'Shorts', 'YOLO', 'GIPHY', 'BTC', 'USD',
    ]
    for (const locale of SUPPORTED_LOCALES) {
      if (locale === 'en') continue
      for (const key of Object.keys(englishCatalog) as MessageKey[]) {
        for (const name of names) {
          if (englishCatalog[key].includes(name)) {
            expect(localeCatalogs[locale][key], `${locale}:${key}`).toContain(name)
          }
        }
      }
    }
  })
})
