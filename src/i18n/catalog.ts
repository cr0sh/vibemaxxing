import { englishCatalog, type MessageKey } from './catalogs/en'
import { germanCatalog } from './catalogs/de'
import { frenchCatalog } from './catalogs/fr'
import { spanishCatalog } from './catalogs/es'
import { japaneseCatalog } from './catalogs/ja'
import { koreanCatalog } from './catalogs/ko'

export type { MessageKey } from './catalogs/en'
export { englishCatalog }

export const SUPPORTED_LOCALES = ['en', 'de', 'fr', 'es', 'ja', 'ko'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export type Catalog = { [K in MessageKey]: string }
export type PartialCatalog = Partial<Catalog>
export type MessageReference = { readonly key: MessageKey; readonly params?: MessageParams }
export type MessageParams = Readonly<Record<string, string | number | MessageReference>>
export type Translate = (message: MessageKey | MessageReference, params?: MessageParams) => string

export const localeCatalogs: Record<Locale, Catalog> = {
  en: englishCatalog,
  de: germanCatalog,
  fr: frenchCatalog,
  es: spanishCatalog,
  ja: japaneseCatalog,
  ko: koreanCatalog,
}

export const LOCALE_STORAGE_KEY = 'vibemaxxer.locale'

export function matchLocale(input: string | null | undefined): Locale | null {
  const base = (input ?? '').trim().toLowerCase().replaceAll('_', '-').split('-')[0]
  return SUPPORTED_LOCALES.includes(base as Locale) ? base as Locale : null
}

export function resolveLocale(input: string | null | undefined): Locale {
  return matchLocale(input) ?? 'en'
}

export function preferredLocale(candidates: readonly string[], stored?: string | null): Locale {
  const choice = matchLocale(stored)
  if (choice !== null) return choice
  for (const candidate of candidates) {
    const locale = matchLocale(candidate)
    if (locale !== null) return locale
  }
  return 'en'
}

export function createTranslator(locale: Locale, catalog: PartialCatalog = localeCatalogs[locale]): Translate {
  const translate: Translate = (message, params) => {
    const key = typeof message === 'string' ? message : message.key
    const values = typeof message === 'string' ? params : message.params
    const template = catalog[key] ?? englishCatalog[key]
    return template.replaceAll(/\{([A-Za-z0-9_.-]+)\}/g, (_, name: string) => {
      const value = values?.[name]
      if (value === undefined) throw new Error(`Missing parameter "${name}" for message "${key}"`)
      return typeof value === 'object' ? translate(value) : String(value)
    })
  }
  return translate
}

export function missingCatalogKeys(catalog: PartialCatalog): MessageKey[] {
  return (Object.keys(englishCatalog) as MessageKey[]).filter((key) => {
    const value = catalog[key]
    return typeof value !== 'string' || value.trim().length === 0
  })
}

export function isCatalogComplete(catalog: PartialCatalog): catalog is Catalog {
  return missingCatalogKeys(catalog).length === 0
}

export function placeholderNames(value: string): string[] {
  return [...value.matchAll(/\{([A-Za-z0-9_.-]+)\}/g)].map((match) => match[1]!)
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
