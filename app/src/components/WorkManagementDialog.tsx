import { useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { ActiveBook, ActiveProject, LibraryBookSummary } from '../types/inkforge'

interface WorkManagementDialogProps {
  project: NonNullable<ActiveProject>
  activeBook: ActiveBook
  books: LibraryBookSummary[]
  isProjectBusy: boolean
  isActiveBookAvailable: boolean
  error: string | null
  notice: string | null
  onCancel: () => void
  onRenameProject: () => void
  onConfigureGenres: () => void
  onAddBook: () => void
  onRenameBook: () => void
  onMoveBook: (bookId: string, direction: 'up' | 'down') => void
  onExtractBook: (book: LibraryBookSummary) => void
  onDeleteBook: (book: LibraryBookSummary) => void
  onDeleteProject: () => void
}

export function WorkManagementDialog({
  project,
  activeBook,
  books,
  isProjectBusy,
  isActiveBookAvailable,
  error,
  notice,
  onCancel,
  onRenameProject,
  onConfigureGenres,
  onAddBook,
  onRenameBook,
  onMoveBook,
  onExtractBook,
  onDeleteBook,
  onDeleteProject,
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
        {error && <p className="project-dialog-error" role="alert">{error}</p>}
        {notice && <p className="work-management-notice" role="status">{notice}</p>}

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

        {project.type === 'saga' && (
          <section className="work-management-section" aria-labelledby="work-management-books">
            <h3 id="work-management-books">{t('libraryManagement.sagaBooks')}</h3>
            {books.length === 0 ? (
              <p className="work-management-empty">{t('libraryManagement.noBooks')}</p>
            ) : (
              <ol className="work-management-book-list">
                {books.map((book, index) => {
                  const isActive = activeBook?.id === book.id && isActiveBookAvailable
                  return (
                    <li key={book.id} className="work-management-book-row">
                      <span className="work-management-book-title">
                        <strong>{book.number}.</strong> {book.title}
                        {isActive && <span>{t('libraryManagement.activeBookMarker')}</span>}
                      </span>
                      <div className="work-management-book-actions">
                        <button className="dialog-button dialog-button-compact" type="button"
                          disabled={isProjectBusy || index === 0}
                          onClick={() => onMoveBook(book.id, 'up')}>
                          {t('libraryManagement.moveUp')}
                        </button>
                        <button className="dialog-button dialog-button-compact" type="button"
                          disabled={isProjectBusy || index === books.length - 1}
                          onClick={() => onMoveBook(book.id, 'down')}>
                          {t('libraryManagement.moveDown')}
                        </button>
                        {isActive && (
                          <button className="dialog-button dialog-button-compact" type="button"
                            disabled={isProjectBusy} aria-haspopup="dialog" onClick={onRenameBook}>
                            {t('sidebar.renameBook')}
                          </button>
                        )}
                        <button className="dialog-button dialog-button-compact" type="button"
                          disabled={isProjectBusy} onClick={() => onExtractBook(book)}>
                          {t('libraryManagement.extractBook')}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>
        )}

        <section className="work-management-section work-management-danger-zone"
          aria-labelledby="work-management-danger">
          <h3 id="work-management-danger">{t('libraryManagement.dangerZone')}</h3>
          <p>{t('libraryManagement.dangerDescription')}</p>
          <div className="work-management-actions">
            <button className="dialog-button dialog-button-danger" type="button"
              disabled={isProjectBusy} aria-haspopup="dialog" onClick={onDeleteProject}>
              {project.type === 'saga'
                ? t('libraryManagement.deleteSaga')
                : t('libraryManagement.deleteNovel')}
            </button>
          </div>
          {project.type === 'saga' && books.length > 0 && (
            <div className="work-management-book-deletions">
              {books.map((book) => (
                <button key={book.id} className="dialog-button dialog-button-danger" type="button"
                  disabled={isProjectBusy} aria-haspopup="dialog" onClick={() => onDeleteBook(book)}>
                  {t('libraryManagement.deleteBook', { title: book.title })}
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="confirm-dialog-actions">
          <button className="dialog-button dialog-button-secondary" type="button" onClick={onCancel}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
