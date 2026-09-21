const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('inkforge', {
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
})
