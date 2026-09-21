interface AppHeaderProps {
  appInfo: InkforgeAppInfo | null
}

export function AppHeader({ appInfo }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="brand-block">
        <span className="brand-mark" aria-hidden="true">I</span>
        <div>
          <strong>Inkforge</strong>
          <span>Espacio de escritura</span>
        </div>
      </div>

      <div className="header-actions">
        {appInfo && (
          <span className="desktop-status">
            <span className="status-dot" aria-hidden="true" />
            {appInfo.name} Desktop v{appInfo.version}
          </span>
        )}
        <span className="project-state">Sin proyecto</span>
        <button className="icon-button" type="button" title="Ajustes (no disponible)" disabled>
          <span aria-hidden="true">&#9881;</span>
          <span className="sr-only">Ajustes</span>
        </button>
      </div>
    </header>
  )
}
