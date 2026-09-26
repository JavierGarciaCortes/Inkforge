import type { OpenCodeModelSelection } from '../types/inkforge'

export const OPEN_CODE_MODEL_SELECTION_STORAGE_KEY = 'inkforge:opencode-model-selection'

function isStoredSelection(value: unknown): value is OpenCodeModelSelection {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const selection = value as Record<string, unknown>
  return (
    typeof selection.providerID === 'string' &&
    selection.providerID.length > 0 &&
    typeof selection.modelID === 'string' &&
    selection.modelID.length > 0 &&
    (
      selection.variant === undefined ||
      typeof selection.variant === 'string'
    ) &&
    (
      selection.displayName === undefined ||
      (typeof selection.displayName === 'string' && selection.displayName.length <= 300)
    )
  )
}

export function loadOpenCodeModelSelection(): OpenCodeModelSelection | null {
  try {
    const storedValue = window.localStorage.getItem(OPEN_CODE_MODEL_SELECTION_STORAGE_KEY)

    if (!storedValue) {
      return null
    }

    const parsedValue: unknown = JSON.parse(storedValue)
    return isStoredSelection(parsedValue) ? parsedValue : null
  } catch {
    return null
  }
}

export function saveOpenCodeModelSelection(selection: OpenCodeModelSelection) {
  try {
    window.localStorage.setItem(
      OPEN_CODE_MODEL_SELECTION_STORAGE_KEY,
      JSON.stringify(selection),
    )
  } catch {
    // The selection remains usable for the current renderer session.
  }
}
