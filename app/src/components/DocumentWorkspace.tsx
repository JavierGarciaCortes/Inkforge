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
  const documentName = document?.name ?? selectedPath?.split('/').at(-1) ?? 'Sin selección'

  const saveStatus = saveState === 'saving'
    ? 'Guardando…'
    : saveState === 'conflict'
      ? 'Conflicto externo'
      : saveState === 'missing'
        ? 'Archivo no encontrado'
        : saveState === 'error'
        ? 'Error al guardar'
        : isDirty
          ? 'Sin guardar'
          : 'Guardado'
  const saveStatusClass = saveState === 'error' || saveState === 'conflict' || saveState === 'missing'
    ? 'save-state save-state-error'
    : isDirty
      ? 'save-state save-state-dirty'
      : 'save-state'

  return (
    <main className="document-workspace">
      <div className="workspace-toolbar">
        <div>
          <span className="eyebrow">Documento</span>
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
                  Modo lectura
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
                  Guardar
                </button>
              </>
            ) : (
              <>
                <span className="edit-mode">Modo lectura</span>
                <button
                  className="workspace-button"
                  type="button"
                  onClick={onEdit}
                >
                  Editar
                </button>
              </>
            )}
          </div>
        ) : (
          <span className="edit-mode">Edición Markdown</span>
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
            <h1>Selecciona un documento</h1>
            <p>Elige un archivo Markdown de la Biblioteca para abrirlo en modo lectura.</p>
          </div>
        )}

        {state === 'loading' && (
          <div className="document-state">
            <span className="loading-mark" aria-hidden="true" />
            <h1>Abriendo documento</h1>
            <p>{selectedPath}</p>
          </div>
        )}

        {state === 'error' && (
          <div className="document-state document-error" role="alert">
            <h1>No se pudo abrir el documento</h1>
            <p>{error}</p>
          </div>
        )}

        {state === 'ready' && document && (
          <section className={isEditing ? 'document-editor' : 'document-reader'}>
            <header className="document-content-header">
              <h1>{document.name}</h1>
              <p title={document.path}>{document.path}</p>
            </header>
            {isEditing ? (
              <>
                {saveError && <p className="save-error" role="alert">{saveError}</p>}
                {saveState === 'conflict' && conflictDocument && (
                  <p className="save-error" role="alert">
                    Este archivo cambió fuera de Inkforge desde que lo abriste. Tu borrador
                    sigue intacto y el archivo del disco no se ha sobrescrito.
                  </p>
                )}
                {saveState === 'missing' && (
                  <p className="save-error" role="alert">
                    El archivo ya no está disponible en la ruta original. Tu borrador sigue
                    intacto. Inkforge no ha creado ni sobrescrito ningún archivo.
                  </p>
                )}
                <textarea
                  className="markdown-editor"
                  value={content}
                  aria-label={`Editar ${document.name}`}
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
