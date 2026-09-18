import { englishCatalog, type EnglishCatalog, type MessageKey } from './catalogs/en'

export const SUPPORTED_LOCALES = ['en', 'de', 'fr', 'es', 'ja', 'ko'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export type Catalog = { [K in MessageKey]: string }
export type PartialCatalog = Partial<Catalog>
export type MessageParams = Readonly<Record<string, string | number | null | undefined>>

/** Locale files supplied by translators are complete Catalog values. */
export type CompleteLocaleCatalog = EnglishCatalog

export function resolveLocale(input: string | null | undefined): Locale {
  const normalized = (input ?? '').trim().toLowerCase().replaceAll('_', '-')
  const base = normalized.split('-')[0]
  return SUPPORTED_LOCALES.includes(base as Locale) ? base as Locale : 'en'
}

export function interpolate(template: string, params?: MessageParams): string {
  if (params === undefined) return template
  return template.replaceAll(/\{([A-Za-z0-9_.-]+)\}/g, (placeholder, key: string) => {
    const value = params[key]
    return value === undefined || value === null ? placeholder : String(value)
  })
}

export function isCatalogComplete(catalog: PartialCatalog): catalog is Catalog {
  return Object.keys(englishCatalog).every((key) => typeof catalog[key as MessageKey] === 'string')
}

export function missingCatalogKeys(catalog: PartialCatalog): MessageKey[] {
  return (Object.keys(englishCatalog) as MessageKey[]).filter((key) => typeof catalog[key] !== 'string')
}

export function placeholderNames(value: string): string[] {
  return [...value.matchAll(/\{([A-Za-z0-9_.-]+)\}/g)].map((match) => match[1] ?? '')
}

export function placeholderParity(reference: string, translated: string): boolean {
  const expected = [...new Set(placeholderNames(reference))].sort()
  const actual = [...new Set(placeholderNames(translated))].sort()
  return expected.length === actual.length && expected.every((key, index) => key === actual[index])
}

export function catalogPlaceholderMismatches(catalog: PartialCatalog): MessageKey[] {
  return (Object.keys(englishCatalog) as MessageKey[]).filter((key) => {
    const translated = catalog[key]
    return translated !== undefined && !placeholderParity(englishCatalog[key], translated)
  })
}
