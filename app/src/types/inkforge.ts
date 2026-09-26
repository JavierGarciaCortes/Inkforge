export interface InkforgeAppInfo {
  name: string
  version: string
}

export type LoadState = 'idle' | 'loading' | 'ready' | 'error'

export type InkforgeProjectType = 'novela' | 'saga'

export interface LibraryProjectSummary {
  id: string
  title: string
  type: InkforgeProjectType
}

export type ActiveProject = LibraryProjectSummary | null

export interface LibraryBookSummary {
  id: string
  title: string
  number: number
}

export type ActiveBook = LibraryBookSummary | null

export type CreateProjectInput =
  | {
      type: 'novela'
      bookTitle: string
    }
  | {
      type: 'saga'
      sagaTitle: string
      firstBookTitle: string
    }

export interface CreateBookInput {
  bookTitle: string
}

export interface LibraryActivationResult {
  activeProject: ActiveProject
  activeBook: ActiveBook
  books: LibraryBookSummary[]
}

export interface CreateProjectResult extends LibraryActivationResult {
  project: LibraryProjectSummary
}

export type SaveState = 'idle' | 'saving' | 'error' | 'conflict' | 'missing'

export type VaultPresentationKey =
  | 'vault.structure.projectManifest'
  | 'vault.structure.bookManifest'
  | 'vault.structure.world'
  | 'vault.structure.style'
  | 'vault.structure.references'
  | 'vault.structure.chapters'
  | 'vault.structure.planning'
  | 'vault.structure.canon'
  | 'vault.structure.notes'
  | 'vault.structure.resources'
  | 'vault.structure.chronology'
  | 'vault.structure.chapterOutline'
  | 'vault.structure.status'
  | 'vault.structure.foreshadowing'
  | 'vault.structure.foundations'
  | 'vault.structure.editorialGuide'
  | 'vault.structure.index'
  | 'vault.structure.lexicon'
  | 'vault.structure.storyOutline'
  | 'vault.structure.pending'
  | 'vault.structure.plot'
  | 'vault.structure.bookCanon'
  | 'vault.structure.bookSection'

export interface VaultPresentation {
  presentationKey?: VaultPresentationKey
  presentationValues?: Readonly<Record<string, string | number>>
}

export interface VaultDirectoryNode extends VaultPresentation {
  type: 'directory'
  name: string
  path: string
  presentation?: 'book-section'
  children: VaultTreeNode[]
}

export interface VaultDocumentNode extends VaultPresentation {
  type: 'document'
  name: string
  path: string
}

export type VaultTreeNode = VaultDirectoryNode | VaultDocumentNode

export interface VaultDocument extends VaultPresentation {
  projectId: string
  name: string
  path: string
  content: string
  revision: string
}

export type VaultWriteResult =
  | {
      ok: true
      document: VaultDocument
    }
  | {
      ok: false
      reason: 'conflict'
      currentDocument: VaultDocument
    }
  | {
      ok: false
      reason: 'missing'
      path: string
    }

export type OpenCodeConnectionState =
  | 'idle'
  | 'starting'
  | 'connected'
  | 'incompatible'
  | 'not_found'
  | 'error'

export interface OpenCodeStatus {
  state: OpenCodeConnectionState
  message: string
  version?: string
}

export type OpenCodeErrorCode =
  | 'invalid_request'
  | 'not_found'
  | 'incompatible'
  | 'disconnected'
  | 'session_missing'
  | 'model_unavailable'
  | 'invalid_credential'
  | 'quota'
  | 'unknown'

export interface OpenCodeError {
  code: OpenCodeErrorCode
  message: string
  retryable: boolean
}

export type OpenCodeResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: OpenCodeError }

export interface OpenCodeModel {
  providerID: string
  providerName: string
  modelID: string
  name: string
  variants: string[]
  isProviderDefault: boolean
  isFree: boolean
}

export interface OpenCodeAgent {
  name: string
  description: string
  mode: 'primary' | 'subagent'
}

export interface OpenCodeSession {
  id: string
  title: string
  agent?: string
}

export interface OpenCodeChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  status?: 'sending' | 'sent' | 'error'
}

export interface DirectorChatSession {
  id: string
  startIndex: number
}

export interface DirectorChatState {
  version: 1
  messages: OpenCodeChatMessage[]
  currentSession: DirectorChatSession | null
}

export interface OpenCodePermissionRequest {
  id: string
  sessionID: string
  action: string
  resources: string[]
}

export interface OpenCodeQuestionOption {
  label: string
  description: string
}

export interface OpenCodeQuestion {
  question: string
  header: string
  multiple: boolean
  custom: boolean
  options: OpenCodeQuestionOption[]
}

export interface OpenCodeQuestionRequest {
  id: string
  sessionID: string
  questions: OpenCodeQuestion[]
}

export interface OpenCodeEvent {
  id?: string
  type: string
  sessionID?: string
  messageID?: string
  messageRole?: 'user' | 'assistant'
  assistantMessageID?: string
  partID?: string
  delta?: string
  text?: string
  error?: OpenCodeError
  permission?: OpenCodePermissionRequest
  question?: OpenCodeQuestionRequest
}

export interface OpenCodeModelSelection {
  providerID: string
  modelID: string
  variant?: string
  displayName?: string
}

export interface OpenCodeSwitchResult {
  applied: boolean
  fallback: boolean
}

export interface InkforgeBridge {
  getAppInfo: () => Promise<InkforgeAppInfo>
  appWindow: {
    onCloseRequested: (callback: () => void) => () => void
    confirmClose: () => Promise<void>
  }
  library: {
    listProjects: () => Promise<LibraryProjectSummary[]>
    getActiveProject: () => Promise<ActiveProject>
    listBooks: (projectId?: string) => Promise<LibraryBookSummary[]>
    getActiveBook: () => Promise<ActiveBook>
    getScope: () => Promise<LibraryActivationResult>
    onScopeChanged: (callback: (scope: LibraryActivationResult) => void) => () => void
    activateProject: (projectId: string | null) => Promise<LibraryActivationResult>
    activateBook: (bookId: string) => Promise<LibraryBookSummary>
    createProject: (input: CreateProjectInput) => Promise<CreateProjectResult>
    createBook: (input: CreateBookInput) => Promise<LibraryBookSummary>
    renameProject: (nextTitle: string) => Promise<ActiveProject>
    renameActiveBook: (nextTitle: string) => Promise<LibraryBookSummary>
    onChanged: (callback: () => void) => () => void
  }
  vault: {
    list: () => Promise<VaultTreeNode[]>
    read: (relativePath: string, projectId: string) => Promise<VaultDocument>
    write: (
      relativePath: string,
      content: string,
      expectedRevision: string,
      projectId: string,
    ) => Promise<VaultWriteResult>
    onChanged: (callback: () => void) => () => void
  }
  directorState: {
    load: (projectId: string) => Promise<DirectorChatState>
    save: (projectId: string, state: DirectorChatState) => Promise<DirectorChatState>
  }
  opencode: {
    status: () => Promise<OpenCodeResult<OpenCodeStatus>>
    start: () => Promise<OpenCodeResult<OpenCodeStatus>>
    listModels: () => Promise<OpenCodeResult<OpenCodeModel[]>>
    listAgents: () => Promise<OpenCodeResult<OpenCodeAgent[]>>
    createSession: (input: { projectId: string | null; title?: string; agent?: string }) => Promise<OpenCodeResult<OpenCodeSession>>
    getMessages: (sessionID: string, projectId: string) => Promise<OpenCodeResult<OpenCodeChatMessage[]>>
    sendMessage: (input: {
      projectId: string | null
      sessionID: string
      agent: string
      model: OpenCodeModelSelection
      text: string
    }) => Promise<OpenCodeResult<{ accepted: boolean }>>
    switchModel: (input: {
      projectId: string | null
      sessionID: string
      model: OpenCodeModelSelection
    }) => Promise<OpenCodeResult<OpenCodeSwitchResult>>
    switchAgent: (input: {
      projectId: string | null
      sessionID: string
      agent: string
    }) => Promise<OpenCodeResult<OpenCodeSwitchResult>>
    replyPermission: (input: {
      projectId: string | null
      sessionID: string
      requestID: string
      reply: 'once' | 'always' | 'reject'
    }) => Promise<OpenCodeResult<{ accepted: boolean }>>
    replyQuestion: (input: {
      projectId: string | null
      sessionID: string
      requestID: string
      answers: string[][]
    }) => Promise<OpenCodeResult<{ accepted: boolean }>>
    rejectQuestion: (input: {
      projectId: string | null
      sessionID: string
      requestID: string
    }) => Promise<OpenCodeResult<{ accepted: boolean }>>
    onStatus: (callback: (status: OpenCodeStatus) => void) => () => void
    onEvent: (callback: (event: OpenCodeEvent) => void) => () => void
  }
}
