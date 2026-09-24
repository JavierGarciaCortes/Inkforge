import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  LOCALE_STORAGE_KEY,
} from './locales'
import type { SupportedLocale } from './locales'

function readStoredLocale(): SupportedLocale | null {
  try {
    const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    return storedLocale && isSupportedLocale(storedLocale) ? storedLocale : null
  } catch {
    return null
  }
}

function resolveNavigatorLocale(): SupportedLocale {
  const browserLocale = window.navigator.language.toLowerCase().split(/[-_]/u)[0] ?? ''
  return isSupportedLocale(browserLocale) ? browserLocale : DEFAULT_LOCALE
}

export function resolveInitialLocale(): SupportedLocale {
  return readStoredLocale() ?? resolveNavigatorLocale()
}

export function persistLocale(locale: SupportedLocale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // A blocked storage backend must not prevent changing the interface language.
  }
}
