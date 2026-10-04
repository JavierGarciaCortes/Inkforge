import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getVaultPresentationLabel } from '../i18n/vault-presentation'
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
  onManageWork: () => void
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

function DirectoryNode({ node, selectedPath, onSelectDocument }: DirectoryNodeProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(true)
  const label = getVaultPresentationLabel(node, t)

  if (node.presentation === 'book-section') {
    return (
      <li className="tree-directory book-section">
        <div className="book-section-label">
          <span className="tree-label">{label}</span>
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
        <span className="tree-label">{label}</span>
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
  const { t } = useTranslation()

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
              <span className="tree-label">{getVaultPresentationLabel(node, t)}</span>
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
  onManageWork,
  onReload,
}: SidebarProps) {
  const { t } = useTranslation()
  const activeProjectIsDiscovered = activeProject === null || projects.some(
    (project) => project.id === activeProject.id,
  )
  const activeBookIsDiscovered = activeBook === null || books.some(
    (book) => book.id === activeBook.id,
  )
  const currentWorkTitle = activeProject?.title ?? t('library.noActiveWork')

  return (
    <aside className="sidebar" aria-label={t('sidebar.ariaLabel')}>
      <div className="panel-heading sidebar-heading">
        <div className="sidebar-current-work">
          <h2 title={currentWorkTitle}>{currentWorkTitle}</h2>
          {activeProject && (
            <span>{activeProject.type === 'saga' ? t('sidebar.saga') : t('sidebar.novel')}</span>
          )}
        </div>
      </div>

      <div className="project-switcher">
        <button type="button" disabled={isProjectBusy} onClick={onNewProject}>
          {t('sidebar.newWork')}
        </button>
        <button type="button" disabled={!activeProject || isProjectBusy} onClick={onManageWork} aria-haspopup="dialog">
          {t('sidebar.manageWork')}
        </button>
        <label>
          <span>{t('sidebar.activeWork')}</span>
          <select
            value={activeProject?.id ?? ''}
            disabled={isProjectBusy}
            onChange={(event) => {
              if (event.target.value) onProjectChange(event.target.value)
            }}
          >
            <option value="" disabled>{t('library.selectWork')}</option>
            {!activeProjectIsDiscovered && activeProject && (
              <option value={activeProject.id}>
                {t('common.unavailable', { title: activeProject.title })}
              </option>
            )}
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </label>
        {activeProject?.type === 'saga' && (
          <>
            <label>
              <span>{t('sidebar.activeBook')}</span>
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
                  <option value="">{t('sidebar.noActiveBook')}</option>
                )}
                {!activeBookIsDiscovered && activeBook !== null && (
                  <option value={activeBook.id}>
                    {t('common.unavailable', { title: activeBook.title })}
                  </option>
                )}
                {books.map((book) => (
                  <option key={book.id} value={book.id}>
                    {String(book.number).padStart(2, '0')} · {book.title}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {projectError && (
          <p className="project-switcher-error" role="alert">{projectError}</p>
        )}
      </div>

      <nav className="vault-tree-scroll" aria-label={t('sidebar.documentsAria')} aria-busy={state === 'loading'}>
        {state === 'loading' && (
          <div className="sidebar-state">
            <span className="loading-mark" aria-hidden="true" />
            <span>{t('sidebar.loading')}</span>
          </div>
        )}

        {state === 'error' && (
          <div className="sidebar-state sidebar-error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={onReload}>{t('common.retry')}</button>
          </div>
        )}

        {state === 'ready' && tree.length === 0 && (
          <div className="sidebar-state">
            {activeProject ? t('sidebar.empty') : projects.length === 0
              ? t('library.empty') : t('library.selectWork')}
          </div>
        )}

        {state === 'ready' && tree.length > 0 && (
          <TreeNodes
            nodes={tree}
            selectedPath={selectedPath}
            onSelectDocument={onSelectDocument}
          />
        )}
      </nav>

    </aside>
  )
}
