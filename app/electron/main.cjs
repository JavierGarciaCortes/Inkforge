const path = require('node:path')
const nativeFs = require('node:fs')
const fs = require('node:fs/promises')
const { createHash } = require('node:crypto')
const { app, BrowserWindow, ipcMain, session } = require('electron')
const { createOpenCodeClient, serializeError } = require('./opencode-client.cjs')
const { createProjectLibrary } = require('./project-library.cjs')

const isDevelopment = process.argv.includes('--dev')
const developmentUrl = 'http://127.0.0.1:5173'
const projectRoot = path.resolve(__dirname, '..', '..')
const libraryRoot = path.join(projectRoot, 'vault')
const projectLibrary = createProjectLibrary(libraryRoot)
let activeVaultRoot = libraryRoot
let activeProject = {
  id: null,
  title: 'Vault actual',
  type: 'legacy',
}
let activeProjectRecord = null
let activeBook = null
let openCodeClient = null
let quitReady = false
let vaultWatcher = null
let vaultChangeTimer = null
let libraryWatcher = null
let libraryChangeTimer = null
const approvedWindowCloses = new WeakSet()

function isHidden(name) {
  return name.startsWith('.')
}

function toVaultPath(...segments) {
  return segments.filter(Boolean).join('/')
}

function createContentRevision(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

async function listMarkdownTree(
  directoryPath = activeVaultRoot,
  relativeDirectory = '',
  managedProjectIds = null,
) {
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
    if (
      entry.isDirectory() &&
      relativeDirectory === 'Proyectos' &&
      managedProjectIds?.has(entry.name)
    ) {
      continue
    }

    const relativePath = toVaultPath(relativeDirectory, entry.name)
    const absolutePath = path.join(directoryPath, entry.name)

    if (entry.isDirectory()) {
      const children = await listMarkdownTree(
        absolutePath,
        relativePath,
        managedProjectIds,
      )

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

async function resolveMarkdownPath(relativePath, vaultRoot = activeVaultRoot) {
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

function toProjectSummary(project) {
  return {
    id: project.id,
    title: project.title,
    type: project.type,
  }
}

function toBookSummary(book) {
  return {
    id: book.id,
    title: book.title,
    number: book.number,
  }
}

function getActiveProjectSummary() {
  return { ...activeProject }
}

function getActiveBookSummary() {
  return activeBook ? { ...activeBook } : null
}

async function setActiveProject(project) {
  let books = []

  if (project) {
    if (project.type === 'saga') {
      books = await projectLibrary.listBooks(project)
    }

    activeVaultRoot = project.directoryPath
    activeProjectRecord = project
    activeProject = toProjectSummary(project)
    activeBook = books.length > 0 ? toBookSummary(books[0]) : null
  } else {
    activeVaultRoot = libraryRoot
    activeProjectRecord = null
    activeBook = null
    activeProject = {
      id: null,
      title: 'Vault actual',
      type: 'legacy',
    }
  }

  startVaultWatcher()

  return {
    activeProject: getActiveProjectSummary(),
    activeBook: getActiveBookSummary(),
    books: books.map(toBookSummary),
  }
}

async function listLibraryBooks(projectId) {
  let project = activeProjectRecord

  if (projectId !== undefined) {
    if (typeof projectId !== 'string' || projectId.length === 0) {
      throw new Error('El identificador de la saga no es válido.')
    }

    project = await projectLibrary.getProject(projectId)

    if (!project || project.type !== 'saga') {
      throw new Error('La saga solicitada no existe o no es válida.')
    }
  } else if (!project || activeProject.type !== 'saga') {
    return []
  }

  const books = await projectLibrary.listBooks(project)
  return books.map(toBookSummary)
}

async function getVaultScopeSnapshot() {
  const vaultRoot = activeVaultRoot
  const projectRecord = activeProjectRecord
  const project = getActiveProjectSummary()
  const book = getActiveBookSummary()
  let validActiveBook = null

  if (project.type === 'saga' && projectRecord && book) {
    const books = await projectLibrary.listBooks(projectRecord)
    validActiveBook = books.find((candidate) => candidate.id === book.id) ?? null
  }

  return {
    vaultRoot,
    project,
    projectRecord,
    book,
    validActiveBook,
  }
}

function isSagaRelativePathAllowed(relativePath, validActiveBook) {
  if (typeof relativePath !== 'string') {
    return false
  }

  const segments = relativePath.replaceAll('\\', '/').split('/')

  if (segments.length === 1 && segments[0] === 'Proyecto.md') {
    return true
  }

  if (
    segments.length >= 2 &&
    (segments[0] === 'Mundo' ||
      segments[0] === 'Estilo' ||
      segments[0] === 'Referencias')
  ) {
    return true
  }

  return Boolean(
    validActiveBook &&
    segments.length >= 3 &&
    segments[0] === 'Libros' &&
    segments[1] === validActiveBook.id
  )
}

async function resolveVaultMarkdownPath(relativePath, scope) {
  if (
    scope.project.type === 'saga' &&
    !isSagaRelativePathAllowed(relativePath, scope.validActiveBook)
  ) {
    throw new Error('La ruta solicitada está fuera del libro activo.')
  }

  return resolveMarkdownPath(relativePath, scope.vaultRoot)
}

async function listSagaTree(scope) {
  const entries = await fs.readdir(scope.vaultRoot, { withFileTypes: true })
  const entriesByName = new Map(entries.map((entry) => [entry.name, entry]))
  const nodes = []

  const projectManifestEntry = entriesByName.get('Proyecto.md')

  if (
    projectManifestEntry?.isFile() &&
    !projectManifestEntry.isSymbolicLink()
  ) {
    nodes.push({
      type: 'document',
      name: 'Proyecto.md',
      path: 'Proyecto.md',
    })
  }

  for (const directoryName of ['Mundo', 'Estilo', 'Referencias']) {
    const entry = entriesByName.get(directoryName)

    if (!entry?.isDirectory() || entry.isSymbolicLink()) {
      continue
    }

    nodes.push({
      type: 'directory',
      name: directoryName,
      path: directoryName,
      children: await listMarkdownTree(
        path.join(scope.vaultRoot, directoryName),
        directoryName,
      ),
    })
  }

  if (scope.validActiveBook) {
    const bookPath = toVaultPath('Libros', scope.validActiveBook.id)

    nodes.push({
      type: 'directory',
      name: scope.validActiveBook.title,
      path: bookPath,
      presentation: 'book-section',
      children: await listMarkdownTree(
        scope.validActiveBook.directoryPath,
        bookPath,
      ),
    })
  }

  return nodes
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

function stopVaultWatcher() {
  if (vaultChangeTimer) {
    clearTimeout(vaultChangeTimer)
    vaultChangeTimer = null
  }

  if (vaultWatcher) {
    const watcher = vaultWatcher
    vaultWatcher = null

    try {
      watcher.close()
    } catch {
      // The watcher may already be closed after a filesystem error.
    }
  }
}

function startVaultWatcher() {
  stopVaultWatcher()

  try {
    const watcher = nativeFs.watch(activeVaultRoot, { recursive: true }, () => {
      if (vaultWatcher !== watcher) {
        return
      }

      if (vaultChangeTimer) {
        clearTimeout(vaultChangeTimer)
      }

      vaultChangeTimer = setTimeout(() => {
        vaultChangeTimer = null
        broadcast('vault:changed')
      }, 200)
    })

    vaultWatcher = watcher
    watcher.on('error', () => {
      if (vaultWatcher === watcher) {
        stopVaultWatcher()
      }
    })
  } catch {
    stopVaultWatcher()
  }
}

function isPotentialLibraryChange(fileName) {
  if (typeof fileName !== 'string' || fileName.length === 0) {
    return true
  }

  const segments = fileName.replaceAll('\\', '/').split('/').filter(Boolean)

  if (segments[0]?.toLowerCase() !== 'proyectos') {
    return false
  }

  return (
    segments.length <= 2 ||
    (segments.length === 3 && segments[2] === 'Proyecto.md') ||
    (
      segments[2] === 'Libros' &&
      (
        segments.length <= 4 ||
        (segments.length === 5 && segments[4] === 'Libro.md')
      )
    )
  )
}

function notifyLibraryChanged() {
  libraryChangeTimer = null
  broadcast('library:changed')
}

function scheduleLibraryChanged() {
  if (libraryChangeTimer) {
    clearTimeout(libraryChangeTimer)
  }

  libraryChangeTimer = setTimeout(notifyLibraryChanged, 200)
}

function stopLibraryWatcher() {
  if (libraryChangeTimer) {
    clearTimeout(libraryChangeTimer)
    libraryChangeTimer = null
  }

  if (libraryWatcher) {
    const watcher = libraryWatcher
    libraryWatcher = null

    try {
      watcher.close()
    } catch {
      // The watcher may already be closed after a filesystem error.
    }
  }
}

function startLibraryWatcher() {
  stopLibraryWatcher()

  try {
    const watcher = nativeFs.watch(libraryRoot, { recursive: true }, (_eventType, fileName) => {
      if (libraryWatcher !== watcher || !isPotentialLibraryChange(fileName)) {
        return
      }

      scheduleLibraryChanged()
    })

    libraryWatcher = watcher
    watcher.on('error', () => {
      if (libraryWatcher === watcher) {
        stopLibraryWatcher()
      }
    })
  } catch {
    stopLibraryWatcher()
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

  mainWindow.on('close', (event) => {
    if (approvedWindowCloses.delete(mainWindow) || quitReady) {
      return
    }

    event.preventDefault()

    if (!mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send('window:close-requested')
    }
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
  startVaultWatcher()
  startLibraryWatcher()

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

  ipcMain.handle('window:confirm-close', (event) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender)

    if (!targetWindow || targetWindow.isDestroyed()) {
      return
    }

    approvedWindowCloses.add(targetWindow)
    targetWindow.close()
  })

  ipcMain.handle('library:list-projects', async () => {
    const projects = await projectLibrary.listProjects()
    return projects.map(toProjectSummary)
  })

  ipcMain.handle('library:get-active-project', () => getActiveProjectSummary())
  ipcMain.handle('library:list-books', (_event, projectId) => listLibraryBooks(projectId))
  ipcMain.handle('library:get-active-book', () => getActiveBookSummary())

  ipcMain.handle('library:activate-project', async (_event, projectId) => {
    if (projectId === null) {
      return setActiveProject(null)
    }

    const project = await projectLibrary.getProject(projectId)

    if (!project) {
      throw new Error('La obra solicitada no existe o no es válida.')
    }

    return setActiveProject(project)
  })

  ipcMain.handle('library:activate-book', async (_event, bookId) => {
    if (!activeProjectRecord || activeProject.type !== 'saga') {
      throw new Error('No hay una saga activa.')
    }

    const book = await projectLibrary.getBook(activeProjectRecord, bookId)

    if (!book) {
      throw new Error('El libro solicitado no existe o no es válido.')
    }

    activeBook = toBookSummary(book)
    startVaultWatcher()

    return getActiveBookSummary()
  })

  ipcMain.handle('library:create-project', async (_event, input) => {
    const project = await projectLibrary.createProject(input)
    const nextScope = await setActiveProject(project)

    scheduleLibraryChanged()

    return {
      project: toProjectSummary(project),
      ...nextScope,
    }
  })

  ipcMain.handle('library:create-book', async (_event, input) => {
    if (!activeProjectRecord || activeProject.type !== 'saga') {
      throw new Error('Solo se pueden añadir libros a una saga activa.')
    }

    const book = await projectLibrary.createBook(activeProjectRecord, input)
    activeBook = toBookSummary(book)
    startVaultWatcher()
    scheduleLibraryChanged()

    return getActiveBookSummary()
  })

  ipcMain.handle('library:rename-project', async (_event, nextTitle) => {
    if (!activeProjectRecord || activeProject.type === 'legacy') {
      throw new Error('El vault heredado no se puede renombrar.')
    }

    const renamedProject = await projectLibrary.renameProject(
      activeProjectRecord,
      nextTitle,
    )
    activeProjectRecord = renamedProject
    activeVaultRoot = renamedProject.directoryPath
    activeProject = toProjectSummary(renamedProject)
    startVaultWatcher()
    scheduleLibraryChanged()

    return getActiveProjectSummary()
  })

  ipcMain.handle('library:rename-active-book', async (_event, nextTitle) => {
    if (!activeProjectRecord || activeProject.type !== 'saga' || !activeBook) {
      throw new Error('No hay un libro activo que se pueda renombrar.')
    }

    const renamedBook = await projectLibrary.renameBook(
      activeProjectRecord,
      activeBook.id,
      nextTitle,
    )
    activeBook = toBookSummary(renamedBook)
    startVaultWatcher()
    scheduleLibraryChanged()

    return getActiveBookSummary()
  })

  ipcMain.handle('vault:list', async () => {
    const scope = await getVaultScopeSnapshot()

    if (scope.project.type === 'saga') {
      return listSagaTree(scope)
    }

    if (scope.project.type === 'novela') {
      return listMarkdownTree(scope.vaultRoot)
    }

    const projects = await projectLibrary.listProjects()
    const managedProjectIds = new Set(projects.map((project) => project.id))

    return listMarkdownTree(scope.vaultRoot, '', managedProjectIds)
  })

  ipcMain.handle('vault:read', async (_event, relativePath) => {
    const scope = await getVaultScopeSnapshot()
    const documentPath = await resolveVaultMarkdownPath(relativePath, scope)
    const content = await fs.readFile(documentPath, 'utf8')

    return {
      name: path.basename(documentPath),
      path: relativePath.replaceAll('\\', '/'),
      content,
      revision: createContentRevision(content),
    }
  })

  ipcMain.handle('vault:write', async (_event, relativePath, content, expectedRevision) => {
    if (typeof content !== 'string') {
      throw new Error('El contenido del documento no es válido.')
    }

    if (typeof expectedRevision !== 'string' || expectedRevision.trim().length === 0) {
      throw new Error('La revisión esperada del documento no es válida.')
    }

    const normalizedPath = typeof relativePath === 'string'
      ? relativePath.replaceAll('\\', '/')
      : relativePath
    const scope = await getVaultScopeSnapshot()
    let documentPath

    try {
      documentPath = await resolveVaultMarkdownPath(relativePath, scope)
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return { ok: false, reason: 'missing', path: normalizedPath }
      }

      throw error
    }

    let fileHandle

    try {
      fileHandle = await fs.open(documentPath, 'r+')
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return { ok: false, reason: 'missing', path: normalizedPath }
      }

      throw error
    }

    try {
      const currentContent = await fileHandle.readFile('utf8')
      const currentRevision = createContentRevision(currentContent)

      if (currentRevision !== expectedRevision) {
        return {
          ok: false,
          reason: 'conflict',
          currentDocument: {
            name: path.basename(documentPath),
            path: normalizedPath,
            content: currentContent,
            revision: currentRevision,
          },
        }
      }

      const encodedContent = Buffer.from(content, 'utf8')
      await fileHandle.write(encodedContent, 0, encodedContent.byteLength, 0)
      await fileHandle.truncate(encodedContent.byteLength)
      await fileHandle.sync()

      return {
        ok: true,
        document: {
          name: path.basename(documentPath),
          path: normalizedPath,
          content,
          revision: createContentRevision(content),
        },
      }
    } finally {
      await fileHandle.close()
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

app.on('will-quit', () => {
  stopVaultWatcher()
  stopLibraryWatcher()
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
