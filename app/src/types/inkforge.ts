export interface InkforgeAppInfo {
  name: string
  version: string
}

export type LoadState = 'idle' | 'loading' | 'ready' | 'error'
export type SaveState = 'idle' | 'saving' | 'error'

export interface VaultDirectoryNode {
  type: 'directory'
  name: string
  path: string
  children: VaultTreeNode[]
}

export interface VaultDocumentNode {
  type: 'document'
  name: string
  path: string
}

export type VaultTreeNode = VaultDirectoryNode | VaultDocumentNode

export interface VaultDocument {
  name: string
  path: string
  content: string
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
}

export interface OpenCodeSwitchResult {
  applied: boolean
  fallback: boolean
}

export interface InkforgeBridge {
  getAppInfo: () => Promise<InkforgeAppInfo>
  vault: {
    list: () => Promise<VaultTreeNode[]>
    read: (relativePath: string) => Promise<VaultDocument>
    write: (relativePath: string, content: string) => Promise<VaultDocument>
  }
  opencode: {
    status: () => Promise<OpenCodeResult<OpenCodeStatus>>
    start: () => Promise<OpenCodeResult<OpenCodeStatus>>
    listModels: () => Promise<OpenCodeResult<OpenCodeModel[]>>
    listAgents: () => Promise<OpenCodeResult<OpenCodeAgent[]>>
    createSession: (input: { title?: string; agent?: string }) => Promise<OpenCodeResult<OpenCodeSession>>
    getMessages: (sessionID: string) => Promise<OpenCodeResult<OpenCodeChatMessage[]>>
    sendMessage: (input: {
      sessionID: string
      agent: string
      model: OpenCodeModelSelection
      text: string
    }) => Promise<OpenCodeResult<{ accepted: boolean }>>
    switchModel: (input: {
      sessionID: string
      model: OpenCodeModelSelection
    }) => Promise<OpenCodeResult<OpenCodeSwitchResult>>
    switchAgent: (input: {
      sessionID: string
      agent: string
    }) => Promise<OpenCodeResult<OpenCodeSwitchResult>>
    replyPermission: (input: {
      sessionID: string
      requestID: string
      reply: 'once' | 'always' | 'reject'
    }) => Promise<OpenCodeResult<{ accepted: boolean }>>
    replyQuestion: (input: {
      sessionID: string
      requestID: string
      answers: string[][]
    }) => Promise<OpenCodeResult<{ accepted: boolean }>>
    rejectQuestion: (input: {
      sessionID: string
      requestID: string
    }) => Promise<OpenCodeResult<{ accepted: boolean }>>
    onStatus: (callback: (status: OpenCodeStatus) => void) => () => void
    onEvent: (callback: (event: OpenCodeEvent) => void) => () => void
  }
}
