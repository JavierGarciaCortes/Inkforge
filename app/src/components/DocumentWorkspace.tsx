import type { LoadState, VaultDocument } from '../types/inkforge'

interface DocumentWorkspaceProps {
  document: VaultDocument | null
  selectedPath: string | null
  state: LoadState
  error: string | null
}

export function DocumentWorkspace({
  document,
  selectedPath,
  state,
  error,
}: DocumentWorkspaceProps) {
  const documentName = document?.name ?? selectedPath?.split('/').at(-1) ?? 'Sin selección'

  return (
    <main className="document-workspace">
      <div className="workspace-toolbar">
        <div>
          <span className="eyebrow">Documento</span>
          <span className="document-title" title={selectedPath ?? undefined}>{documentName}</span>
        </div>
        <span className="read-mode">Solo lectura</span>
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
          <article className="document-reader">
            <header className="document-reader-header">
              <h1>{document.name}</h1>
              <p title={document.path}>{document.path}</p>
            </header>
            <pre className="markdown-source" tabIndex={0}>{document.content}</pre>
          </article>
        )}
      </div>
    </main>
  )
}
