import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { CreateBookInput } from '../types/inkforge'
import { GenrePicker } from './GenrePicker'
import { useGenreProfiles } from '../hooks/useGenreProfiles'

interface BookDialogProps {
  isCreating: boolean
  error: string | null
  onCancel: () => void
  onCreate: (input: CreateBookInput) => void
}

export function BookDialog({ isCreating, error, onCancel, onCreate }: BookDialogProps) {
  const { t } = useTranslation()
  const titleRef = useRef<HTMLInputElement>(null)
  const [bookTitle, setBookTitle] = useState('')
  const [inheritGenres, setInheritGenres] = useState(true)
  const [genres, setGenres] = useState<string[]>([])
  const [titleRequired, setTitleRequired] = useState(false)
  const { profiles, state: genreState, reload: reloadGenres } = useGenreProfiles()

  useEffect(() => {
    titleRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isCreating) onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isCreating, onCancel])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!bookTitle.trim()) {
      setTitleRequired(true)
      return
    }
    setTitleRequired(false)
    onCreate({ bookTitle, inheritGenres, genres })
  }

  return (
    <div className="dialog-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !isCreating) onCancel()
    }}>
      <form className="confirm-dialog project-dialog" role="dialog" aria-modal="true"
        aria-labelledby="book-dialog-title" onSubmit={submit}>
        <span className="eyebrow">{t('common.library')}</span>
        <h2 id="book-dialog-title">{t('dialogs.addBook')}</h2>
        <label className="project-dialog-field">
          <span>{t('dialogs.bookTitle')}</span>
          <input ref={titleRef} type="text" value={bookTitle} disabled={isCreating}
            autoComplete="off" onChange={(event) => {
              setBookTitle(event.target.value)
              setTitleRequired(false)
            }} />
        </label>
        <label className="genre-inherit">
          <input type="checkbox" checked={inheritGenres} disabled={isCreating}
            onChange={(event) => setInheritGenres(event.target.checked)} />
          <span>{t('genres.inherit')}</span>
        </label>
        <GenrePicker profiles={profiles} selected={genres} onChange={setGenres}
          disabled={isCreating} label={t('genres.book')} />
        {genreState === 'loading' && <p>{t('genres.loading')}</p>}
        {genreState === 'error' && (
          <p className="project-dialog-error" role="alert">
            {t('genres.catalogError')}
            <button type="button" onClick={() => void reloadGenres()}>{t('common.retry')}</button>
          </p>
        )}
        {(titleRequired || error) && (
          <p className="project-dialog-error" role="alert">
            {titleRequired ? t('nameDialog.titleRequired') : error}
          </p>
        )}
        <div className="confirm-dialog-actions">
          <button className="dialog-button dialog-button-secondary" type="button"
            disabled={isCreating} onClick={onCancel}>{t('common.cancel')}</button>
          <button className="dialog-button project-dialog-create" type="submit"
            disabled={isCreating}>{isCreating ? t('projectDialog.creating') : t('projectDialog.create')}</button>
        </div>
      </form>
    </div>
  )
}
