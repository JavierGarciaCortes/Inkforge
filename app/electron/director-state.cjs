const path = require('node:path')
const fs = require('node:fs/promises')
const { randomUUID } = require('node:crypto')

const DIRECTOR_STATE_VERSION = 1
const STATE_DIRECTORY_NAME = '.inkforge'
const STATE_FILE_NAME = 'director-chat.json'

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isPathInside(rootPath, targetPath) {
  const relativePath = path.relative(rootPath, targetPath)
  return relativePath === '' || (
    !relativePath.startsWith(`..${path.sep}`) &&
    relativePath !== '..' &&
    !path.isAbsolute(relativePath)
  )
}

function validateMessage(message) {
  if (
    !isRecord(message) ||
    typeof message.id !== 'string' ||
    message.id.length === 0 ||
    typeof message.text !== 'string' ||
    !['user', 'assistant'].includes(message.role) ||
    (
      message.status !== undefined &&
      !['sending', 'sent', 'error'].includes(message.status)
    )
  ) {
    throw new Error('El historial persistido del Director no tiene un formato válido.')
  }

  return {
    id: message.id,
    role: message.role,
    text: message.text,
    ...(message.status ? { status: message.status } : {}),
  }
}

function validateState(value) {
  if (
    !isRecord(value) ||
    value.version !== DIRECTOR_STATE_VERSION ||
    !Array.isArray(value.messages)
  ) {
    throw new Error('El historial persistido del Director no tiene un formato válido.')
  }

  const messages = value.messages.map(validateMessage)
  let currentSession = null

  if (value.currentSession !== undefined && value.currentSession !== null) {
    if (
      !isRecord(value.currentSession) ||
      typeof value.currentSession.id !== 'string' ||
      value.currentSession.id.length === 0 ||
      value.currentSession.id.length > 200 ||
      !Number.isInteger(value.currentSession.startIndex) ||
      value.currentSession.startIndex < 0 ||
      value.currentSession.startIndex > messages.length
    ) {
      throw new Error('La sesión persistida del Director no tiene un formato válido.')
    }

    currentSession = {
      id: value.currentSession.id,
      startIndex: value.currentSession.startIndex,
    }
  }

  return {
    version: DIRECTOR_STATE_VERSION,
    messages,
    currentSession,
  }
}

function emptyState() {
  return {
    version: DIRECTOR_STATE_VERSION,
    messages: [],
    currentSession: null,
  }
}

function createDirectorStateStore(projectLibrary) {
  const writeChains = new Map()

  async function resolveProject(projectId) {
    if (typeof projectId !== 'string' || projectId.length === 0) {
      throw new Error('La obra del historial del Director no es válida.')
    }

    const project = await projectLibrary.getProject(projectId)

    if (!project) {
      throw new Error('La obra del historial del Director no existe o no es válida.')
    }

    const projectRoot = await fs.realpath(project.directoryPath)
    return {
      projectRoot,
      stateDirectory: path.join(projectRoot, STATE_DIRECTORY_NAME),
      statePath: path.join(projectRoot, STATE_DIRECTORY_NAME, STATE_FILE_NAME),
    }
  }

  async function inspectStateDirectory(scope) {
    let directoryStats

    try {
      directoryStats = await fs.lstat(scope.stateDirectory)
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return false
      }

      throw error
    }

    if (!directoryStats.isDirectory() || directoryStats.isSymbolicLink()) {
      throw new Error('El directorio técnico de Inkforge no es válido.')
    }

    const realDirectory = await fs.realpath(scope.stateDirectory)

    if (!isPathInside(scope.projectRoot, realDirectory)) {
      throw new Error('El directorio técnico de Inkforge está fuera de la obra.')
    }

    return true
  }

  async function readExistingState(scope) {
    if (!await inspectStateDirectory(scope)) {
      return null
    }

    let stateStats

    try {
      stateStats = await fs.lstat(scope.statePath)
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return null
      }

      throw error
    }

    if (!stateStats.isFile() || stateStats.isSymbolicLink()) {
      throw new Error('El archivo de historial del Director no es válido.')
    }

    const realStatePath = await fs.realpath(scope.statePath)

    if (!isPathInside(scope.projectRoot, realStatePath)) {
      throw new Error('El historial del Director está fuera de la obra.')
    }

    let parsedState

    try {
      parsedState = JSON.parse(await fs.readFile(realStatePath, 'utf8'))
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('El historial persistido del Director contiene JSON no válido.')
      }

      throw error
    }

    return validateState(parsedState)
  }

  async function load(projectId) {
    const scope = await resolveProject(projectId)
    return await readExistingState(scope) ?? emptyState()
  }

  async function write(projectId, state) {
    const scope = await resolveProject(projectId)
    const validatedState = validateState(state)
    const directoryExists = await inspectStateDirectory(scope)

    if (directoryExists) {
      await readExistingState(scope)
    } else {
      await fs.mkdir(scope.stateDirectory)
      await inspectStateDirectory(scope)
    }

    const contents = `${JSON.stringify(validatedState, null, 2)}\n`
    const temporaryPath = path.join(
      scope.stateDirectory,
      `.director-chat-${process.pid}-${randomUUID()}.tmp`,
    )
    let handle

    try {
      handle = await fs.open(temporaryPath, 'wx')
      await handle.writeFile(contents, 'utf8')
      await handle.sync()
      await handle.close()
      handle = null
      await fs.rename(temporaryPath, scope.statePath)
    } finally {
      await handle?.close()
      await fs.unlink(temporaryPath).catch((error) => {
        if (error?.code !== 'ENOENT') {
          throw error
        }
      })
    }

    return validatedState
  }

  function save(projectId, state) {
    const previousWrite = writeChains.get(projectId) ?? Promise.resolve()
    const nextWrite = previousWrite.catch(() => undefined).then(() => write(projectId, state))
    writeChains.set(projectId, nextWrite)

    return nextWrite.finally(() => {
      if (writeChains.get(projectId) === nextWrite) {
        writeChains.delete(projectId)
      }
    })
  }

  return { load, save }
}

module.exports = {
  DIRECTOR_STATE_VERSION,
  createDirectorStateStore,
}
