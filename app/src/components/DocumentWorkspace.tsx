import { useTranslation } from 'react-i18next'
import { getVaultPresentationLabel } from '../i18n/vault-presentation'
import type { LoadState, SaveState, VaultDocument } from '../types/inkforge'

interface DocumentWorkspaceProps {
  document: VaultDocument | null
  selectedPath: string | null
  state: LoadState
  error: string | null
  content: string
  isEditing: boolean
  isDirty: boolean
  saveState: SaveState
  saveError: string | null
  conflictDocument: VaultDocument | null
  onEdit: () => void
  onReadMode: () => void
  onContentChange: (content: string) => void
  onSave: () => void
}

export function DocumentWorkspace({
  document,
  selectedPath,
  state,
  error,
  content,
  isEditing,
  isDirty,
  saveState,
  saveError,
  conflictDocument,
  onEdit,
  onReadMode,
  onContentChange,
  onSave,
}: DocumentWorkspaceProps) {
  const { t } = useTranslation()
  const documentName = document
    ? getVaultPresentationLabel(document, t)
    : selectedPath?.split('/').at(-1) ?? t('document.noSelection')

  const saveStatus = saveState === 'saving'
    ? t('document.status.saving')
    : saveState === 'conflict'
      ? t('document.status.conflict')
      : saveState === 'missing'
        ? t('document.status.missing')
        : saveState === 'error'
        ? t('document.status.error')
        : isDirty
          ? t('document.status.dirty')
          : t('document.status.saved')
  const saveStatusClass = saveState === 'error' || saveState === 'conflict' || saveState === 'missing'
    ? 'save-state save-state-error'
    : isDirty
      ? 'save-state save-state-dirty'
      : 'save-state'

  return (
    <main className="document-workspace">
      <div className="workspace-toolbar">
        <div>
          <span className="eyebrow">{t('document.eyebrow')}</span>
          <span className="document-title" title={selectedPath ?? undefined}>{documentName}</span>
        </div>
        {state === 'ready' && document ? (
          <div className="document-actions">
            {isEditing ? (
              <>
                <span className={saveStatusClass} role="status" aria-live="polite">
                  {saveStatus}
                </span>
                <button
                  className="workspace-button workspace-button-secondary"
                  type="button"
                  disabled={saveState === 'saving'}
                  onClick={onReadMode}
                >
                  {t('document.readMode')}
                </button>
                <button
                  className="save-button"
                  type="button"
                  disabled={
                    !isDirty ||
                    saveState === 'saving' ||
                    saveState === 'conflict' ||
                    saveState === 'missing'
                  }
                  onClick={onSave}
                >
                  {t('document.save')}
                </button>
              </>
            ) : (
              <>
                <span className="edit-mode">{t('document.readMode')}</span>
                <button
                  className="workspace-button"
                  type="button"
                  onClick={onEdit}
                >
                  {t('document.edit')}
                </button>
              </>
            )}
          </div>
        ) : (
          <span className="edit-mode">{t('document.markdownEditing')}</span>
        )}
      </div>

      <div className="document-surface" aria-busy={state === 'loading'}>
        {state === 'idle' && (
          <div className="empty-document">
            <div className="document-glyph" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <h1>{t('document.selectTitle')}</h1>
            <p>{t('document.selectDescription')}</p>
          </div>
        )}

        {state === 'loading' && (
          <div className="document-state">
            <span className="loading-mark" aria-hidden="true" />
            <h1>{t('document.opening')}</h1>
            <p>{selectedPath}</p>
          </div>
        )}

        {state === 'error' && (
          <div className="document-state document-error" role="alert">
            <h1>{t('document.openError')}</h1>
            <p>{error}</p>
          </div>
        )}

        {state === 'ready' && document && (
          <section className={isEditing ? 'document-editor' : 'document-reader'}>
            <header className="document-content-header">
              <h1>{documentName}</h1>
              <p title={document.path}>{document.path}</p>
            </header>
            {isEditing ? (
              <>
                {saveError && <p className="save-error" role="alert">{saveError}</p>}
                {saveState === 'conflict' && conflictDocument && (
                  <p className="save-error" role="alert">
                    {t('document.conflictNotice')}
                  </p>
                )}
                {saveState === 'missing' && (
                  <p className="save-error" role="alert">
                    {t('document.missingNotice')}
                  </p>
                )}
                <textarea
                  className="markdown-editor"
                  value={content}
                  aria-label={t('document.editorAria', { name: documentName })}
                  onChange={(event) => onContentChange(event.target.value)}
                  spellCheck
                />
              </>
            ) : (
              <pre className="markdown-source" tabIndex={0}>{document.content}</pre>
            )}
          </section>
        )}
      </div>
    </main>
  )
}
