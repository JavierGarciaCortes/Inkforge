export type ThemePreference = 'system' | 'dark' | 'light'

const STORAGE_KEY = 'inkforge:theme'
const listeners = new Set<() => void>()
let media: MediaQueryList | null = null

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'dark' || value === 'light'
}

function readPreference(): ThemePreference {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return isThemePreference(value) ? value : 'system'
  } catch {
    return 'system'
  }
}

let preference = readPreference()

function applyTheme() {
  document.documentElement.dataset.theme = preference === 'system'
    ? media?.matches ? 'dark' : 'light'
    : preference
}

export function initializeTheme() {
  if (!media) {
    media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', () => {
      if (preference === 'system') applyTheme()
    })
  }
  applyTheme()
}

export function getThemePreference() {
  return preference
}

export function subscribeTheme(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function changeTheme(next: ThemePreference) {
  preference = next
  try {
    window.localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Keep the preference usable in this renderer when storage is unavailable.
  }
  applyTheme()
  listeners.forEach((listener) => listener())
}
