import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

interface NarrativeNameDialogProps {
  title: string
  label: string
  initialValue?: string
  submitLabel: string
  isSubmitting: boolean
  error: string | null
  onCancel: () => void
  exitLabel?: string
  onSubmit: (title: string) => void
}

export function NarrativeNameDialog({
  title,
  label,
  initialValue = '',
  submitLabel,
  isSubmitting,
  error,
  onCancel,
  exitLabel,
  onSubmit,
}: NarrativeNameDialogProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [narrativeTitle, setNarrativeTitle] = useState(initialValue)
  const [hasValidationError, setHasValidationError] = useState(false)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isSubmitting, onCancel])

  const submitName = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (narrativeTitle.trim().length === 0) {
      setHasValidationError(true)
      return
    }

    setHasValidationError(false)
    onSubmit(narrativeTitle)
  }

  return (
    <div
      className="dialog-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onCancel()
        }
      }}
    >
      <form
        className="confirm-dialog project-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="narrative-name-dialog-title"
        onSubmit={submitName}
      >
        <span className="eyebrow">{t('common.library')}</span>
        <h2 id="narrative-name-dialog-title">{title}</h2>

        <label className="project-dialog-field">
          <span>{label}</span>
          <input
            ref={inputRef}
            type="text"
            value={narrativeTitle}
            disabled={isSubmitting}
            autoComplete="off"
            onChange={(event) => {
              setNarrativeTitle(event.target.value)
              setHasValidationError(false)
            }}
          />
        </label>

        {(hasValidationError || error) && (
          <p className="project-dialog-error" role="alert">
            {hasValidationError ? t('nameDialog.titleRequired') : error}
          </p>
        )}

        <div className="confirm-dialog-actions">
          <button
            className="dialog-button dialog-button-secondary"
            type="button"
            disabled={isSubmitting}
            onClick={onCancel}
          >
            {exitLabel ?? t('common.cancel')}
          </button>
          <button
            className="dialog-button project-dialog-create"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? t('nameDialog.submitting') : submitLabel}
          </button>
        </div>
      </form>
    </div>
  )
}
