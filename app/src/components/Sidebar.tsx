const sections = ['Manuscrito', 'Personajes', 'Mundo', 'Referencias', 'Estilo']

export function Sidebar() {
  return (
    <aside className="sidebar" aria-label="Biblioteca">
      <div className="panel-heading">
        <span className="eyebrow">Biblioteca</span>
        <span className="panel-note">Estructura del proyecto</span>
      </div>

      <nav aria-label="Secciones del proyecto">
        <ul className="section-list">
          {sections.map((section, index) => (
            <li key={section}>
              <span
                className={index === 0 ? 'section-item section-item-active' : 'section-item'}
                aria-current={index === 0 ? 'page' : undefined}
                aria-disabled={index !== 0}
              >
                <span className="section-indicator" aria-hidden="true" />
                {section}
              </span>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <span className="sidebar-footer-label">Proyecto</span>
        <span>No hay una bóveda abierta</span>
      </div>
    </aside>
  )
}
