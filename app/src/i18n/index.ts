import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { persistLocale, resolveInitialLocale } from './locale-storage'
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
} from './locales'
import type { SupportedLocale } from './locales'
import ca from './resources/ca'
import en from './resources/en'
import es from './resources/es'
import ko from './resources/ko'

let initialization: Promise<void> | null = null

function applyLocale(locale: SupportedLocale): void {
  document.documentElement.lang = locale
  persistLocale(locale)
}

export function initializeI18n(): Promise<void> {
  if (initialization) {
    return initialization
  }

  const initialLocale = resolveInitialLocale()

  initialization = i18n
    .use(initReactI18next)
    .init({
      resources: {
        es: { translation: es },
        en: { translation: en },
        ca: { translation: ca },
        ko: { translation: ko },
      },
      lng: initialLocale,
      fallbackLng: DEFAULT_LOCALE,
      interpolation: {
        escapeValue: false,
      },
    })
    .then(() => {
      applyLocale(initialLocale)
      i18n.on('languageChanged', (language) => {
        applyLocale(isSupportedLocale(language) ? language : DEFAULT_LOCALE)
      })
    })

  return initialization
}

export function changeLocale(locale: SupportedLocale): Promise<unknown> {
  return i18n.changeLanguage(locale)
}

export { i18n }
export {
  isSupportedLocale,
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
} from './locales'
export type { SupportedLocale } from './locales'
