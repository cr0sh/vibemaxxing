import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { I18nContext, useI18n, type I18nValue } from './I18nContext'
import {
  createTranslator,
  englishCatalog,
  localeCatalogs,
  LOCALE_STORAGE_KEY,
  preferredLocale,
  resolveLocale,
  SUPPORTED_LOCALES,
  type Locale,
  type MessageKey,
} from './catalog'
import './LanguagePicker.css'



function initialLocale(): Locale {
  if (typeof window === 'undefined') return 'en'
  let stored: string | null = null
  try {
    stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
  } catch {
    // Browser privacy settings can disable persistence, not language selection.
  }
  return preferredLocale([...navigator.languages, navigator.language], stored)
}


export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)
  const setLocale = useCallback((next: Locale) => {
    const choice = resolveLocale(next)
    setLocaleState(choice)
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, choice)
    } catch {
      // Keep the selection for this session when browser storage is unavailable.
    }
  }, [])
  const value = useMemo<I18nValue>(() => {
    const formatters = new Map<string | undefined, Intl.NumberFormat>()
    const formatNumber = (number: number, options?: Intl.NumberFormatOptions): string => {
      const key = JSON.stringify(options)
      let formatter = formatters.get(key)
      if (formatter === undefined) {
        formatter = new Intl.NumberFormat(locale, options)
        formatters.set(key, formatter)
      }
      return formatter.format(number)
    }
    return {
      locale,
      setLocale,
      t: createTranslator(locale),
      formatNumber,
      formatCurrency: (number, currency = 'USD') => formatNumber(number, { style: 'currency', currency, maximumFractionDigits: 2 }),
    }
  }, [locale, setLocale])

  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = 'ltr'
  }, [locale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}


export function Localized({ message, values = {} }: { message: MessageKey; values?: Readonly<Record<string, ReactNode>> }) {
  const { locale } = useI18n()
  const template = localeCatalogs[locale][message] ?? englishCatalog[message]
  return <>{template.split(/\{([A-Za-z0-9_.-]+)\}/g).map((part, index) => {
    if (index % 2 === 0) return part
    if (!Object.hasOwn(values, part)) throw new Error(`Missing parameter "${part}" for message "${message}"`)
    return <Fragment key={index}>{values[part]}</Fragment>
  })}</>
}

export function LanguagePicker() {
  const { locale, setLocale, t } = useI18n()
  return (
    <label className="language-picker" title={t('language.picker.label')}>
      <span className="language-picker-globe" aria-hidden="true">🌐</span>
      <select
        value={locale}
        aria-label={t('language.picker.aria')}
        onChange={(event) => setLocale(resolveLocale(event.currentTarget.value))}
      >
        {SUPPORTED_LOCALES.map((option) => (
          <option key={option} value={option} lang={option}>{englishCatalog[`language.name.${option}`]}</option>
        ))}
      </select>
    </label>
  )
}
