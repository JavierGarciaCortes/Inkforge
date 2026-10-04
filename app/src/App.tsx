import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import './App.css'
import { AppHeader } from './components/AppHeader'
import { ConfirmDialog } from './components/ConfirmDialog'
import { BookDialog } from './components/BookDialog'
import { GenreConfigurationDialog } from './components/GenreConfigurationDialog'
import { DocumentWorkspace } from './components/DocumentWorkspace'
import { EditorPanel } from './components/EditorPanel'
import { HelpDialog } from './components/HelpDialog'
import { NarrativeNameDialog } from './components/NarrativeNameDialog'
import { ProjectDialog } from './components/ProjectDialog'
import { Sidebar } from './components/Sidebar'
import { WorkManagementDialog } from './components/WorkManagementDialog'
import { i18n } from './i18n'
import { loadOpenCodeModelSelection } from './storage/model-selection-storage'
import { loadDirectorWidth, MAX_DIRECTOR_WIDTH, saveDirectorWidth } from './storage/director-width-storage'
import type {
  ActiveBook,
  ActiveProject,
  CreateProjectInput,
  CreateBookInput,
  LibraryActivationResult,
  LibraryBookSummary,
  LibraryProjectSummary,
  LoadState,
  OpenCodeConnectionState,
  SaveState,
  VaultDocument,
  VaultTreeNode,
} from './types/inkforge'

async function readVaultTree(): Promise<VaultTreeNode[]> {
  if (!window.inkforge) {
    throw new Error(i18n.t('errors.vaultRead'))
  }

  return window.inkforge.vault.list()
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
  | { type: 'add-book' }
  | { type: NarrativeDialogKind }

type NarrativeDialogKind = 'rename-project' | 'rename-book'
type WorkManagementAction = NarrativeDialogKind | 'add-book' | 'genres'
type WorkManagementNavigation = { projectId: string; action: WorkManagementAction | null }

function getDirectorBounds(workspaceWidth: number, compact: boolean) {
  const minimum = compact ? 260 : 280
  const sidebarWidth = compact ? 228 : 276
  const documentMinimum = compact ? 300 : 360
  const available = workspaceWidth - sidebarWidth - documentMinimum - 8
  return { minimum, maximum: Math.max(minimum, Math.min(MAX_DIRECTOR_WIDTH, available)) }
}

function clampDirectorWidth(width: number, bounds: ReturnType<typeof getDirectorBounds>) {
  return Math.min(bounds.maximum, Math.max(bounds.minimum, Math.round(width)))
}

function App() {
  const { t } = useTranslation()
  const [projects, setProjects] = useState<LibraryProjectSummary[]>([])
  const [activeProject, setActiveProject] = useState<ActiveProject>(null)
  const [books, setBooks] = useState<LibraryBookSummary[]>([])
  const [activeBook, setActiveBook] = useState<ActiveBook>(null)
  const [isProjectBusy, setIsProjectBusy] = useState(false)
  const [projectError, setProjectError] = useState<string | null>(null)
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false)
  const [workManagementNavigation, setWorkManagementNavigation] = useState<WorkManagementNavigation | null>(null)
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(() => loadOpenCodeModelSelection() === null)
  const unavailableModelPrompts = useRef(new Set<string>())
  const promptForUnavailableModel = useCallback((key: string) => {
    if (!unavailableModelPrompts.current.has(key)) {
      unavailableModelPrompts.current.add(key)
      setIsSettingsOpen(true)
    }
  }, [])
  const [connectionState, setConnectionState] = useState<OpenCodeConnectionState>('starting')
  const [directorWidth, setDirectorWidth] = useState(loadDirectorWidth)
  const [isDirectorResizing, setIsDirectorResizing] = useState(false)
  const [directorLayout, setDirectorLayout] = useState(() => ({
    workspaceWidth: window.innerWidth,
    compact: window.matchMedia('(max-width: 1080px)').matches,
  }))
  const workspaceGridRef = useRef<HTMLDivElement>(null)
  const directorWidthRef = useRef(directorWidth)
  const stopDirectorResizeRef = useRef<(() => void) | null>(null)
  const [narrativeDialog, setNarrativeDialog] = useState<NarrativeDialogKind | null>(null)
  const [isBookDialogOpen, setIsBookDialogOpen] = useState(false)
  const [isGenreDialogOpen, setIsGenreDialogOpen] = useState(false)
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
  const [isDocumentDetached, setIsDocumentDetached] = useState(false)
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

  const activeProjectId = activeProject?.id ?? null
  const isDirty = documentState === 'ready' && document !== null && draftContent !== document.content

  const directorBounds = getDirectorBounds(directorLayout.workspaceWidth, directorLayout.compact)
  const effectiveDirectorWidth = clampDirectorWidth(directorWidth, directorBounds)

  const currentDirectorBounds = useCallback(() => getDirectorBounds(
    workspaceGridRef.current?.clientWidth ?? window.innerWidth,
    window.matchMedia('(max-width: 1080px)').matches,
  ), [])

  useEffect(() => {
    const grid = workspaceGridRef.current
    if (!grid) return
    const updateLayout = () => {
      const workspaceWidth = grid.clientWidth
      const compact = window.matchMedia('(max-width: 1080px)').matches
      setDirectorLayout((previous) => previous.workspaceWidth === workspaceWidth && previous.compact === compact
        ? previous
        : { workspaceWidth, compact })
    }
    const observer = new ResizeObserver(updateLayout)
    observer.observe(grid)
    window.addEventListener('resize', updateLayout)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateLayout)
    }
  }, [])

  const stopDirectorResize = useCallback((persist = false) => {
    const cleanup = stopDirectorResizeRef.current
    if (!cleanup) return
    stopDirectorResizeRef.current = null
    cleanup()
    setIsDirectorResizing(false)
    if (persist) saveDirectorWidth(directorWidthRef.current)
  }, [])

  useEffect(() => () => stopDirectorResize(), [activeProject?.id, stopDirectorResize])

  const startDirectorResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary || window.matchMedia('(max-width: 820px)').matches) return
    event.preventDefault()
    stopDirectorResize()
    const pointerId = event.pointerId
    const move = (next: PointerEvent) => {
      if (next.pointerId !== pointerId) return
      const grid = workspaceGridRef.current
      if (!grid) return
      const width = clampDirectorWidth(grid.getBoundingClientRect().right - next.clientX - 4, currentDirectorBounds())
      directorWidthRef.current = width
      setDirectorWidth(width)
    }
    const end = (next: PointerEvent) => {
      if (next.pointerId === pointerId) stopDirectorResize(true)
    }
    const cancel = (next: PointerEvent) => {
      if (next.pointerId === pointerId) stopDirectorResize()
    }
    const stop = () => stopDirectorResize()
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('blur', stop)
    window.addEventListener('resize', stop)
    stopDirectorResizeRef.current = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('blur', stop)
      window.removeEventListener('resize', stop)
    }
    setIsDirectorResizing(true)
  }, [currentDirectorBounds, stopDirectorResize])

  const resizeDirectorWithKeyboard = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (window.matchMedia('(max-width: 820px)').matches) return
    const bounds = currentDirectorBounds()
    const currentWidth = clampDirectorWidth(directorWidthRef.current, bounds)
    const step = event.shiftKey ? 64 : 16
    const next = event.key === 'ArrowLeft' ? currentWidth + step
      : event.key === 'ArrowRight' ? currentWidth - step
        : event.key === 'Home' ? bounds.maximum
          : event.key === 'End' ? bounds.minimum : null
    if (next === null) return
    event.preventDefault()
    const width = clampDirectorWidth(next, bounds)
    directorWidthRef.current = width
    setDirectorWidth(width)
    saveDirectorWidth(width)
  }, [currentDirectorBounds])

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
      setVaultError(i18n.t('errors.vaultRead'))
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
        setProjectError(getLibraryError(error, i18n.t('errors.libraryLoad')))
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
      const requestId = libraryRequestId.current + 1
      libraryRequestId.current = requestId

      void bridge.library.getScope().then((scope) => {
        if (isEffectActive && libraryRequestId.current === requestId) {
          setActiveProject(scope.activeProject)
          setActiveBook(scope.activeBook)
          setBooks(scope.books)
        }
      }).catch((error: unknown) => {
        if (isEffectActive && libraryRequestId.current === requestId) {
          setProjectError(getLibraryError(error, i18n.t('errors.libraryLoad')))
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
    setIsDocumentDetached(false)
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

  useEffect(() => {
    return window.inkforge?.library.onScopeChanged((scope) => {
      booksRequestId.current += 1
      readRequestId.current += 1
      saveRequestId.current += 1
      const libraryOperationActive = libraryOperationActiveRef.current
      setWorkManagementNavigation((current) => {
        if (!current || !scope.activeProject) return null
        if (scope.activeProject.id !== current.projectId) {
          return current.action === 'rename-project' && libraryOperationActive
            ? current : null
        }
        return current.action !== null && !libraryOperationActive ? null : current
      })
      setActiveProject(scope.activeProject)
      setActiveBook(scope.activeBook)
      setBooks(scope.books)
      setNarrativeDialog(null)
      setIsBookDialogOpen(false)
      setIsGenreDialogOpen(false)
      setVaultTree([])
      setVaultError(null)
      if (document && isDirty) {
        setIsDocumentDetached(true)
        setSaveState('missing')
        setConflictDocument(null)
      } else {
        resetDocumentForProjectChange()
      }
      void loadVault()
    })
  }, [document, isDirty, loadVault, resetDocumentForProjectChange])

  const finishProjectActivation = useCallback((nextScope: LibraryActivationResult) => {
    booksRequestId.current += 1
    setWorkManagementNavigation(null)
    setIsBookDialogOpen(false)
    setIsGenreDialogOpen(false)
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
    setIsGenreDialogOpen(false)
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
      setProjectError(i18n.t('errors.libraryDesktop'))
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
        setProjectError(getLibraryError(error, i18n.t('errors.changeWork')))
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
      setProjectError(i18n.t('errors.libraryDesktop'))
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
        setProjectError(getLibraryError(error, i18n.t('errors.createWork')))
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
      setProjectError(i18n.t('errors.libraryDesktop'))
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
        setProjectError(getLibraryError(error, i18n.t('errors.changeBook')))
      }
    } finally {
      if (isMounted.current && libraryRequestId.current === requestId) {
        libraryOperationActiveRef.current = false
        setIsProjectBusy(false)
      }
    }
  }, [finishBookActivation])

  const createLibraryBook = useCallback(async (input: CreateBookInput) => {
    const bridge = window.inkforge

    if (!bridge) {
      setProjectError(i18n.t('errors.libraryDesktop'))
      return
    }

    const requestId = libraryRequestId.current + 1
    libraryRequestId.current = requestId
    libraryOperationActiveRef.current = true
    setIsProjectBusy(true)
    setProjectError(null)

    try {
      const nextActiveBook = await bridge.library.createBook(input)

      if (!isMounted.current || libraryRequestId.current !== requestId) {
        return
      }

      setIsBookDialogOpen(false)
      finishBookActivation(nextActiveBook)
      setWorkManagementNavigation((current) => current?.action === 'add-book'
        ? { ...current, action: null } : current)
    } catch (error) {
      if (isMounted.current && libraryRequestId.current === requestId) {
        setProjectError(getLibraryError(error, i18n.t('errors.addBook')))
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
      setProjectError(i18n.t('errors.libraryDesktop'))
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
      setWorkManagementNavigation((current) => {
        if (nextActiveProject === null) return null
        return current?.action === 'rename-project'
          ? { projectId: nextActiveProject.id, action: null } : current
      })
      setVaultTree([])
      setVaultState('loading')
      setVaultError(null)
      void loadVault()
    } catch (error) {
      if (isMounted.current && libraryRequestId.current === requestId) {
        setProjectError(getLibraryError(error, i18n.t('errors.renameWork')))
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
      setProjectError(i18n.t('errors.libraryDesktop'))
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
      setWorkManagementNavigation((current) => current?.action === 'rename-book'
        ? { ...current, action: null } : current)
    } catch (error) {
      if (isMounted.current && libraryRequestId.current === requestId) {
        setProjectError(getLibraryError(error, i18n.t('errors.renameBook')))
      }
    } finally {
      if (isMounted.current && libraryRequestId.current === requestId) {
        libraryOperationActiveRef.current = false
        setIsProjectBusy(false)
      }
    }
  }, [finishBookActivation])

  const returnToWorkManagement = useCallback((action: WorkManagementAction) => {
    setWorkManagementNavigation((current) => {
      if (current?.action !== action) return current
      return activeProjectId === current.projectId ? { ...current, action: null } : null
    })
  }, [activeProjectId])

  const cancelProjectDialog = useCallback(() => {
    setIsProjectDialogOpen(false)
    setProjectError(null)
  }, [])

  const cancelNarrativeDialog = useCallback(() => {
    setNarrativeDialog(null)
    setProjectError(null)
    if (narrativeDialog) returnToWorkManagement(narrativeDialog)
  }, [narrativeDialog, returnToWorkManagement])

  const openDocument = async (relativePath: string) => {
    if (!activeProject || relativePath === selectedPath) {
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
      setDocumentError(i18n.t('errors.documentDesktop'))
      return
    }

    try {
      const nextDocument = await window.inkforge.vault.read(relativePath, activeProject.id)

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
        setDocumentError(i18n.t('errors.documentOpen'))
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
      projectId === activeProject?.id ||
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
    type: 'add-book' | NarrativeDialogKind,
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
    if (type === 'add-book') setIsBookDialogOpen(true)
    else setNarrativeDialog(type)
  }

  const openManagementAction = (action: WorkManagementAction) => {
    if (!activeProject || (action !== 'genres' && (
      isProjectBusy || libraryOperationActiveRef.current || saveState === 'saving'
    ))) return

    setWorkManagementNavigation({ projectId: activeProject.id, action })
    if (action === 'genres') setIsGenreDialogOpen(true)
    else requestNarrativeDialog(action)
  }

  const cancelPendingAction = useCallback(() => {
    if (pendingAction && (
      pendingAction.type === 'add-book' ||
      pendingAction.type === 'rename-project' ||
      pendingAction.type === 'rename-book'
    )) {
      returnToWorkManagement(pendingAction.type)
    }
    setPendingAction(null)
  }, [pendingAction, returnToWorkManagement])

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
      action.type === 'rename-project' ||
      action.type === 'rename-book'
    ) {
      resetDocumentForProjectChange()
      setProjectError(null)
      setNarrativeDialog(action.type)
      return
    }

    if (action.type === 'add-book') {
      resetDocumentForProjectChange()
      setProjectError(null)
      setIsBookDialogOpen(true)
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
        setSaveError(i18n.t('errors.rereadDisk'))
        return
      }

      const relativePath = document.path
      const requestId = readRequestId.current + 1
      const draftAtRequest = draftContentRef.current
      readRequestId.current = requestId

      try {
        const nextDocument = await window.inkforge.vault.read(relativePath, document.projectId)

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
          i18n.t('errors.rereadPreserved'),
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
      isDocumentDetached ||
      activeProject?.id !== currentDocument.projectId ||
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
      setSaveError(i18n.t('errors.saveDesktop'))
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
        currentDocument.projectId,
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
      setSaveError(i18n.t('errors.saveFailed'))
    }
  }, [activeProject, document, isDocumentDetached, saveState])

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
    if (narrativeDialog === 'rename-project') {
      void renameLibraryProject(nextTitle)
      return
    }

    if (narrativeDialog === 'rename-book') {
      void renameLibraryBook(nextTitle)
    }
  }

  const narrativeDialogTitle = narrativeDialog === 'rename-project'
      ? activeProject?.type === 'saga'
        ? t('dialogs.renameSaga')
        : t('dialogs.renameBook')
      : t('dialogs.renameBook')
  const narrativeDialogLabel = narrativeDialog === 'rename-project' &&
    activeProject?.type === 'saga'
    ? t('dialogs.sagaTitle')
    : t('dialogs.bookTitle')
  const narrativeDialogInitialValue = narrativeDialog === 'rename-project'
    ? activeProject?.title ?? ''
    : narrativeDialog === 'rename-book'
      ? activeBook?.title ?? ''
      : ''
  const narrativeDialogSubmitLabel = t('dialogs.rename')
  const managedAction = workManagementNavigation?.projectId === activeProjectId
    ? workManagementNavigation?.action : null
  const isCloseWindowPending = pendingAction?.type === 'close-window'
  const isProjectChangePending = pendingAction?.type === 'switch-project'
    || pendingAction?.type === 'new-project'
  const isBookChangePending = pendingAction?.type === 'switch-book'
    || pendingAction?.type === 'add-book'
  const isRenamePending = pendingAction?.type === 'rename-project'
    || pendingAction?.type === 'rename-book'
  const discardMessage = isCloseWindowPending
    ? t('dialogs.closeMessage')
    : isProjectChangePending
      ? t('dialogs.workMessage')
      : isBookChangePending
        ? t('dialogs.bookMessage')
        : isRenamePending
          ? t('dialogs.continueMessage')
          : pendingAction?.type === 'read-mode'
            ? t('dialogs.readModeMessage')
            : t('dialogs.documentMessage')
  const discardConfirmLabel = isCloseWindowPending
    ? t('dialogs.exitWithoutSaving')
    : t('dialogs.discardChanges')

  return (
    <div className="app-shell">
      <AppHeader
        onHelp={() => setIsHelpOpen(true)}
        onSettings={() => setIsSettingsOpen(true)}
        connectionState={connectionState}
      />
      <div
        className={`workspace-grid${isDirectorResizing ? ' is-resizing' : ''}`}
        ref={workspaceGridRef}
        style={{ '--director-width': `${effectiveDirectorWidth}px` } as CSSProperties}
      >
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
          onManageWork={() => {
            if (activeProject) setWorkManagementNavigation({ projectId: activeProject.id, action: null })
          }}
          onReload={retryVault}
        />
        <DocumentWorkspace
          hasActiveProject={activeProject !== null}
          isBookMissing={activeProject?.type === 'saga' && activeBook === null}
          isDetached={isDocumentDetached}
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
        <div
          className="director-resize-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label={t('editor.assistantTitle')}
          aria-valuemin={directorBounds.minimum}
          aria-valuemax={directorBounds.maximum}
          aria-valuenow={effectiveDirectorWidth}
          tabIndex={0}
          onPointerDown={startDirectorResize}
          onKeyDown={resizeDirectorWithKeyboard}
        />
        <EditorPanel
          key={activeProject ? 'scope:project:' + activeProject.id : 'scope:none'}
          projectId={activeProject?.id ?? null}
          isSettingsOpen={isSettingsOpen}
          onUnavailableModel={promptForUnavailableModel}
          onCloseSettings={() => setIsSettingsOpen(false)}
          onConnectionStateChange={setConnectionState}
        />
      </div>
      {workManagementNavigation && workManagementNavigation.action === null &&
        activeProject?.id === workManagementNavigation.projectId && activeProject && (
        <WorkManagementDialog
          project={activeProject}
          activeBook={activeBook}
          isProjectBusy={isProjectBusy}
          isActiveBookAvailable={activeBook === null || books.some((book) => book.id === activeBook.id)}
          onCancel={() => setWorkManagementNavigation(null)}
          onRenameProject={() => openManagementAction('rename-project')}
          onConfigureGenres={() => openManagementAction('genres')}
          onAddBook={() => openManagementAction('add-book')}
          onRenameBook={() => openManagementAction('rename-book')}
        />
      )}
      {isProjectDialogOpen && (
        <ProjectDialog
          isCreating={isProjectBusy}
          error={projectError}
          onCancel={cancelProjectDialog}
          onCreate={(input) => void createLibraryProject(input)}
        />
      )}
      {isBookDialogOpen && (
        <BookDialog
          isCreating={isProjectBusy}
          error={projectError}
          exitLabel={managedAction === 'add-book' ? t('common.back') : undefined}
          onCancel={() => {
            setIsBookDialogOpen(false)
            setProjectError(null)
            returnToWorkManagement('add-book')
          }}
          onCreate={(input) => void createLibraryBook(input)}
        />
      )}
      {isGenreDialogOpen && activeProject && (
        <GenreConfigurationDialog
          key={`${activeProject.id}/${activeBook?.id ?? ''}`}
          projectId={activeProject.id}
          projectType={activeProject.type}
          bookId={activeBook?.id ?? null}
          exitLabel={managedAction === 'genres' ? t('common.back') : t('common.close')}
          onCancel={() => {
            setIsGenreDialogOpen(false)
            returnToWorkManagement('genres')
          }}
        />
      )}
      {narrativeDialog && (
        <NarrativeNameDialog
          key={narrativeDialog}
          title={narrativeDialogTitle}
          label={narrativeDialogLabel}
          initialValue={narrativeDialogInitialValue}
          submitLabel={narrativeDialogSubmitLabel}
          exitLabel={managedAction === narrativeDialog ? t('common.back') : undefined}
          isSubmitting={isProjectBusy}
          error={projectError}
          onCancel={cancelNarrativeDialog}
          onSubmit={submitNarrativeDialog}
        />
      )}
      {isHelpOpen && (
        <HelpDialog onClose={() => setIsHelpOpen(false)} />
      )}
      {pendingAction && (
        <ConfirmDialog
          title={t('dialogs.unsavedTitle')}
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
