const { contextBridge, ipcRenderer } = require('electron')

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

contextBridge.exposeInMainWorld('inkforge', {
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
  appWindow: {
    onCloseRequested: (callback) => subscribe('window:close-requested', callback),
    confirmClose: () => ipcRenderer.invoke('window:confirm-close'),
  },
  library: {
    listProjects: () => ipcRenderer.invoke('library:list-projects'),
    getActiveProject: () => ipcRenderer.invoke('library:get-active-project'),
    listBooks: (projectId) => ipcRenderer.invoke('library:list-books', projectId),
    getActiveBook: () => ipcRenderer.invoke('library:get-active-book'),
    getScope: () => ipcRenderer.invoke('library:get-scope'),
    listGenreProfiles: () => ipcRenderer.invoke('library:list-genre-profiles'),
    getGenreConfiguration: () => ipcRenderer.invoke('library:get-genre-configuration'),
    updateGenreConfiguration: (input) => ipcRenderer.invoke('library:update-genre-configuration', input),
    onScopeChanged: (callback) => subscribe('library:scope-changed', callback),
    activateProject: (projectId) => ipcRenderer.invoke('library:activate-project', projectId),
    activateBook: (bookId) => ipcRenderer.invoke('library:activate-book', bookId),
    createProject: (input) => ipcRenderer.invoke('library:create-project', input),
    createBook: (input) => ipcRenderer.invoke('library:create-book', input),
    renameProject: (nextTitle) => ipcRenderer.invoke('library:rename-project', nextTitle),
    renameActiveBook: (nextTitle) => (
      ipcRenderer.invoke('library:rename-active-book', nextTitle)
    ),
    deleteProject: (input) => ipcRenderer.invoke('library:delete-project', input),
    deleteBook: (input) => ipcRenderer.invoke('library:delete-book', input),
    reorderBooks: (input) => ipcRenderer.invoke('library:reorder-books', input),
    extractBookToStandalone: (input) => ipcRenderer.invoke('library:extract-book', input),
    onChanged: (callback) => subscribe('library:changed', callback),
  },
  vault: {
    list: () => ipcRenderer.invoke('vault:list'),
    read: (relativePath, projectId) => ipcRenderer.invoke('vault:read', relativePath, projectId),
    write: (relativePath, content, expectedRevision, projectId) => (
      ipcRenderer.invoke('vault:write', relativePath, content, expectedRevision, projectId)
    ),
    onChanged: (callback) => subscribe('vault:changed', callback),
  },
  directorState: {
    load: (projectId) => ipcRenderer.invoke('director-state:load', { projectId }),
    save: (projectId, state) => (
      ipcRenderer.invoke('director-state:save', { projectId, state })
    ),
  },
  opencode: {
    status: () => ipcRenderer.invoke('opencode:status'),
    start: () => ipcRenderer.invoke('opencode:start'),
    listModels: () => ipcRenderer.invoke('opencode:list-models'),
    listAgents: () => ipcRenderer.invoke('opencode:list-agents'),
    createSession: (input) => ipcRenderer.invoke('opencode:create-session', input),
    getMessages: (sessionID, projectId) => ipcRenderer.invoke('opencode:get-messages', { sessionID, projectId }),
    getPendingInteractions: (sessionID, projectId) => ipcRenderer.invoke('opencode:get-pending-interactions', { sessionID, projectId }),
    sendMessage: (input) => ipcRenderer.invoke('opencode:send-message', input),
    switchModel: (input) => ipcRenderer.invoke('opencode:switch-model', input),
    switchAgent: (input) => ipcRenderer.invoke('opencode:switch-agent', input),
    replyPermission: (input) => ipcRenderer.invoke('opencode:reply-permission', input),
    replyQuestion: (input) => ipcRenderer.invoke('opencode:reply-question', input),
    rejectQuestion: (input) => ipcRenderer.invoke('opencode:reject-question', input),
    onStatus: (callback) => subscribe('opencode:status-changed', callback),
    onEvent: (callback) => subscribe('opencode:event', callback),
  },
})
