import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { AppHeader } from './components/AppHeader'
import { ConfirmDialog } from './components/ConfirmDialog'
import { DocumentWorkspace } from './components/DocumentWorkspace'
import { EditorPanel } from './components/EditorPanel'
import { NarrativeNameDialog } from './components/NarrativeNameDialog'
import { ProjectDialog } from './components/ProjectDialog'
import { Sidebar } from './components/Sidebar'
import type {
  ActiveBook,
  ActiveProject,
  CreateProjectInput,
  InkforgeAppInfo,
  LibraryActivationResult,
  LibraryBookSummary,
  LibraryProjectSummary,
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

const LEGACY_PROJECT: ActiveProject = {
  id: null,
  title: 'Vault actual',
  type: 'legacy',
}

function sortProjects(projects: LibraryProjectSummary[]): LibraryProjectSummary[] {
  return [...projects].sort((left, right) => (
    left.title.localeCompare(right.title, 'es', { sensitivity: 'base' })
  ))
}

function getLibraryError(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || error.message.trim().length === 0) {
    return fallback
  }

  const remoteErrorIndex = error.message.lastIndexOf('Error: ')
  return remoteErrorIndex === -1
    ? error.message
    : error.message.slice(remoteErrorIndex + 'Error: '.length)
}

type PendingAction =
  | { type: 'open-document'; relativePath: string }
  | { type: 'read-mode' }
  | { type: 'close-window' }
  | { type: 'switch-project'; projectId: string | null }
  | { type: 'switch-book'; bookId: string }
  | { type: 'new-project' }
  | { type: NarrativeDialogKind }

type NarrativeDialogKind = 'add-book' | 'rename-project' | 'rename-book'

function App() {
  const [appInfo, setAppInfo] = useState<InkforgeAppInfo | null>(null)
  const [projects, setProjects] = useState<LibraryProjectSummary[]>([])
  const [activeProject, setActiveProject] = useState<ActiveProject>(LEGACY_PROJECT)
  const [books, setBooks] = useState<LibraryBookSummary[]>([])
  const [activeBook, setActiveBook] = useState<ActiveBook>(null)
  const [isProjectBusy, setIsProjectBusy] = useState(false)
  const [projectError, setProjectError] = useState<string | null>(null)
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false)
  const [narrativeDialog, setNarrativeDialog] = useState<NarrativeDialogKind | null>(null)
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
  const projectsRequestId = useRef(0)
  const booksRequestId = useRef(0)
  const libraryRequestId = useRef(0)
  const libraryOperationActiveRef = useRef(false)
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
      setVaultError('No se pudo leer el vault de la obra.')
    }
  }, [])

  const loadLibraryProjects = useCallback(async (
    { reportError = false }: { reportError?: boolean } = {},
  ) => {
    const bridge = window.inkforge

    if (!bridge) {
      return
    }

    const requestId = projectsRequestId.current + 1
    projectsRequestId.current = requestId

    try {
      const nextProjects = await bridge.library.listProjects()

      if (!isMounted.current || projectsRequestId.current !== requestId) {
        return
      }

      setProjects(sortProjects(nextProjects))
    } catch (error) {
      if (
        reportError &&
        isMounted.current &&
        projectsRequestId.current === requestId
      ) {
        setProjectError(getLibraryError(error, 'No se pudo cargar la Biblioteca.'))
      }
    }
  }, [])

  const loadLibraryBooks = useCallback(async () => {
    const bridge = window.inkforge

    if (!bridge) {
      return
    }

    const requestId = booksRequestId.current + 1
    booksRequestId.current = requestId

    try {
      const nextBooks = await bridge.library.listBooks()

      if (!isMounted.current || booksRequestId.current !== requestId) {
        return
      }

      setBooks(nextBooks)
    } catch {
      if (isMounted.current && booksRequestId.current === requestId) {
        setBooks([])
      }
    }
  }, [])

  useEffect(() => {
    let isEffectActive = true
    isMounted.current = true
    const bridge = window.inkforge
    const unsubscribeVaultChanged = bridge
      ? bridge.vault.onChanged(() => {
          void loadVault({ background: true })
        })
      : () => undefined
    const unsubscribeLibraryChanged = bridge
      ? bridge.library.onChanged(() => {
          void loadLibraryProjects()
          void loadLibraryBooks()
        })
      : () => undefined

    if (bridge) {
      bridge.getAppInfo().then((info) => {
        if (isEffectActive) {
          setAppInfo(info)
        }
      }).catch(() => undefined)

      const requestId = libraryRequestId.current + 1
      libraryRequestId.current = requestId

      void Promise.all([
        bridge.library.getActiveProject(),
        bridge.library.getActiveBook(),
      ]).then(([nextActiveProject, nextActiveBook]) => {
        if (isEffectActive && libraryRequestId.current === requestId) {
          setActiveProject(nextActiveProject)
          setActiveBook(nextActiveBook)
        }
      }).catch((error: unknown) => {
        if (isEffectActive && libraryRequestId.current === requestId) {
          setProjectError(getLibraryError(error, 'No se pudo cargar la Biblioteca.'))
        }
      })
    }

    void Promise.resolve().then(() => {
      if (!isEffectActive) {
        return
      }

      void loadVault()
      void loadLibraryBooks()
      return loadLibraryProjects({ reportError: true })
    })

    return () => {
      isEffectActive = false
      unsubscribeVaultChanged()
      unsubscribeLibraryChanged()
      isMounted.current = false
      selectedPathRef.current = null
      vaultRequestId.current += 1
      projectsRequestId.current += 1
      booksRequestId.current += 1
      libraryRequestId.current += 1
      libraryOperationActiveRef.current = false
      readRequestId.current += 1
      saveRequestId.current += 1
    }
  }, [loadLibraryBooks, loadLibraryProjects, loadVault])

  const resetDocumentForProjectChange = useCallback(() => {
    selectedPathRef.current = null
    draftContentRef.current = ''
    readRequestId.current += 1
    saveRequestId.current += 1
    setSelectedPath(null)
    setDocument(null)
    setDraftContent('')
    setIsEditing(false)
    setDocumentState('idle')
    setDocumentError(null)
    setSaveState('idle')
    setSaveError(null)
    setConflictDocument(null)
  }, [])

  const finishProjectActivation = useCallback((nextScope: LibraryActivationResult) => {
    booksRequestId.current += 1
    resetDocumentForProjectChange()
    setActiveProject(nextScope.activeProject)
    setActiveBook(nextScope.activeBook)
    setBooks(nextScope.books)
    setVaultTree([])
    setVaultState('loading')
    setVaultError(null)
    void loadVault()
  }, [loadVault, resetDocumentForProjectChange])

  const finishBookActivation = useCallback((nextActiveBook: LibraryBookSummary) => {
    resetDocumentForProjectChange()
    setActiveBook(nextActiveBook)
    setVaultTree([])
    setVaultState('loading')
    setVaultError(null)
    void loadVault()
  }, [loadVault, resetDocumentForProjectChange])

  const activateLibraryProject = useCallback(async (projectId: string | null) => {
    const bridge = window.inkforge

    if (!bridge) {
      setProjectError('La Biblioteca solo está disponible en Inkforge Desktop.')
      return
    }

    const requestId = libraryRequestId.current + 1
    libraryRequestId.current = requestId
    libraryOperationActiveRef.current = true
    setIsProjectBusy(true)
    setProjectError(null)

    try {
      const nextScope = await bridge.library.activateProject(projectId)

      if (!isMounted.current || libraryRequestId.current !== requestId) {
        return
      }

      finishProjectActivation(nextScope)
    } catch (error) {
      if (isMounted.current && libraryRequestId.current === requestId) {
        setProjectError(getLibraryError(error, 'No se pudo cambiar de obra.'))
      }
    } finally {
      if (isMounted.current && libraryRequestId.current === requestId) {
        libraryOperationActiveRef.current = false
        setIsProjectBusy(false)
      }
    }
  }, [finishProjectActivation])

  const createLibraryProject = useCallback(async (input: CreateProjectInput) => {
    const bridge = window.inkforge

    if (!bridge) {
      setProjectError('La Biblioteca solo está disponible en Inkforge Desktop.')
      return
    }

    const requestId = libraryRequestId.current + 1
    libraryRequestId.current = requestId
    libraryOperationActiveRef.current = true
    setIsProjectBusy(true)
    setProjectError(null)

    try {
      const result = await bridge.library.createProject(input)

      if (!isMounted.current || libraryRequestId.current !== requestId) {
        return
      }

      setIsProjectDialogOpen(false)
      finishProjectActivation(result)
    } catch (error) {
      if (isMounted.current && libraryRequestId.current === requestId) {
        setProjectError(getLibraryError(error, 'No se pudo crear la obra.'))
      }
    } finally {
      if (isMounted.current && libraryRequestId.current === requestId) {
        libraryOperationActiveRef.current = false
        setIsProjectBusy(false)
      }
    }
  }, [finishProjectActivation])

  const activateLibraryBook = useCallback(async (bookId: string) => {
    const bridge = window.inkforge

    if (!bridge) {
      setProjectError('La Biblioteca solo está disponible en Inkforge Desktop.')
      return
    }

    const requestId = libraryRequestId.current + 1
    libraryRequestId.current = requestId
    libraryOperationActiveRef.current = true
    setIsProjectBusy(true)
    setProjectError(null)

    try {
      const nextActiveBook = await bridge.library.activateBook(bookId)

      if (!isMounted.current || libraryRequestId.current !== requestId) {
        return
      }

      finishBookActivation(nextActiveBook)
    } catch (error) {
      if (isMounted.current && libraryRequestId.current === requestId) {
        setProjectError(getLibraryError(error, 'No se pudo cambiar de libro.'))
      }
    } finally {
      if (isMounted.current && libraryRequestId.current === requestId) {
        libraryOperationActiveRef.current = false
        setIsProjectBusy(false)
      }
    }
  }, [finishBookActivation])

  const createLibraryBook = useCallback(async (bookTitle: string) => {
    const bridge = window.inkforge

    if (!bridge) {
      setProjectError('La Biblioteca solo está disponible en Inkforge Desktop.')
      return
    }

    const requestId = libraryRequestId.current + 1
    libraryRequestId.current = requestId
    libraryOperationActiveRef.current = true
    setIsProjectBusy(true)
    setProjectError(null)

    try {
      const nextActiveBook = await bridge.library.createBook({ bookTitle })

      if (!isMounted.current || libraryRequestId.current !== requestId) {
        return
      }

      setNarrativeDialog(null)
      finishBookActivation(nextActiveBook)
    } catch (error) {
      if (isMounted.current && libraryRequestId.current === requestId) {
        setProjectError(getLibraryError(error, 'No se pudo añadir el libro.'))
      }
    } finally {
      if (isMounted.current && libraryRequestId.current === requestId) {
        libraryOperationActiveRef.current = false
        setIsProjectBusy(false)
      }
    }
  }, [finishBookActivation])

  const renameLibraryProject = useCallback(async (nextTitle: string) => {
    const bridge = window.inkforge

    if (!bridge) {
      setProjectError('La Biblioteca solo está disponible en Inkforge Desktop.')
      return
    }

    const requestId = libraryRequestId.current + 1
    libraryRequestId.current = requestId
    libraryOperationActiveRef.current = true
    setIsProjectBusy(true)
    setProjectError(null)

    try {
      const nextActiveProject = await bridge.library.renameProject(nextTitle)

      if (!isMounted.current || libraryRequestId.current !== requestId) {
        return
      }

      resetDocumentForProjectChange()
      setNarrativeDialog(null)
      setActiveProject(nextActiveProject)
      setVaultTree([])
      setVaultState('loading')
      setVaultError(null)
      void loadVault()
    } catch (error) {
      if (isMounted.current && libraryRequestId.current === requestId) {
        setProjectError(getLibraryError(error, 'No se pudo renombrar la obra.'))
      }
    } finally {
      if (isMounted.current && libraryRequestId.current === requestId) {
        libraryOperationActiveRef.current = false
        setIsProjectBusy(false)
      }
    }
  }, [loadVault, resetDocumentForProjectChange])

  const renameLibraryBook = useCallback(async (nextTitle: string) => {
    const bridge = window.inkforge

    if (!bridge) {
      setProjectError('La Biblioteca solo está disponible en Inkforge Desktop.')
      return
    }

    const requestId = libraryRequestId.current + 1
    libraryRequestId.current = requestId
    libraryOperationActiveRef.current = true
    setIsProjectBusy(true)
    setProjectError(null)

    try {
      const nextActiveBook = await bridge.library.renameActiveBook(nextTitle)

      if (!isMounted.current || libraryRequestId.current !== requestId) {
        return
      }

      setNarrativeDialog(null)
      finishBookActivation(nextActiveBook)
    } catch (error) {
      if (isMounted.current && libraryRequestId.current === requestId) {
        setProjectError(getLibraryError(error, 'No se pudo renombrar el libro.'))
      }
    } finally {
      if (isMounted.current && libraryRequestId.current === requestId) {
        libraryOperationActiveRef.current = false
        setIsProjectBusy(false)
      }
    }
  }, [finishBookActivation])

  const cancelProjectDialog = useCallback(() => {
    setIsProjectDialogOpen(false)
    setProjectError(null)
  }, [])

  const cancelNarrativeDialog = useCallback(() => {
    setNarrativeDialog(null)
    setProjectError(null)
  }, [])

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

  const requestProjectChange = (projectId: string | null) => {
    if (
      projectId === activeProject.id ||
      isProjectBusy ||
      libraryOperationActiveRef.current ||
      saveState === 'saving'
    ) {
      return
    }

    if (isDirty) {
      setPendingAction({ type: 'switch-project', projectId })
      return
    }

    void activateLibraryProject(projectId)
  }

  const requestNewProject = () => {
    if (
      isProjectBusy ||
      libraryOperationActiveRef.current ||
      saveState === 'saving'
    ) {
      return
    }

    if (isDirty) {
      setPendingAction({ type: 'new-project' })
      return
    }

    setProjectError(null)
    setIsProjectDialogOpen(true)
  }

  const requestBookChange = (bookId: string) => {
    if (
      bookId === activeBook?.id ||
      isProjectBusy ||
      libraryOperationActiveRef.current ||
      saveState === 'saving'
    ) {
      return
    }

    if (isDirty) {
      setPendingAction({ type: 'switch-book', bookId })
      return
    }

    void activateLibraryBook(bookId)
  }

  const requestNarrativeDialog = (
    type: 'add-book' | 'rename-project' | 'rename-book',
  ) => {
    if (
      isProjectBusy ||
      libraryOperationActiveRef.current ||
      saveState === 'saving'
    ) {
      return
    }

    if (isDirty) {
      setPendingAction({ type })
      return
    }

    setProjectError(null)
    setNarrativeDialog(type)
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

    if (action.type === 'switch-project') {
      void activateLibraryProject(action.projectId)
      return
    }

    if (action.type === 'switch-book') {
      void activateLibraryBook(action.bookId)
      return
    }

    if (
      action.type === 'add-book' ||
      action.type === 'rename-project' ||
      action.type === 'rename-book'
    ) {
      resetDocumentForProjectChange()
      setProjectError(null)
      setNarrativeDialog(action.type)
      return
    }

    if (action.type === 'new-project') {
      resetDocumentForProjectChange()
      setProjectError(null)
      setIsProjectDialogOpen(true)
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
      libraryOperationActiveRef.current ||
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

  const submitNarrativeDialog = (nextTitle: string) => {
    if (narrativeDialog === 'add-book') {
      void createLibraryBook(nextTitle)
      return
    }

    if (narrativeDialog === 'rename-project') {
      void renameLibraryProject(nextTitle)
      return
    }

    if (narrativeDialog === 'rename-book') {
      void renameLibraryBook(nextTitle)
    }
  }

  const narrativeDialogTitle = narrativeDialog === 'add-book'
    ? 'Añadir libro'
    : narrativeDialog === 'rename-project'
      ? activeProject.type === 'saga'
        ? 'Renombrar saga'
        : 'Renombrar libro'
      : 'Renombrar libro'
  const narrativeDialogLabel = narrativeDialog === 'rename-project' &&
    activeProject.type === 'saga'
    ? 'Título de la saga'
    : 'Título del libro'
  const narrativeDialogInitialValue = narrativeDialog === 'rename-project'
    ? activeProject.title
    : narrativeDialog === 'rename-book'
      ? activeBook?.title ?? ''
      : ''
  const narrativeDialogSubmitLabel = narrativeDialog === 'add-book'
    ? 'Añadir libro'
    : 'Renombrar'
  const isCloseWindowPending = pendingAction?.type === 'close-window'
  const isProjectChangePending = pendingAction?.type === 'switch-project'
    || pendingAction?.type === 'new-project'
  const isBookChangePending = pendingAction?.type === 'switch-book'
    || pendingAction?.type === 'add-book'
  const isRenamePending = pendingAction?.type === 'rename-project'
    || pendingAction?.type === 'rename-book'
  const discardMessage = isCloseWindowPending
    ? 'Tienes cambios sin guardar. Si cierras Inkforge, se perderán.'
    : isProjectChangePending
      ? 'Tienes cambios sin guardar. Si cambias de obra, se perderán.'
      : isBookChangePending
        ? 'Tienes cambios sin guardar. Si cambias de libro, se perderán.'
        : isRenamePending
          ? 'Tienes cambios sin guardar. Si continúas, se perderán.'
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
          projects={projects}
          activeProject={activeProject}
          books={books}
          activeBook={activeBook}
          isProjectBusy={isProjectBusy}
          projectError={projectError}
          onSelectDocument={selectDocument}
          onProjectChange={requestProjectChange}
          onBookChange={requestBookChange}
          onNewProject={requestNewProject}
          onAddBook={() => requestNarrativeDialog('add-book')}
          onRenameProject={() => requestNarrativeDialog('rename-project')}
          onRenameBook={() => requestNarrativeDialog('rename-book')}
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
      {isProjectDialogOpen && (
        <ProjectDialog
          isCreating={isProjectBusy}
          error={projectError}
          onCancel={cancelProjectDialog}
          onCreate={(input) => void createLibraryProject(input)}
        />
      )}
      {narrativeDialog && (
        <NarrativeNameDialog
          key={narrativeDialog}
          title={narrativeDialogTitle}
          label={narrativeDialogLabel}
          initialValue={narrativeDialogInitialValue}
          submitLabel={narrativeDialogSubmitLabel}
          isSubmitting={isProjectBusy}
          error={projectError}
          onCancel={cancelNarrativeDialog}
          onSubmit={submitNarrativeDialog}
        />
      )}
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
