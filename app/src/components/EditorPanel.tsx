export function EditorPanel() {
  return (
    <aside className="editor-panel" aria-label="Editor">
      <div className="panel-heading editor-heading">
        <span className="eyebrow">Editor</span>
        <span className="connection-state">Sin conectar</span>
      </div>

      <div className="editor-empty">
        <div className="editor-monogram" aria-hidden="true">O</div>
        <div>
          <h2>OpenCode</h2>
          <p>La integración editorial estará disponible en el siguiente hito.</p>
        </div>
      </div>

      <div className="editor-footer">
        <span>Contexto editorial</span>
        <span className="muted-value">Inactivo</span>
      </div>
    </aside>
  )
}
