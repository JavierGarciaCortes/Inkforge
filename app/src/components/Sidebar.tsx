import { useState } from 'react'
import type {
  LoadState,
  VaultDirectoryNode,
  VaultTreeNode,
} from '../types/inkforge'

interface SidebarProps {
  tree: VaultTreeNode[]
  state: LoadState
  error: string | null
  selectedPath: string | null
  onSelectDocument: (relativePath: string) => void
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
  onSelectDocument,
  onReload,
}: SidebarProps) {
  const documentCount = countDocuments(tree)

  return (
    <aside className="sidebar" aria-label="Biblioteca">
      <div className="panel-heading">
        <span className="eyebrow">Biblioteca</span>
        <span className="panel-note">
          {state === 'ready' ? `${documentCount} documentos` : 'Vault del proyecto'}
        </span>
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
        <span className="sidebar-footer-label">Vault actual</span>
        <span>Lectura y edición Markdown</span>
      </div>
    </aside>
  )
}
