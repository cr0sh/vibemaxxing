import { createContext, useContext } from 'react'
import type { Locale, Translate } from './catalog'

export type I18nValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: Translate
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string
  formatCurrency: (value: number, currency?: string) => string
}

export const I18nContext = createContext<I18nValue | null>(null)

export function useI18n(): I18nValue {
  const value = useContext(I18nContext)
  if (value === null) throw new Error('useI18n requires I18nProvider')
  return value
}
