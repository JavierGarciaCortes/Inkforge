import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { GenreConfiguration, InkforgeProjectType } from '../types/inkforge'
import { GenrePicker } from './GenrePicker'
import { useGenreProfiles } from '../hooks/useGenreProfiles'

interface Props {
  projectId: string
  projectType: InkforgeProjectType
  bookId: string | null
  onCancel: () => void
  exitLabel?: string
}

export function GenreConfigurationDialog({ projectId, projectType, bookId, onCancel, exitLabel }: Props) {
  const { t } = useTranslation()
  const { profiles, state: genreState, reload: reloadGenres } = useGenreProfiles()
  const [configuration, setConfiguration] = useState<GenreConfiguration | null>(null)
  const [projectGenres, setProjectGenres] = useState<string[]>([])
  const [bookGenres, setBookGenres] = useState<string[]>([])
  const [inheritGenres, setInheritGenres] = useState(true)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [busy, onCancel])

  useEffect(() => {
    let active = true
    void Promise.resolve().then(() => window.inkforge?.library.getGenreConfiguration()).then((value) => {
      if (!active) return
      if (!value) throw new Error(t('genres.configurationError'))
      setConfiguration(value)
      setProjectGenres(value.projectGenres)
      setBookGenres(value.bookGenres ?? [])
      setInheritGenres(value.inheritProjectGenres ?? true)
      setState('ready')
    }).catch(() => { if (active) setState('error') })
    return () => { active = false }
  }, [projectId, bookId, t])

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!window.inkforge || !configuration || busy) return
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      const hasActiveBook = projectType === 'saga' && bookId !== null &&
        configuration.bookGenres !== null && configuration.inheritProjectGenres !== null
      const result = await window.inkforge.library.updateGenreConfiguration({
        projectId,
        bookId: hasActiveBook ? bookId : null,
        projectGenres,
        expectedProjectGenres: configuration.projectGenres,
        expectedProjectRevision: configuration.projectRevision,
        bookGenres: hasActiveBook ? bookGenres : null,
        expectedBookGenres: hasActiveBook ? configuration.bookGenres : null,
        expectedBookRevision: hasActiveBook ? configuration.bookRevision : null,
        inheritProjectGenres: hasActiveBook ? inheritGenres : null,
        expectedInheritProjectGenres: hasActiveBook ? configuration.inheritProjectGenres : null,
      })
      if (!result.ok) {
        setError(t('genres.externalConflict'))
        return
      }
      setConfiguration(result.configuration)
      setProjectGenres(result.configuration.projectGenres)
      setBookGenres(result.configuration.bookGenres ?? [])
      setInheritGenres(result.configuration.inheritProjectGenres ?? true)
      setSaved(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('genres.saveError'))
    } finally { setBusy(false) }
  }

  const effective = inheritGenres && projectType === 'saga' && bookId
    ? [...new Set([...projectGenres, ...bookGenres])]
    : bookId ? bookGenres : projectGenres

  return (
    <div className="dialog-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onCancel()
    }}>
      <div className="confirm-dialog genre-configuration-dialog" role="dialog" aria-modal="true"
        aria-labelledby="genre-configuration-title">
        <span className="eyebrow">{t('common.library')}</span>
        <h2 id="genre-configuration-title">{t('genres.title')}</h2>
        {state === 'loading' && <p>{t('genres.loading')}</p>}
        {state === 'error' && <p role="alert">{t('genres.configurationError')}</p>}
        {state === 'ready' && configuration && (
          <>
            <form onSubmit={(event) => void save(event)}>
              <GenrePicker profiles={profiles} selected={projectGenres} onChange={(next) => {
                setProjectGenres(next)
                setSaved(false)
              }} disabled={busy} catalogReady={genreState === 'ready'}
                label={projectType === 'saga' ? t('genres.saga') : t('genres.project')} />
              {projectType === 'saga' && bookId && configuration.bookGenres !== null && (
                <>
                <label className="genre-inherit">
                  <input type="checkbox" checked={inheritGenres} disabled={busy}
                    onChange={(event) => { setInheritGenres(event.target.checked); setSaved(false) }} />
                  <span>{t('genres.inherit')}</span>
                </label>
                <GenrePicker profiles={profiles} selected={bookGenres} onChange={(next) => {
                  setBookGenres(next)
                  setSaved(false)
                }} disabled={busy} catalogReady={genreState === 'ready'} label={t('genres.book')} />
                </>
              )}
              <button className="dialog-button project-dialog-create" type="submit" disabled={busy}>
                {t('genres.save')}
              </button>
            </form>
            <p>{t('genres.effective')}: {effective.join(', ') || t('genres.noneAssigned')}</p>
          </>
        )}
        {genreState === 'loading' && <p>{t('genres.loading')}</p>}
        {genreState === 'error' && (
          <p className="project-dialog-error" role="alert">
            {t('genres.catalogError')}
            <button type="button" onClick={() => void reloadGenres()}>{t('common.retry')}</button>
          </p>
        )}
        {error && <p className="project-dialog-error" role="alert">{error}</p>}
        {saved && <p role="status">{t('genres.saved')}</p>}
        <div className="confirm-dialog-actions">
          <button className="dialog-button dialog-button-secondary" type="button" disabled={busy}
            onClick={onCancel}>{exitLabel ?? t('common.close')}</button>
        </div>
      </div>
    </div>
  )
}
