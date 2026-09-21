export function DocumentWorkspace() {
  return (
    <main className="document-workspace">
      <div className="workspace-toolbar">
        <div>
          <span className="eyebrow">Documento</span>
          <span className="document-title">Sin selección</span>
        </div>
        <span className="read-mode">Lectura</span>
      </div>

      <div className="empty-document">
        <div className="document-glyph" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <h1>Selecciona un documento</h1>
        <p>El contenido del manuscrito aparecerá aquí cuando abras un proyecto.</p>
      </div>
    </main>
  )
}
