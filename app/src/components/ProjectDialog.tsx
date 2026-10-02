import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { CreateProjectInput, InkforgeProjectType } from '../types/inkforge'
import { GenrePicker } from './GenrePicker'
import { useGenreProfiles } from '../hooks/useGenreProfiles'

interface ProjectDialogProps {
  isCreating: boolean
  error: string | null
  onCancel: () => void
  onCreate: (input: CreateProjectInput) => void
}

export function ProjectDialog({
  isCreating,
  error,
  onCancel,
  onCreate,
}: ProjectDialogProps) {
  const { t } = useTranslation()
  const titleInputRef = useRef<HTMLInputElement>(null)
  const [type, setType] = useState<InkforgeProjectType>('novela')
  const [narrativeTitle, setNarrativeTitle] = useState('')
  const [firstBookTitle, setFirstBookTitle] = useState('')
  const [genres, setGenres] = useState<string[]>([])
  const { profiles, state: genreState, reload: reloadGenres } = useGenreProfiles()
  const [validationError, setValidationError] = useState<
    'saga-title' | 'book-title' | 'first-book-title' | null
  >(null)

  useEffect(() => {
    titleInputRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isCreating) {
        onCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isCreating, onCancel])

  const submitProject = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (narrativeTitle.trim().length === 0) {
      setValidationError(type === 'saga' ? 'saga-title' : 'book-title')
      return
    }

    if (type === 'saga' && firstBookTitle.trim().length === 0) {
      setValidationError('first-book-title')
      return
    }

    setValidationError(null)
    onCreate(type === 'saga'
      ? {
          type: 'saga',
          sagaTitle: narrativeTitle,
          firstBookTitle,
          genres,
        }
      : {
          type: 'novela',
          bookTitle: narrativeTitle,
          genres,
        })
  }

  return (
    <div
      className="dialog-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isCreating) {
          onCancel()
        }
      }}
    >
      <form
        className="confirm-dialog project-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-dialog-title"
        onSubmit={submitProject}
      >
        <span className="eyebrow">{t('common.library')}</span>
        <h2 id="project-dialog-title">{t('projectDialog.newWork')}</h2>

        <label className="project-dialog-field">
          <span>{t('projectDialog.workType')}</span>
          <select
            value={type}
            disabled={isCreating}
            onChange={(event) => {
              setType(event.target.value as InkforgeProjectType)
              setValidationError(null)
            }}
          >
            <option value="novela">{t('projectDialog.standaloneNovel')}</option>
            <option value="saga">{t('projectDialog.saga')}</option>
          </select>
        </label>

        <label className="project-dialog-field">
          <span>{type === 'saga' ? t('projectDialog.sagaTitle') : t('projectDialog.bookTitle')}</span>
          <input
            ref={titleInputRef}
            type="text"
            value={narrativeTitle}
            disabled={isCreating}
            autoComplete="off"
            onChange={(event) => {
              setNarrativeTitle(event.target.value)
              setValidationError(null)
            }}
          />
        </label>

        {type === 'saga' && (
          <label className="project-dialog-field">
            <span>{t('projectDialog.firstBookTitle')}</span>
            <input
              type="text"
              value={firstBookTitle}
              disabled={isCreating}
              autoComplete="off"
              onChange={(event) => {
                setFirstBookTitle(event.target.value)
                setValidationError(null)
              }}
            />
          </label>
        )}

        <GenrePicker
          profiles={profiles}
          selected={genres}
          onChange={setGenres}
          disabled={isCreating}
          label={t('genres.project')}
        />
        {genreState === 'loading' && <p>{t('genres.loading')}</p>}
        {genreState === 'error' && (
          <p className="project-dialog-error" role="alert">
            {t('genres.catalogError')}
            <button type="button" onClick={() => void reloadGenres()}>{t('common.retry')}</button>
          </p>
        )}

        {(validationError || error) && (
          <p className="project-dialog-error" role="alert">
            {validationError === 'saga-title'
              ? t('projectDialog.sagaTitleRequired')
              : validationError === 'book-title'
                ? t('projectDialog.bookTitleRequired')
                : validationError === 'first-book-title'
                  ? t('projectDialog.firstBookTitleRequired')
                  : error}
          </p>
        )}

        <div className="confirm-dialog-actions">
          <button
            className="dialog-button dialog-button-secondary"
            type="button"
            disabled={isCreating}
            onClick={onCancel}
          >
            {t('common.cancel')}
          </button>
          <button
            className="dialog-button project-dialog-create"
            type="submit"
            disabled={isCreating}
          >
            {isCreating ? t('projectDialog.creating') : t('projectDialog.create')}
          </button>
        </div>
      </form>
    </div>
  )
}
