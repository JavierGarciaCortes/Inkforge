import { useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { ActiveBook, ActiveProject } from '../types/inkforge'

interface WorkManagementDialogProps {
  project: NonNullable<ActiveProject>
  activeBook: ActiveBook
  isProjectBusy: boolean
  isActiveBookAvailable: boolean
  onCancel: () => void
  onRenameProject: () => void
  onConfigureGenres: () => void
  onAddBook: () => void
  onRenameBook: () => void
}

export function WorkManagementDialog({
  project,
  activeBook,
  isProjectBusy,
  isActiveBookAvailable,
  onCancel,
  onRenameProject,
  onConfigureGenres,
  onAddBook,
  onRenameBook,
}: WorkManagementDialogProps) {
  const { t } = useTranslation()
  const firstActionRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previousFocus = document.activeElement
    firstActionRef.current?.focus()
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus()
      }
    }
  }, [])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
      return
    }

    if (event.key !== 'Tab') return
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }

  return (
    <div className="dialog-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel()
    }}>
      <div
        className="confirm-dialog work-management-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="work-management-title"
        onKeyDown={handleKeyDown}
      >
        <span className="eyebrow">{t('sidebar.activeWork')}</span>
        <h2 id="work-management-title">{t('sidebar.manageWork')}</h2>

        <section className="work-management-section" aria-labelledby="work-management-project">
          <h3 id="work-management-project">{project.title}</h3>
          <div className="work-management-actions">
            <button ref={firstActionRef} className="dialog-button" type="button"
              disabled={isProjectBusy} aria-haspopup="dialog" onClick={onRenameProject}>
              {project.type === 'saga' ? t('sidebar.renameSaga') : t('sidebar.renameBook')}
            </button>
            <button className="dialog-button" type="button"
              disabled={isProjectBusy} aria-haspopup="dialog" onClick={onConfigureGenres}>
              {t('genres.title')}
            </button>
            {project.type === 'saga' && (
              <button className="dialog-button" type="button"
                disabled={isProjectBusy} aria-haspopup="dialog" onClick={onAddBook}>
                {t('sidebar.addBook')}
              </button>
            )}
          </div>
        </section>

        {project.type === 'saga' && activeBook && (
          <section className="work-management-section" aria-labelledby="work-management-book">
            <h3 id="work-management-book">
              {t('sidebar.activeBook')}: {isActiveBookAvailable
                ? activeBook.title
                : t('common.unavailable', { title: activeBook.title })}
            </h3>
            <div className="work-management-actions">
              <button className="dialog-button" type="button"
                disabled={isProjectBusy || !isActiveBookAvailable} aria-haspopup="dialog"
                onClick={onRenameBook}>
                {t('sidebar.renameBook')}
              </button>
            </div>
          </section>
        )}

        <div className="confirm-dialog-actions">
          <button className="dialog-button dialog-button-secondary" type="button" onClick={onCancel}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
