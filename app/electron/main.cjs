const path = require('node:path')
const fs = require('node:fs/promises')
const { app, BrowserWindow, ipcMain, session } = require('electron')
const { createOpenCodeClient, serializeError } = require('./opencode-client.cjs')

const isDevelopment = process.argv.includes('--dev')
const developmentUrl = 'http://127.0.0.1:5173'
const projectRoot = path.resolve(__dirname, '..', '..')
const vaultRoot = path.join(projectRoot, 'vault')
let openCodeClient = null
let quitReady = false

function isHidden(name) {
  return name.startsWith('.')
}

function toVaultPath(...segments) {
  return segments.filter(Boolean).join('/')
}

async function listMarkdownTree(directoryPath = vaultRoot, relativeDirectory = '') {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true })
  const visibleEntries = entries
    .filter((entry) => !isHidden(entry.name) && !entry.isSymbolicLink())
    .sort((left, right) => {
      if (left.isDirectory() !== right.isDirectory()) {
        return left.isDirectory() ? -1 : 1
      }

      return left.name.localeCompare(right.name, 'es', { sensitivity: 'base' })
    })
  const nodes = []

  for (const entry of visibleEntries) {
    const relativePath = toVaultPath(relativeDirectory, entry.name)
    const absolutePath = path.join(directoryPath, entry.name)

    if (entry.isDirectory()) {
      const children = await listMarkdownTree(absolutePath, relativePath)

      nodes.push({
        type: 'directory',
        name: entry.name,
        path: relativePath,
        children,
      })

      continue
    }

    if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.md') {
      nodes.push({
        type: 'document',
        name: entry.name,
        path: relativePath,
      })
    }
  }

  return nodes
}

function isPathInside(parentPath, candidatePath) {
  const relativePath = path.relative(parentPath, candidatePath)

  return (
    relativePath !== '' &&
    relativePath !== '..' &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
  )
}

async function resolveMarkdownPath(relativePath) {
  const hasFilesystemRoot =
    typeof relativePath === 'string' &&
    (path.win32.parse(relativePath).root !== '' || path.posix.parse(relativePath).root !== '')

  if (typeof relativePath !== 'string' || relativePath.length === 0 || hasFilesystemRoot) {
    throw new Error('Ruta de documento no válida.')
  }

  const vaultSegments = relativePath.replaceAll('\\', '/').split('/')

  if (vaultSegments.some((segment) => !segment || segment === '.' || segment === '..' || isHidden(segment))) {
    throw new Error('Ruta de documento no válida.')
  }

  if (path.posix.extname(vaultSegments.at(-1)).toLowerCase() !== '.md') {
    throw new Error('Solo se pueden leer documentos Markdown.')
  }

  const realVaultRoot = await fs.realpath(vaultRoot)
  const requestedPath = path.resolve(vaultRoot, ...vaultSegments)
  const realRequestedPath = await fs.realpath(requestedPath)

  if (!isPathInside(realVaultRoot, realRequestedPath)) {
    throw new Error('El documento solicitado está fuera del vault.')
  }

  const fileStats = await fs.stat(realRequestedPath)

  if (!fileStats.isFile()) {
    throw new Error('El documento solicitado no es un archivo.')
  }

  return realRequestedPath
}

function configureContentSecurityPolicy() {
  const productionPolicy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ')

  const developmentPolicy = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self' ws://127.0.0.1:5173 http://127.0.0.1:5173",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ')

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [isDevelopment ? developmentPolicy : productionPolicy],
      },
    })
  })
}

function broadcast(channel, payload) {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(channel, payload)
    }
  }
}

function registerOpenCodeHandlers(client) {
  const handle = (channel, action) => {
    ipcMain.handle(channel, async (_event, payload) => {
      try {
        return { ok: true, value: await action(payload) }
      } catch (error) {
        return { ok: false, error: serializeError(error) }
      }
    })
  }

  handle('opencode:status', () => client.getStatus())
  handle('opencode:start', () => client.start())
  handle('opencode:list-models', () => client.listModels())
  handle('opencode:list-agents', () => client.listAgents())
  handle('opencode:create-session', (payload) => client.createSession(payload))
  handle('opencode:get-messages', (payload) => client.getMessages(payload?.sessionID))
  handle('opencode:send-message', (payload) => client.sendMessage(payload))
  handle('opencode:switch-model', (payload) => client.switchModel(payload))
  handle('opencode:switch-agent', (payload) => client.switchAgent(payload))
  handle('opencode:reply-permission', (payload) => client.replyPermission(payload))
  handle('opencode:reply-question', (payload) => client.replyQuestion(payload))
  handle('opencode:reject-question', (payload) => client.rejectQuestion(payload))
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#17191d',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  if (isDevelopment) {
    void mainWindow.loadURL(developmentUrl)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  configureContentSecurityPolicy()

  openCodeClient = createOpenCodeClient({
    projectRoot,
    onStatus: (status) => broadcast('opencode:status-changed', status),
    onEvent: (event) => broadcast('opencode:event', event),
  })
  registerOpenCodeHandlers(openCodeClient)

  ipcMain.handle('app:get-info', () => ({
    name: 'Inkforge',
    version: app.getVersion(),
  }))

  ipcMain.handle('vault:list', () => listMarkdownTree())

  ipcMain.handle('vault:read', async (_event, relativePath) => {
    const documentPath = await resolveMarkdownPath(relativePath)
    const content = await fs.readFile(documentPath, 'utf8')

    return {
      name: path.basename(documentPath),
      path: relativePath.replaceAll('\\', '/'),
      content,
    }
  })

  ipcMain.handle('vault:write', async (_event, relativePath, content) => {
    if (typeof content !== 'string') {
      throw new Error('El contenido del documento no es válido.')
    }

    const documentPath = await resolveMarkdownPath(relativePath)
    const fileHandle = await fs.open(documentPath, 'r+')

    try {
      const encodedContent = Buffer.from(content, 'utf8')
      await fileHandle.writeFile(encodedContent)
      await fileHandle.truncate(encodedContent.byteLength)
      await fileHandle.sync()
    } finally {
      await fileHandle.close()
    }

    return {
      name: path.basename(documentPath),
      path: relativePath.replaceAll('\\', '/'),
      content,
    }
  })

  createWindow()
  void openCodeClient.start().catch(() => undefined)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', (event) => {
  if (quitReady || !openCodeClient) {
    return
  }

  event.preventDefault()
  void openCodeClient.stop().finally(() => {
    quitReady = true
    app.quit()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
