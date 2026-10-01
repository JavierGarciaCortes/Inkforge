export const DIRECTOR_WIDTH_STORAGE_KEY = 'inkforge:director-width'
export const DEFAULT_DIRECTOR_WIDTH = 320
export const MAX_DIRECTOR_WIDTH = 640

function initialDirectorWidth(): number {
  return window.matchMedia('(max-width: 1080px)').matches ? 280 : DEFAULT_DIRECTOR_WIDTH
}

export function loadDirectorWidth(): number {
  try {
    const stored = window.localStorage.getItem(DIRECTOR_WIDTH_STORAGE_KEY)
    const width = stored === null ? NaN : Number(stored)
    return Number.isInteger(width) && width >= 260 && width <= MAX_DIRECTOR_WIDTH
      ? width
      : initialDirectorWidth()
  } catch {
    return initialDirectorWidth()
  }
}

export function saveDirectorWidth(width: number): void {
  try {
    window.localStorage.setItem(DIRECTOR_WIDTH_STORAGE_KEY, String(width))
  } catch {
    // Keep the selected width for this renderer session.
  }
}
