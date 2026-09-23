import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { AppHeader } from './components/AppHeader'
import { ConfirmDialog } from './components/ConfirmDialog'
import { DocumentWorkspace } from './components/DocumentWorkspace'
import { EditorPanel } from './components/EditorPanel'
import { Sidebar } from './components/Sidebar'
import type {
  InkforgeAppInfo,
  LoadState,
  SaveState,
  VaultDocument,
  VaultTreeNode,
} from './types/inkforge'

async function readVaultTree(): Promise<VaultTreeNode[]> {
  if (!window.inkforge) {
    throw new Error('Inkforge Desktop no está disponible.')
  }

  return window.inkforge.vault.list()
}

type PendingAction =
  | { type: 'open-document'; relativePath: string }
  | { type: 'read-mode' }
  | { type: 'close-window' }

function App() {
  const [appInfo, setAppInfo] = useState<InkforgeAppInfo | null>(null)
  const [vaultTree, setVaultTree] = useState<VaultTreeNode[]>([])
  const [vaultState, setVaultState] = useState<LoadState>('loading')
  const [vaultError, setVaultError] = useState<string | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [document, setDocument] = useState<VaultDocument | null>(null)
  const [documentState, setDocumentState] = useState<LoadState>('idle')
  const [documentError, setDocumentError] = useState<string | null>(null)
  const [draftContent, setDraftContent] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [conflictDocument, setConflictDocument] = useState<VaultDocument | null>(null)
  const isMounted = useRef(false)
  const selectedPathRef = useRef<string | null>(null)
  const draftContentRef = useRef('')
  const vaultRequestId = useRef(0)
  const readRequestId = useRef(0)
  const saveRequestId = useRef(0)

  const isDirty = documentState === 'ready' && document !== null && draftContent !== document.content

  const loadVault = useCallback(async (
    { background = false }: { background?: boolean } = {},
  ) => {
    const requestId = vaultRequestId.current + 1
    vaultRequestId.current = requestId

    try {
      const tree = await readVaultTree()

      if (!isMounted.current || vaultRequestId.current !== requestId) {
        return
      }

      setVaultTree(tree)
      setVaultState('ready')
      setVaultError(null)
    } catch {
      if (!isMounted.current || vaultRequestId.current !== requestId) {
        return
      }

      if (background) {
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
    const unsubscribeVaultChanged = window.inkforge
      ? window.inkforge.vault.onChanged(() => {
          void loadVault({ background: true })
        })
      : () => undefined

    if (window.inkforge) {
      window.inkforge.getAppInfo().then((info) => {
        if (isEffectActive) {
          setAppInfo(info)
        }
      }).catch(() => undefined)
    }

    void Promise.resolve().then(() => {
      if (isEffectActive) {
        return loadVault()
      }
    })

    return () => {
      isEffectActive = false
      unsubscribeVaultChanged()
      isMounted.current = false
      selectedPathRef.current = null
      vaultRequestId.current += 1
      readRequestId.current += 1
      saveRequestId.current += 1
    }
  }, [loadVault])

  const openDocument = async (relativePath: string) => {
    if (relativePath === selectedPath) {
      return
    }

    const requestId = readRequestId.current + 1
    readRequestId.current = requestId
    saveRequestId.current += 1
    selectedPathRef.current = relativePath
    draftContentRef.current = ''
    setSelectedPath(relativePath)
    setDocument(null)
    setDraftContent('')
    setIsEditing(false)
    setDocumentState('loading')
    setDocumentError(null)
    setSaveState('idle')
    setSaveError(null)
    setConflictDocument(null)

    if (!window.inkforge) {
      setDocumentState('error')
      setDocumentError('El documento solo puede abrirse en Inkforge Desktop.')
      return
    }

    try {
      const nextDocument = await window.inkforge.vault.read(relativePath)

      if (readRequestId.current === requestId) {
        setDocument(nextDocument)
        setDraftContent(nextDocument.content)
        draftContentRef.current = nextDocument.content
        setConflictDocument(null)
        setDocumentState('ready')
      }
    } catch {
      if (readRequestId.current === requestId) {
        setDocumentState('error')
        setDocumentError('No se pudo abrir el documento seleccionado.')
      }
    }
  }

  const selectDocument = (relativePath: string) => {
    if (relativePath === selectedPath || saveState === 'saving') {
      return
    }

    if (isDirty) {
      setPendingAction({ type: 'open-document', relativePath })
      return
    }

    void openDocument(relativePath)
  }

  const requestReadMode = () => {
    if (!isEditing || saveState === 'saving') {
      return
    }

    if (isDirty) {
      setPendingAction({ type: 'read-mode' })
      return
    }

    setIsEditing(false)
  }

  const cancelPendingAction = useCallback(() => {
    setPendingAction(null)
  }, [])

  const discardPendingChanges = async () => {
    const action = pendingAction
    setPendingAction(null)

    if (!action) {
      return
    }

    if (action.type === 'open-document') {
      void openDocument(action.relativePath)
      return
    }

    if (action.type === 'close-window') {
      const appWindow = window.inkforge?.appWindow

      if (appWindow) {
        void appWindow.confirmClose().catch(() => undefined)
      }

      return
    }

    if (!document) {
      return
    }

    if (saveState === 'conflict' && conflictDocument) {
      if (!window.inkforge) {
        setSaveError('No se pudo volver a leer el documento desde el disco.')
        return
      }

      const relativePath = document.path
      const requestId = readRequestId.current + 1
      const draftAtRequest = draftContentRef.current
      readRequestId.current = requestId

      try {
        const nextDocument = await window.inkforge.vault.read(relativePath)

        if (
          !isMounted.current ||
          readRequestId.current !== requestId ||
          selectedPathRef.current !== relativePath ||
          draftContentRef.current !== draftAtRequest
        ) {
          return
        }

        setDocument(nextDocument)
        draftContentRef.current = nextDocument.content
        setDraftContent(nextDocument.content)
        setSaveState('idle')
        setSaveError(null)
        setConflictDocument(null)
        setIsEditing(false)
      } catch {
        if (
          !isMounted.current ||
          readRequestId.current !== requestId ||
          selectedPathRef.current !== relativePath
        ) {
          return
        }

        setSaveError(
          'No se pudo volver a leer el documento. Tu borrador y el conflicto siguen intactos.',
        )
      }

      return
    }

    draftContentRef.current = document.content
    setDraftContent(document.content)
    setSaveState('idle')
    setSaveError(null)
    setConflictDocument(null)
    setIsEditing(false)
  }

  const changeDocumentContent = useCallback((content: string) => {
    draftContentRef.current = content
    setDraftContent(content)
    setSaveState((currentState) => currentState === 'error' ? 'idle' : currentState)
    setSaveError(null)
  }, [])

  const saveDocument = useCallback(async () => {
    const currentDocument = document
    const contentToSave = draftContentRef.current

    if (
      !currentDocument ||
      contentToSave === currentDocument.content ||
      saveState === 'saving' ||
      saveState === 'conflict' ||
      saveState === 'missing'
    ) {
      return
    }

    if (!window.inkforge) {
      setSaveState('error')
      setSaveError('El documento solo puede guardarse desde Inkforge Desktop.')
      return
    }

    const requestId = saveRequestId.current + 1
    saveRequestId.current = requestId
    setSaveState('saving')
    setSaveError(null)

    try {
      const result = await window.inkforge.vault.write(
        currentDocument.path,
        contentToSave,
        currentDocument.revision,
      )

      if (
        !isMounted.current ||
        saveRequestId.current !== requestId ||
        selectedPathRef.current !== currentDocument.path
      ) {
        return
      }

      if (!result.ok) {
        if (result.reason === 'conflict') {
          setConflictDocument(result.currentDocument)
          setSaveState('conflict')
          setSaveError(null)
          return
        }

        setConflictDocument(null)
        setSaveState('missing')
        setSaveError(null)
        return
      }

      setDocument(result.document)
      setConflictDocument(null)
      setSaveState('idle')
    } catch {
      if (
        !isMounted.current ||
        saveRequestId.current !== requestId ||
        selectedPathRef.current !== currentDocument.path
      ) {
        return
      }

      setSaveState('error')
      setSaveError('No se pudo guardar el documento. Los cambios siguen sin guardar.')
    }
  }, [document, saveState])

  useEffect(() => {
    const handleSaveShortcut = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() === 's' &&
        (event.ctrlKey || event.metaKey) &&
        !event.altKey
      ) {
        event.preventDefault()

        if (
          isEditing &&
          isDirty &&
          saveState !== 'saving' &&
          saveState !== 'conflict' &&
          saveState !== 'missing'
        ) {
          void saveDocument()
        }
      }
    }

    window.addEventListener('keydown', handleSaveShortcut)
    return () => window.removeEventListener('keydown', handleSaveShortcut)
  }, [isDirty, isEditing, saveDocument, saveState])

  useEffect(() => {
    const appWindow = window.inkforge?.appWindow

    if (!appWindow) {
      return
    }

    return appWindow.onCloseRequested(() => {
      if (isDirty) {
        setPendingAction({ type: 'close-window' })
        return
      }

      void appWindow.confirmClose().catch(() => undefined)
    })
  }, [isDirty])

  const retryVault = () => {
    setVaultState('loading')
    setVaultError(null)
    void loadVault()
  }

  const isCloseWindowPending = pendingAction?.type === 'close-window'
  const discardMessage = isCloseWindowPending
    ? 'Tienes cambios sin guardar. Si cierras Inkforge, se perderán.'
    : pendingAction?.type === 'read-mode'
      ? 'Tienes cambios sin guardar. Si vuelves al modo lectura, se perderán.'
      : 'Tienes cambios sin guardar. Si cambias de documento, se perderán.'
  const discardConfirmLabel = isCloseWindowPending
    ? 'Salir sin guardar'
    : 'Descartar cambios'

  return (
    <div className="app-shell">
      <AppHeader appInfo={appInfo} />
      <div className="workspace-grid">
        <Sidebar
          tree={vaultTree}
          state={vaultState}
          error={vaultError}
          selectedPath={selectedPath}
          onSelectDocument={selectDocument}
          onReload={retryVault}
        />
        <DocumentWorkspace
          document={document}
          selectedPath={selectedPath}
          state={documentState}
          error={documentError}
          content={draftContent}
          isEditing={isEditing}
          isDirty={isDirty}
          saveState={saveState}
          saveError={saveError}
          conflictDocument={conflictDocument}
          onEdit={() => setIsEditing(true)}
          onReadMode={requestReadMode}
          onContentChange={changeDocumentContent}
          onSave={() => void saveDocument()}
        />
        <EditorPanel />
      </div>
      {pendingAction && (
        <ConfirmDialog
          title="Cambios sin guardar"
          message={discardMessage}
          confirmLabel={discardConfirmLabel}
          onCancel={cancelPendingAction}
          onConfirm={discardPendingChanges}
        />
      )}
    </div>
  )
}

export default App
