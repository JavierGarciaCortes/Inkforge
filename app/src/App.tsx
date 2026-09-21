import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { AppHeader } from './components/AppHeader'
import { DocumentWorkspace } from './components/DocumentWorkspace'
import { EditorPanel } from './components/EditorPanel'
import { Sidebar } from './components/Sidebar'
import type {
  InkforgeAppInfo,
  LoadState,
  VaultDocument,
  VaultTreeNode,
} from './types/inkforge'

async function readVaultTree(): Promise<VaultTreeNode[]> {
  if (!window.inkforge) {
    throw new Error('Inkforge Desktop no está disponible.')
  }

  return window.inkforge.vault.list()
}

function App() {
  const [appInfo, setAppInfo] = useState<InkforgeAppInfo | null>(null)
  const [vaultTree, setVaultTree] = useState<VaultTreeNode[]>([])
  const [vaultState, setVaultState] = useState<LoadState>('loading')
  const [vaultError, setVaultError] = useState<string | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [document, setDocument] = useState<VaultDocument | null>(null)
  const [documentState, setDocumentState] = useState<LoadState>('idle')
  const [documentError, setDocumentError] = useState<string | null>(null)
  const isMounted = useRef(false)
  const vaultRequestId = useRef(0)
  const readRequestId = useRef(0)

  const loadVault = useCallback(async () => {
    const requestId = vaultRequestId.current + 1
    vaultRequestId.current = requestId

    try {
      const tree = await readVaultTree()

      if (!isMounted.current || vaultRequestId.current !== requestId) {
        return
      }

      setVaultTree(tree)
      setVaultState('ready')
    } catch {
      if (!isMounted.current || vaultRequestId.current !== requestId) {
        return
      }

      setVaultTree([])
      setVaultState('error')
      setVaultError('No se pudo leer el vault del proyecto.')
    }
  }, [])

  useEffect(() => {
    let isEffectActive = true
    isMounted.current = true

    if (window.inkforge) {
      window.inkforge.getAppInfo().then((info) => {
        if (isEffectActive) {
          setAppInfo(info)
        }
      }).catch(() => undefined)
    }

        void readVaultTree()
      .then((tree) => {
        if (isEffectActive) {
          setVaultTree(tree)
          setVaultState('ready')
        }
      })
      .catch(() => {
        if (isEffectActive) {
          setVaultTree([])
          setVaultState('error')
          setVaultError('No se pudo leer el vault del proyecto.')
        }
      })

    return () => {
      isEffectActive = 
      isMounted.current = false
      vaultRequestId.current += 1
      readRequestId.current += 1
    }
  }, [])

  const selectDocument = async (relativePath: string) => {
    const requestId = readRequestId.current + 1
    readRequestId.current = requestId
    setSelectedPath(relativePath)
    setDocument(null)
    setDocumentState('loading')
    setDocumentError(null)

    if (!window.inkforge) {
      setDocumentState('error')
      setDocumentError('El documento solo puede abrirse en Inkforge Desktop.')
      return
    }

    try {
      const nextDocument = await window.inkforge.vault.read(relativePath)

      if (readRequestId.current === requestId) {
        setDocument(nextDocument)
        setDocumentState('ready')
      }
    } catch {
      if (readRequestId.current === requestId) {
        setDocumentState('error')
        setDocumentError('No se pudo abrir el documento seleccionado.')
      }
    }
  }

  const retryVault = () => {
    setVaultState('loading')
    setVaultError(null)
    void loadVault()
  }

  return (
    <div className="app-shell">
      <AppHeader appInfo={appInfo} />
      <div className="workspace-grid">
        <Sidebar
          tree={vaultTree}
          state={vaultState}
          error={vaultError}
          selectedPath={selectedPath}
          onSelectDocument={(relativePath) => void selectDocument(relativePath)}
          onReload={retryVault}
        />
        <DocumentWorkspace
          document={document}
          selectedPath={selectedPath}
          state={documentState}
          error={documentError}
        />
        <EditorPanel />
      </div>
    </div>
  )
}

export default App
