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
  vault: {
    list: () => ipcRenderer.invoke('vault:list'),
    read: (relativePath) => ipcRenderer.invoke('vault:read', relativePath),
    write: (relativePath, content, expectedRevision) => (
      ipcRenderer.invoke('vault:write', relativePath, content, expectedRevision)
    ),
    onChanged: (callback) => subscribe('vault:changed', callback),
  },
  opencode: {
    status: () => ipcRenderer.invoke('opencode:status'),
    start: () => ipcRenderer.invoke('opencode:start'),
    listModels: () => ipcRenderer.invoke('opencode:list-models'),
    listAgents: () => ipcRenderer.invoke('opencode:list-agents'),
    createSession: (input) => ipcRenderer.invoke('opencode:create-session', input),
    getMessages: (sessionID) => ipcRenderer.invoke('opencode:get-messages', { sessionID }),
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
