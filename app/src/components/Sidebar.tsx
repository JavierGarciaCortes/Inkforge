import { useState } from 'react'
import type {
  ActiveBook,
  ActiveProject,
  LibraryBookSummary,
  LibraryProjectSummary,
  LoadState,
  VaultDirectoryNode,
  VaultTreeNode,
} from '../types/inkforge'

interface SidebarProps {
  tree: VaultTreeNode[]
  state: LoadState
  error: string | null
  selectedPath: string | null
  projects: LibraryProjectSummary[]
  activeProject: ActiveProject
  books: LibraryBookSummary[]
  activeBook: ActiveBook
  isProjectBusy: boolean
  projectError: string | null
  onSelectDocument: (relativePath: string) => void
  onProjectChange: (projectId: string | null) => void
  onBookChange: (bookId: string) => void
  onNewProject: () => void
  onAddBook: () => void
  onRenameProject: () => void
  onRenameBook: () => void
  onReload: () => void
}

interface TreeNodesProps {
  nodes: VaultTreeNode[]
  selectedPath: string | null
  onSelectDocument: (relativePath: string) => void
}

interface DirectoryNodeProps {
  node: VaultDirectoryNode
  selectedPath: string | null
  onSelectDocument: (relativePath: string) => void
}

function countDocuments(nodes: VaultTreeNode[]): number {
  return nodes.reduce((total, node) => {
    return total + (node.type === 'document' ? 1 : countDocuments(node.children))
  }, 0)
}

function DirectoryNode({ node, selectedPath, onSelectDocument }: DirectoryNodeProps) {
  const [isOpen, setIsOpen] = useState(true)

  if (node.presentation === 'book-section') {
    return (
      <li className="tree-directory book-section">
        <div className="book-section-label">
          <span className="tree-label">{node.name}</span>
        </div>
        <TreeNodes
          nodes={node.children}
          selectedPath={selectedPath}
          onSelectDocument={onSelectDocument}
        />
      </li>
    )
  }

  return (
    <li className="tree-directory">
      <button
        className="tree-row folder-row"
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className={isOpen ? 'folder-chevron folder-chevron-open' : 'folder-chevron'} aria-hidden="true" />
        <span className="folder-mark" aria-hidden="true" />
        <span className="tree-label">{node.name}</span>
      </button>
      {isOpen && (
        <TreeNodes
          nodes={node.children}
          selectedPath={selectedPath}
          onSelectDocument={onSelectDocument}
        />
      )}
    </li>
  )
}

function TreeNodes({ nodes, selectedPath, onSelectDocument }: TreeNodesProps) {
  return (
    <ul className="vault-tree-list">
      {nodes.map((node) => (
        node.type === 'directory' ? (
          <DirectoryNode
            key={node.path}
            node={node}
            selectedPath={selectedPath}
            onSelectDocument={onSelectDocument}
          />
        ) : (
          <li key={node.path}>
            <button
              className={selectedPath === node.path ? 'tree-row document-row document-row-selected' : 'tree-row document-row'}
              type="button"
              title={node.path}
              aria-current={selectedPath === node.path ? 'page' : undefined}
              onClick={() => onSelectDocument(node.path)}
            >
              <span className="document-mark" aria-hidden="true" />
              <span className="tree-label">{node.name}</span>
            </button>
          </li>
        )
      ))}
    </ul>
  )
}

export function Sidebar({
  tree,
  state,
  error,
  selectedPath,
  projects,
  activeProject,
  books,
  activeBook,
  isProjectBusy,
  projectError,
  onSelectDocument,
  onProjectChange,
  onBookChange,
  onNewProject,
  onAddBook,
  onRenameProject,
  onRenameBook,
  onReload,
}: SidebarProps) {
  const documentCount = countDocuments(tree)
  const activeProjectIsDiscovered = activeProject.id === null || projects.some(
    (project) => project.id === activeProject.id,
  )
  const activeBookIsDiscovered = activeBook === null || books.some(
    (book) => book.id === activeBook.id,
  )

  return (
    <aside className="sidebar" aria-label="Biblioteca">
      <div className="panel-heading">
        <span className="eyebrow">Biblioteca</span>
        <span className="panel-note">
          {state === 'ready' ? `${documentCount} documentos` : 'Vault de la obra'}
        </span>
      </div>

      <div className="project-switcher">
        <button type="button" disabled={isProjectBusy} onClick={onNewProject}>
          Nueva obra
        </button>
        <label>
          <span>Obra activa</span>
          <select
            value={activeProject.id ?? ''}
            disabled={isProjectBusy}
            onChange={(event) => onProjectChange(event.target.value || null)}
          >
            <option value="">Vault actual</option>
            {!activeProjectIsDiscovered && activeProject.id !== null && (
              <option value={activeProject.id}>
                {activeProject.title} (no disponible)
              </option>
            )}
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </label>
        {activeProject.type !== 'legacy' && (
          <button type="button" disabled={isProjectBusy} onClick={onRenameProject}>
            {activeProject.type === 'saga' ? 'Renombrar saga' : 'Renombrar libro'}
          </button>
        )}
        {activeProject.type === 'saga' && (
          <>
            <button type="button" disabled={isProjectBusy} onClick={onAddBook}>
              Añadir libro
            </button>
            <label>
              <span>Libro activo</span>
              <select
                value={activeBook?.id ?? ''}
                disabled={isProjectBusy || (books.length === 0 && activeBook === null)}
                onChange={(event) => {
                  if (event.target.value) {
                    onBookChange(event.target.value)
                  }
                }}
              >
                {activeBook === null && (
                  <option value="">Sin libro activo</option>
                )}
                {!activeBookIsDiscovered && activeBook !== null && (
                  <option value={activeBook.id}>
                    {activeBook.title} (no disponible)
                  </option>
                )}
                {books.map((book) => (
                  <option key={book.id} value={book.id}>
                    {String(book.number).padStart(2, '0')} · {book.title}
                  </option>
                ))}
              </select>
            </label>
            {activeBook !== null && (
              <button
                type="button"
                disabled={isProjectBusy || !activeBookIsDiscovered}
                onClick={onRenameBook}
              >
                Renombrar libro
              </button>
            )}
          </>
        )}
        {projectError && (
          <p className="project-switcher-error" role="alert">{projectError}</p>
        )}
      </div>

      <nav className="vault-tree-scroll" aria-label="Documentos del vault" aria-busy={state === 'loading'}>
        {state === 'loading' && (
          <div className="sidebar-state">
            <span className="loading-mark" aria-hidden="true" />
            <span>Cargando vault...</span>
          </div>
        )}

        {state === 'error' && (
          <div className="sidebar-state sidebar-error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={onReload}>Reintentar</button>
          </div>
        )}

        {state === 'ready' && tree.length === 0 && (
          <div className="sidebar-state">No hay documentos Markdown.</div>
        )}

        {state === 'ready' && tree.length > 0 && (
          <TreeNodes
            nodes={tree}
            selectedPath={selectedPath}
            onSelectDocument={onSelectDocument}
          />
        )}
      </nav>

      <div className="sidebar-footer">
        <span className="sidebar-footer-label">{activeProject.title}</span>
        <span>
          {activeProject.type === 'legacy'
            ? 'Vault heredado'
            : activeProject.type === 'saga'
              ? 'Saga'
              : 'Novela'}
        </span>
      </div>
    </aside>
  )
}
