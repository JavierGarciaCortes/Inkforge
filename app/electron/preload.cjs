const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('inkforge', {
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
  vault: {
    list: () => ipcRenderer.invoke('vault:list'),
    read: (relativePath) => ipcRenderer.invoke('vault:read', relativePath),
  },
})
