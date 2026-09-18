import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { germanCatalog } from './catalogs/de'
import { spanishCatalog } from './catalogs/es'
import { frenchCatalog } from './catalogs/fr'
import { englishCatalog } from './catalogs/en'
import { japaneseCatalog } from './catalogs/ja'
import { koreanCatalog } from './catalogs/ko'
import {
  interpolate,
  resolveLocale,
  SUPPORTED_LOCALES,
  type Catalog,
  type Locale,
  type MessageKey,
  type MessageParams,
  type PartialCatalog,
} from './catalog'
import './LanguagePicker.css'

export * from './catalog'
export { englishCatalog } from './catalogs/en'
export { germanCatalog } from './catalogs/de'
export { frenchCatalog } from './catalogs/fr'
export { spanishCatalog } from './catalogs/es'
export { japaneseCatalog } from './catalogs/ja'
export { koreanCatalog } from './catalogs/ko'

export const localeCatalogs: Record<Locale, PartialCatalog> = {
  en: englishCatalog,
  de: germanCatalog,
  fr: frenchCatalog,
  es: spanishCatalog,
  ja: japaneseCatalog,
  ko: koreanCatalog,
}

const STORAGE_KEY = 'vibemaxxer.locale'

export type Translate = <K extends MessageKey>(key: K, params?: MessageParams) => string

export type I18nValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: Translate
  catalog: Catalog
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string
  formatCurrency: (value: number, currency?: string) => string
}

function initialLocale(): Locale {
  if (typeof window === 'undefined') return 'en'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored !== null) return resolveLocale(stored)
  const candidates = [...(navigator.languages ?? []), navigator.language]
  return candidates.map(resolveLocale).find((candidate) => candidate !== 'en') ?? resolveLocale(candidates[0])
}

function mergedCatalog(locale: Locale): Catalog {
  return { ...englishCatalog, ...localeCatalogs[locale] } as Catalog
}

export function createTranslator(locale: Locale): Translate {
  const catalog = mergedCatalog(locale)
  return ((key: MessageKey, params?: MessageParams) => interpolate(catalog[key] ?? englishCatalog[key], params)) as Translate
}

const defaultValue: I18nValue = {
  locale: 'en',
  setLocale: () => undefined,
  t: createTranslator('en'),
  catalog: englishCatalog as Catalog,
  formatNumber: (value, options) => new Intl.NumberFormat('en-US', options).format(value),
  formatCurrency: (value, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value),
}

const I18nContext = createContext<I18nValue>(defaultValue)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)
  const catalog = useMemo(() => mergedCatalog(locale), [locale])
  const t = useMemo<Translate>(() => ((key, params) => interpolate(catalog[key] ?? englishCatalog[key], params)), [catalog])
  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale)
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, nextLocale)
  }
  const value = useMemo<I18nValue>(() => ({
    locale,
    setLocale,
    t,
    catalog,
    formatNumber: (number, options) => new Intl.NumberFormat(locale, options).format(number),
    formatCurrency: (number, currency = 'USD') => new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(number),
  }), [catalog, locale, t])

  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = 'ltr'
  }, [locale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  return useContext(I18nContext)
}

export function LanguagePicker() {
  const { locale, setLocale, t } = useI18n()
  return (
    <label className="language-picker">
      <span className="language-picker-globe" aria-hidden="true">🌐</span>
      <span className="language-picker-label">{t('language.picker.label')}</span>
      <select
        value={locale}
        aria-label={t('language.picker.aria')}
        onChange={(event) => setLocale(resolveLocale(event.currentTarget.value))}
      >
        {SUPPORTED_LOCALES.map((option) => {
          const nameKey = `language.name.${option}` as const
          return <option key={option} value={option}>{t(nameKey)}</option>
        })}
      </select>
    </label>
  )
}
