export const SUPPORTED_LOCALES = ['es', 'en', 'ca', 'ko'] as const

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: SupportedLocale = 'es'
export const LOCALE_STORAGE_KEY = 'inkforge:locale'

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  es: 'Español',
  en: 'English',
  ca: 'Català',
  ko: '한국어',
}

export function isSupportedLocale(value: string): value is SupportedLocale {
  return SUPPORTED_LOCALES.includes(value as SupportedLocale)
}
