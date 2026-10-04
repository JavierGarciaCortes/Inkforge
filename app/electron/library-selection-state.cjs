const path = require('node:path')
const fs = require('node:fs/promises')
const { randomUUID } = require('node:crypto')

const STATE_VERSION = 3
const STATE_FILE_NAME = 'library-selection.json'
const MAX_STATE_BYTES = 4096

function isIdentifier(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 255
}

function validateState(value) {
  if (
    value === null || typeof value !== 'object' || Array.isArray(value) ||
    value.version !== STATE_VERSION ||
    !Object.hasOwn(value, 'activeProjectId') ||
    !Object.hasOwn(value, 'activeBookId') ||
    (value.activeProjectId !== null && !isIdentifier(value.activeProjectId)) ||
    (value.activeBookId !== null && !isIdentifier(value.activeBookId)) ||
    (value.activeProjectId === null && value.activeBookId !== null)
  ) {
    return null
  }

  return {
    version: STATE_VERSION,
    activeProjectId: value.activeProjectId,
    activeBookId: value.activeBookId,
  }
}

function migrateLegacyState(value) {
  if (
    value === null || typeof value !== 'object' || Array.isArray(value) ||
    (value.version !== 1 && value.version !== 2) ||
    !Object.hasOwn(value, 'activeProjectId') ||
    (value.activeProjectId !== null && !isIdentifier(value.activeProjectId)) ||
    (Object.hasOwn(value, 'activeBookId') &&
      value.activeBookId !== null && !isIdentifier(value.activeBookId)) ||
    (value.activeProjectId === null &&
      Object.hasOwn(value, 'activeBookId') && value.activeBookId !== null)
  ) {
    return null
  }

  return {
    version: STATE_VERSION,
    activeProjectId: value.activeProjectId,
    activeBookId: Object.hasOwn(value, 'activeBookId') ? value.activeBookId : null,
  }
}

function createLibrarySelectionStateStore(userDataPath) {
  const statePath = path.join(userDataPath, STATE_FILE_NAME)
  let writeChain = Promise.resolve()

  async function load() {
    try {
      const stats = await fs.lstat(statePath)

      if (!stats.isFile() || stats.isSymbolicLink() || stats.size > MAX_STATE_BYTES) {
        return null
      }

      const storedState = JSON.parse(await fs.readFile(statePath, 'utf8'))
      return validateState(storedState) ?? migrateLegacyState(storedState)
    } catch {
      return null
    }
  }

  function save(selection) {
    const state = validateState({ version: STATE_VERSION, ...selection })

    if (!state) {
      return Promise.reject(new Error('La selección de Biblioteca no es válida.'))
    }

    writeChain = writeChain.catch(() => undefined).then(async () => {
      await fs.mkdir(userDataPath, { recursive: true })
      const temporaryPath = path.join(
        userDataPath,
        `.library-selection-${process.pid}-${randomUUID()}.tmp`,
      )
      let handle

      try {
        handle = await fs.open(temporaryPath, 'wx')
        await handle.writeFile(`${JSON.stringify(state)}\n`, 'utf8')
        await handle.sync()
        await handle.close()
        handle = null
        await fs.rename(temporaryPath, statePath)
      } finally {
        await handle?.close()
        await fs.unlink(temporaryPath).catch((error) => {
          if (error?.code !== 'ENOENT') {
            throw error
          }
        })
      }
    })

    return writeChain
  }

  return { load, save }
}

module.exports = { createLibrarySelectionStateStore }
