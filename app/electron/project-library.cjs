const path = require('node:path')
const fs = require('node:fs/promises')

const PLANNING_DOCUMENTS = [
  ['Cronología.md', 'Cronología'],
  ['Escaleta.md', 'Escaleta'],
  ['Estado.md', 'Estado'],
  ['Foreshadowing.md', 'Foreshadowing'],
  ['Fundamentos.md', 'Fundamentos'],
  ['Guía editorial.md', 'Guía editorial'],
  ['Índice.md', 'Índice'],
  ['Léxico.md', 'Léxico'],
  ['Outliner.md', 'Outliner'],
  ['Pendientes.md', 'Pendientes'],
  ['Trama.md', 'Trama'],
]

const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i
const WINDOWS_INVALID_CHARACTERS = /[<>:"/\\|?*\u0000-\u001f]/u
const BOOK_DIRECTORY_PATTERN = /^(\d{2}) - (.+)$/u
const GENRE_DIRECTORY_NAME = 'Generos'

function validateGenreName(value) {
  if (typeof value !== 'string') throw new Error('El nombre del género no es válido.')
  const name = value.trim()
  if (!name || name.startsWith('.') || /[. ]$/u.test(name) ||
      WINDOWS_INVALID_CHARACTERS.test(name) || WINDOWS_RESERVED_NAME.test(name)) {
    throw new Error('El nombre del género no es seguro para un archivo.')
  }
  return name
}

function normalizeGenres(value) {
  if (!Array.isArray(value)) throw new Error('Los géneros deben ser una lista de nombres.')
  const seen = new Set()
  return value.map(validateGenreName).filter((name) => {
    const key = name.normalize('NFC').toLocaleLowerCase('es')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function manifestGenres(frontmatter) {
  const value = frontmatter.get('generos')
  if (value === undefined) return []
  try { return normalizeGenres(value) } catch { return null }
}

function isPathInside(parentPath, candidatePath) {
  const relativePath = path.relative(parentPath, candidatePath)

  return (
    relativePath !== '' &&
    relativePath !== '..' &&
    !relativePath.startsWith('..' + path.sep) &&
    !path.isAbsolute(relativePath)
  )
}

function validateNarrativeTitle(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(label + ' no puede estar vacío.')
  }

  const title = value.trim()

  if (title.startsWith('.')) {
    throw new Error(label + ' no puede empezar por ".".')
  }

  if (WINDOWS_INVALID_CHARACTERS.test(value)) {
    throw new Error(label + ' contiene caracteres no permitidos.')
  }

  if (/[. ]$/u.test(value)) {
    throw new Error(label + ' no puede terminar en punto ni espacio.')
  }

  if (WINDOWS_RESERVED_NAME.test(title)) {
    throw new Error(label + ' usa un nombre reservado de Windows.')
  }

  return title
}

function parseFrontmatterValue(value) {
  const normalizedValue = value.trim()

  if (normalizedValue.startsWith('[')) {
    try {
      const parsedValue = JSON.parse(normalizedValue)
      return Array.isArray(parsedValue) && parsedValue.every((item) => typeof item === 'string')
        ? parsedValue : null
    } catch { return null }
  }
  if (normalizedValue === 'true') return true
  if (normalizedValue === 'false') return false

  if (normalizedValue.startsWith('"') && normalizedValue.endsWith('"')) {
    try {
      const parsedValue = JSON.parse(normalizedValue)
      return typeof parsedValue === 'string' ? parsedValue : null
    } catch {
      return null
    }
  }

  return normalizedValue
}

function parseFrontmatter(content) {
  const normalizedContent = content.startsWith('\uFEFF') ? content.slice(1) : content
  const lines = normalizedContent.split(/\r?\n/u)

  if (lines[0] !== '---') {
    return null
  }

  const endIndex = lines.indexOf('---', 1)

  if (endIndex === -1) {
    return null
  }

  const frontmatter = new Map()

  for (const line of lines.slice(1, endIndex)) {
    const separatorIndex = line.indexOf(':')

    if (separatorIndex === -1) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    const value = parseFrontmatterValue(line.slice(separatorIndex + 1))

    if (key) {
      frontmatter.set(key, value)
    }
  }

  return frontmatter
}

function parseProjectManifest(content) {
  const frontmatter = parseFrontmatter(content)

  if (!frontmatter) {
    return null
  }

  const type = frontmatter.get('tipo')
  const title = frontmatter.get('titulo')
  const genres = manifestGenres(frontmatter)

  if (
    frontmatter.get('inkforge') !== '1' ||
    (type !== 'novela' && type !== 'saga') ||
    typeof title !== 'string' || genres === null
  ) {
    return null
  }

  return { type, title, genres }
}

function parseBookManifest(content) {
  const frontmatter = parseFrontmatter(content)

  if (!frontmatter) {
    return null
  }

  const title = frontmatter.get('titulo')
  const rawNumber = frontmatter.get('numero')
  const number = Number(rawNumber)
  const genres = manifestGenres(frontmatter)
  const inheritGenres = frontmatter.has('hereda_generos')
    ? frontmatter.get('hereda_generos') : true

  if (
    frontmatter.get('inkforge') !== '1' ||
    frontmatter.get('tipo') !== 'libro' ||
    typeof title !== 'string' ||
    !Number.isInteger(number) ||
    number < 1 ||
    number > 99 ||
    String(number) !== rawNumber || genres === null || typeof inheritGenres !== 'boolean'
  ) {
    return null
  }

  return { title, number, genres, inheritGenres }
}

function replaceFrontmatterTitle(content, previousTitle, title) {
  const bomLength = content.startsWith('\uFEFF') ? 1 : 0
  const source = content.slice(bomLength)
  let lineStart = 0
  let lineNumber = 0
  let foundClosingDelimiter = false
  let closingNewlineIndex = -1
  const titleLines = []

  while (lineStart <= source.length) {
    const newlineIndex = source.indexOf('\n', lineStart)
    const lineEnd = newlineIndex === -1 ? source.length : newlineIndex
    const contentEnd = lineEnd > lineStart && source[lineEnd - 1] === '\r'
      ? lineEnd - 1
      : lineEnd
    const line = source.slice(lineStart, contentEnd)

    if (lineNumber === 0) {
      if (line !== '---') {
        throw new Error('El manifiesto no tiene un frontmatter controlado.')
      }
    } else if (line === '---') {
      foundClosingDelimiter = true
      closingNewlineIndex = newlineIndex
      break
    } else {
      const separatorIndex = line.indexOf(':')

      if (separatorIndex !== -1 && line.slice(0, separatorIndex).trim() === 'titulo') {
        titleLines.push({
          start: bomLength + lineStart,
          end: bomLength + contentEnd,
        })
      }
    }

    if (newlineIndex === -1) {
      break
    }

    lineStart = newlineIndex + 1
    lineNumber += 1
  }

  if (!foundClosingDelimiter || titleLines.length !== 1) {
    throw new Error('No se pudo identificar una única línea titulo en el manifiesto.')
  }

  const [titleLine] = titleLines
  if (closingNewlineIndex === -1) {
    throw new Error('No se pudo identificar el encabezado principal del manifiesto.')
  }

  const bodyStart = closingNewlineIndex + 1
  const headingMatch = /^(?:\r?\n)?# ([^\r\n]*)(?=\r?\n|$)/u.exec(source.slice(bodyStart))
  if (!headingMatch || headingMatch[1] !== previousTitle) {
    throw new Error('El encabezado principal del manifiesto ya no coincide con el título anterior.')
  }
  const headingStart = bomLength + bodyStart + headingMatch[0].indexOf('#')
  const headingEnd = headingStart + 2 + previousTitle.length

  return (
    content.slice(0, titleLine.start) +
    'titulo: ' + JSON.stringify(title) +
    content.slice(titleLine.end, headingStart) +
    '# ' + title +
    content.slice(headingEnd)
  )
}

function replaceFrontmatterFields(content, fields) {
  const bomLength = content.startsWith('\uFEFF') ? 1 : 0
  const source = content.slice(bomLength)
  if (!source.startsWith('---\n') && !source.startsWith('---\r\n')) {
    throw new Error('El manifiesto no tiene un frontmatter controlado.')
  }
  const firstNewline = source.indexOf('\n')
  const closingStart = source.indexOf('\n---', firstNewline + 1)
  if (closingStart < 0 || !/^\n---(?:\r?\n|$)/u.test(source.slice(closingStart))) {
    throw new Error('El manifiesto no tiene un frontmatter cerrado.')
  }
  const newline = source.slice(0, firstNewline + 1).endsWith('\r\n') ? '\r\n' : '\n'
  const frontmatterStart = firstNewline + 1
  const frontmatterEnd = source[closingStart - 1] === '\r' ? closingStart - 1 : closingStart
  let frontmatter = source.slice(frontmatterStart, frontmatterEnd)
  for (const [key, value] of Object.entries(fields)) {
    const lines = frontmatter.split(/(?<=\n)/u)
    const matching = lines.map((line, index) => ({ line, index })).filter(({ line }) =>
      line.indexOf(':') !== -1 && line.slice(0, line.indexOf(':')).trim() === key)
    if (matching.length > 1) throw new Error('El manifiesto contiene metadatos duplicados: ' + key)
    if (matching.length === 1) {
      const { line, index } = matching[0]
      const ending = line.endsWith('\r\n') ? '\r\n' : line.endsWith('\n') ? '\n' : ''
      lines[index] = key + ': ' + value + ending
      frontmatter = lines.join('')
    } else {
      frontmatter += newline + key + ': ' + value
    }
  }
  return content.slice(0, bomLength + frontmatterStart) + frontmatter + content.slice(bomLength + frontmatterEnd)
}

function projectManifest(title, type, genres = []) {
  return [
    '---',
    'inkforge: 1',
    'tipo: ' + type,
    'titulo: ' + JSON.stringify(title),
    'generos: ' + JSON.stringify(genres),
    '---',
    '',
    '# ' + title,
    '',
  ].join('\n')
}

function bookManifest(title, number, inheritGenres = true, genres = []) {
  return [
    '---',
    'inkforge: 1',
    'tipo: libro',
    'titulo: ' + JSON.stringify(title),
    'numero: ' + number,
    'hereda_generos: ' + inheritGenres,
    'generos: ' + JSON.stringify(genres),
    '---',
    '',
    '# ' + title,
    '',
  ].join('\n')
}

function titledDocument(title) {
  return '# ' + title + '\n'
}

function formatBookDirectoryName(number, title) {
  return String(number).padStart(2, '0') + ' - ' + title
}

async function writeDocument(filePath, content) {
  await fs.writeFile(filePath, content, { encoding: 'utf8', flag: 'wx' })
}

async function createDirectories(rootPath, directories) {
  for (const segments of directories) {
    await fs.mkdir(path.join(rootPath, ...segments))
  }
}

async function ensurePathDoesNotExist(targetPath, collisionMessage) {
  try {
    await fs.lstat(targetPath)
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return
    }

    throw error
  }

  throw new Error(collisionMessage)
}

async function readSafeManifest(filePath) {
  const stats = await fs.lstat(filePath)

  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new Error('El manifiesto no es un archivo seguro.')
  }

  const fileHandle = await fs.open(filePath, 'r')
  try {
    const openedStats = await fileHandle.stat()
    if (!openedStats.isFile() || stats.dev !== openedStats.dev || stats.ino !== openedStats.ino) {
      throw new Error('El manifiesto cambió de archivo durante la lectura.')
    }
    return await fileHandle.readFile('utf8')
  } finally {
    await fileHandle.close()
  }
}

async function rewriteExistingDocument(filePath, originalContent, nextContent) {
  const stats = await fs.lstat(filePath)

  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new Error('El manifiesto no es un archivo seguro.')
  }

  const fileHandle = await fs.open(filePath, 'r+')

  try {
    const openedStats = await fileHandle.stat()
    if (!openedStats.isFile() || stats.dev !== openedStats.dev || stats.ino !== openedStats.ino) {
      throw new Error('El manifiesto cambió de archivo durante la escritura.')
    }
    const currentContent = await fileHandle.readFile('utf8')

    if (currentContent !== originalContent) {
      throw new Error('El manifiesto cambió externamente durante la operación.')
    }

    const encodedContent = Buffer.from(nextContent, 'utf8')
    await fileHandle.write(encodedContent, 0, encodedContent.byteLength, 0)
    await fileHandle.truncate(encodedContent.byteLength)
    await fileHandle.sync()
  } finally {
    await fileHandle.close()
  }
}

async function createBookStructure(booksRoot, title, number, inheritGenres = true, genres = []) {
  const directoryName = formatBookDirectoryName(number, title)
  const bookDirectory = path.join(booksRoot, directoryName)
  let directoryCreated = false

  try {
    await fs.mkdir(bookDirectory)
    directoryCreated = true

    await createDirectories(bookDirectory, [
      ['Capítulos'],
      ['Planificación'],
      ['Canon'],
      ['Notas'],
      ['Recursos'],
    ])

    for (const [fileName, heading] of PLANNING_DOCUMENTS) {
      await writeDocument(
        path.join(bookDirectory, 'Planificación', fileName),
        titledDocument(heading),
      )
    }

    await writeDocument(
      path.join(bookDirectory, 'Canon', 'Canon de libro.md'),
      titledDocument('Canon de libro'),
    )
    await writeDocument(
      path.join(bookDirectory, 'Libro.md'),
      bookManifest(title, number, inheritGenres, genres),
    )
  } catch (error) {
    if (!directoryCreated && error?.code === 'EEXIST') {
      throw new Error('Ya existe un libro con ese número y título.')
    }

    if (directoryCreated) {
      try {
        await fs.rm(bookDirectory, { recursive: true, force: true })
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], 'La creación del libro falló y no se pudo retirar la carpeta incompleta.', { cause: error })
      }
    }

    throw error
  }

  return {
    id: directoryName,
    title,
    number,
    directoryPath: bookDirectory,
  }
}

function createProjectLibrary(libraryRoot) {
  const projectsRoot = path.join(libraryRoot, 'Proyectos')

  async function readDirectoryIfPresent(directoryPath) {
    try {
      return await fs.readdir(directoryPath, { withFileTypes: true })
    } catch (error) {
      if (error?.code === 'ENOENT') return []
      throw error
    }
  }

  async function resolveProjectsRoot(createIfMissing = false) {
    let projectsStats

    try {
      projectsStats = await fs.lstat(projectsRoot)
    } catch (error) {
      if (error?.code !== 'ENOENT' || !createIfMissing) {
        if (error?.code === 'ENOENT') {
          return null
        }

        throw error
      }

      try {
        await fs.mkdir(projectsRoot)
      } catch (mkdirError) {
        if (mkdirError?.code !== 'EEXIST') {
          throw mkdirError
        }
      }

      projectsStats = await fs.lstat(projectsRoot)
    }

    if (!projectsStats.isDirectory() || projectsStats.isSymbolicLink()) {
      throw new Error('La carpeta de proyectos no es un directorio seguro.')
    }

    const realLibraryRoot = await fs.realpath(libraryRoot)
    const realProjectsRoot = await fs.realpath(projectsRoot)

    if (!isPathInside(realLibraryRoot, realProjectsRoot)) {
      throw new Error('La carpeta de proyectos está fuera del vault.')
    }

    return realProjectsRoot
  }

  async function resolveGenresRoot() {
    const genresRoot = path.join(libraryRoot, GENRE_DIRECTORY_NAME)
    let stats
    try { stats = await fs.lstat(genresRoot) } catch (error) {
      if (error?.code === 'ENOENT') return null
      throw error
    }
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new Error('La carpeta de géneros no es un directorio seguro.')
    }
    const realLibraryRoot = await fs.realpath(libraryRoot)
    const realGenresRoot = await fs.realpath(genresRoot)
    if (path.relative(realLibraryRoot, realGenresRoot) !== GENRE_DIRECTORY_NAME) {
      throw new Error('La carpeta de géneros no coincide con la ruta global esperada.')
    }
    return realGenresRoot
  }

  async function listGenreProfiles() {
    const genresRoot = await resolveGenresRoot()
    if (!genresRoot) return []
    const entries = await fs.readdir(genresRoot, { withFileTypes: true })
    const profiles = []
    const seen = new Set()
    for (const entry of entries) {
      if (!entry.isFile() || entry.isSymbolicLink() ||
          entry.name.startsWith('.') || !entry.name.endsWith('.md')) continue
      const name = entry.name.slice(0, -3)
      try {
        if (validateGenreName(name) !== name) continue
      } catch { continue }
      const filePath = path.join(genresRoot, entry.name)
      const stats = await fs.lstat(filePath)
      if (!stats.isFile() || stats.isSymbolicLink()) continue
      if (!isPathInside(genresRoot, await fs.realpath(filePath))) continue
      const key = name.normalize('NFC').toLocaleLowerCase('es')
      if (seen.has(key)) throw new Error('Hay perfiles de género con nombres incompatibles por mayúsculas.')
      seen.add(key)
      profiles.push({ name })
    }
    return profiles.sort((left, right) =>
      left.name.localeCompare(right.name, 'es', { sensitivity: 'base' }) ||
      left.name.localeCompare(right.name, 'es'))
  }

  async function listProjects() {
    const realProjectsRoot = await resolveProjectsRoot(false)

    if (!realProjectsRoot) {
      return []
    }

    const entries = await readDirectoryIfPresent(realProjectsRoot)
    const projects = []

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) {
        continue
      }

      try {
        const directoryPath = path.join(realProjectsRoot, entry.name)
        const realDirectoryPath = await fs.realpath(directoryPath)

        if (!isPathInside(realProjectsRoot, realDirectoryPath)) {
          continue
        }

        const manifestPath = path.join(realDirectoryPath, 'Proyecto.md')
        const manifestStats = await fs.lstat(manifestPath)

        if (!manifestStats.isFile() || manifestStats.isSymbolicLink()) {
          continue
        }

        const manifest = parseProjectManifest(await readSafeManifest(manifestPath))

        if (!manifest || manifest.title !== entry.name) {
          continue
        }

        try {
          validateNarrativeTitle(manifest.title, 'El título')
        } catch {
          continue
        }

        projects.push({
          id: entry.name,
          title: manifest.title,
          type: manifest.type,
          directoryPath: realDirectoryPath,
        })
      } catch {
        continue
      }
    }

    return projects.sort((left, right) => (
      left.title.localeCompare(right.title, 'es', { sensitivity: 'base' })
    ))
  }

  async function getProject(projectId) {
    if (typeof projectId !== 'string' || projectId.length === 0) {
      return null
    }

    const projects = await listProjects()
    return projects.find((project) => project.id === projectId) ?? null
  }

  async function resolveBooksRoot(project, createIfMissing = false) {
    const booksRoot = path.join(project.directoryPath, 'Libros')
    let booksStats

    try {
      booksStats = await fs.lstat(booksRoot)
    } catch (error) {
      if (error?.code !== 'ENOENT' || !createIfMissing) {
        if (error?.code === 'ENOENT') {
          return null
        }

        throw error
      }

      await fs.mkdir(booksRoot)
      booksStats = await fs.lstat(booksRoot)
    }

    if (!booksStats.isDirectory() || booksStats.isSymbolicLink()) {
      throw new Error('La carpeta de libros no es un directorio seguro.')
    }

    const realBooksRoot = await fs.realpath(booksRoot)

    if (!isPathInside(project.directoryPath, realBooksRoot)) {
      throw new Error('La carpeta de libros está fuera de la saga.')
    }

    return realBooksRoot
  }

  async function listBooks(project) {
    if (!project || project.type !== 'saga') {
      return []
    }

    const currentProject = await getProject(project.id)

    if (!currentProject || currentProject.type !== 'saga') {
      return []
    }

    const realBooksRoot = await resolveBooksRoot(currentProject, false)

    if (!realBooksRoot) {
      return []
    }

    const entries = await readDirectoryIfPresent(realBooksRoot)
    const books = []

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) {
        continue
      }

      const directoryMatch = BOOK_DIRECTORY_PATTERN.exec(entry.name)

      if (!directoryMatch) {
        continue
      }

      try {
        const folderNumber = Number(directoryMatch[1])
        const folderTitle = directoryMatch[2]
        validateNarrativeTitle(folderTitle, 'El título del libro')

        if (folderNumber < 1 || folderNumber > 99) {
          continue
        }

        const directoryPath = path.join(realBooksRoot, entry.name)
        const realDirectoryPath = await fs.realpath(directoryPath)

        if (!isPathInside(realBooksRoot, realDirectoryPath)) {
          continue
        }

        const manifestPath = path.join(realDirectoryPath, 'Libro.md')
        const manifestStats = await fs.lstat(manifestPath)

        if (!manifestStats.isFile() || manifestStats.isSymbolicLink()) {
          continue
        }

        const manifest = parseBookManifest(await readSafeManifest(manifestPath))

        if (
          !manifest ||
          manifest.number !== folderNumber ||
          manifest.title !== folderTitle
        ) {
          continue
        }

        books.push({
          id: entry.name,
          title: manifest.title,
          number: manifest.number,
          directoryPath: realDirectoryPath,
        })
      } catch {
        continue
      }
    }

    return books.sort((left, right) => (
      left.number - right.number ||
      left.title.localeCompare(right.title, 'es', { sensitivity: 'base' })
    ))
  }

  async function getBook(project, bookId) {
    if (typeof bookId !== 'string' || bookId.length === 0) {
      return null
    }

    const books = await listBooks(project)
    return books.find((book) => book.id === bookId) ?? null
  }

  async function findNextBookNumber(booksRoot) {
    const entries = await fs.readdir(booksRoot, { withFileTypes: true })
    let highestNumber = 0

    for (const entry of entries) {
      const match = BOOK_DIRECTORY_PATTERN.exec(entry.name)

      if (match) {
        highestNumber = Math.max(highestNumber, Number(match[1]))
      }
    }

    if (highestNumber >= 99) {
      throw new Error('La saga ya alcanzó el máximo de 99 libros.')
    }

    return highestNumber + 1
  }

  async function getGenreConfiguration(project, bookId = null) {
    const currentProject = await getProject(project?.id)
    if (!currentProject) throw new Error('La obra activa ya no está disponible.')
    const projectContent = await readSafeManifest(path.join(currentProject.directoryPath, 'Proyecto.md'))
    const projectManifestData = parseProjectManifest(projectContent)
    if (!projectManifestData || projectManifestData.title !== currentProject.title ||
        projectManifestData.type !== currentProject.type) {
      throw new Error('Proyecto.md ya no coincide con la obra activa.')
    }
    const projectGenres = projectManifestData.genres
    if (currentProject.type !== 'saga' || bookId === null) {
      return {
        projectGenres,
        bookGenres: null,
        inheritProjectGenres: null,
        effectiveGenres: projectGenres,
      }
    }
    const book = await getBook(currentProject, bookId)
    if (!book) throw new Error('El libro activo ya no está disponible.')
    const bookContent = await readSafeManifest(path.join(book.directoryPath, 'Libro.md'))
    const bookManifestData = parseBookManifest(bookContent)
    if (!bookManifestData || bookManifestData.title !== book.title ||
        bookManifestData.number !== book.number) {
      throw new Error('Libro.md ya no coincide con el libro activo.')
    }
    const bookGenres = bookManifestData.genres
    const inheritProjectGenres = bookManifestData.inheritGenres
    const effectiveGenres = inheritProjectGenres
      ? normalizeGenres([...projectGenres, ...bookGenres])
      : bookGenres
    return { projectGenres, bookGenres, inheritProjectGenres, effectiveGenres }
  }

  async function updateProjectGenres(project, value, expectedValue) {
    const genres = normalizeGenres(value)
    const expectedGenres = normalizeGenres(expectedValue)
    const currentProject = await getProject(project?.id)
    if (!currentProject) throw new Error('La obra activa ya no está disponible.')
    const manifestPath = path.join(currentProject.directoryPath, 'Proyecto.md')
    const originalContent = await readSafeManifest(manifestPath)
    const manifest = parseProjectManifest(originalContent)
    if (!manifest || manifest.title !== currentProject.title ||
        manifest.type !== currentProject.type) {
      throw new Error('Proyecto.md ya no coincide con la obra activa.')
    }
    if (JSON.stringify(manifest.genres) !== JSON.stringify(expectedGenres)) {
      throw new Error('Los géneros de la obra cambiaron externamente. Vuelve a abrir el diálogo.')
    }
    const nextContent = replaceFrontmatterFields(originalContent, {
      generos: JSON.stringify(genres),
    })
    if (nextContent !== originalContent) {
      await rewriteExistingDocument(manifestPath, originalContent, nextContent)
    }
    return genres
  }

  async function updateBookGenres(project, bookId, inheritGenres, value, expectedInheritGenres, expectedValue) {
    if (typeof inheritGenres !== 'boolean') {
      throw new Error('La herencia de géneros debe ser true o false.')
    }
    const genres = normalizeGenres(value)
    const expectedGenres = normalizeGenres(expectedValue)
    if (typeof expectedInheritGenres !== 'boolean') throw new Error('Falta la herencia esperada.')
    const currentProject = await getProject(project?.id)
    if (!currentProject || currentProject.type !== 'saga') {
      throw new Error('La saga activa ya no está disponible.')
    }
    const book = await getBook(currentProject, bookId)
    if (!book) throw new Error('El libro activo ya no está disponible.')
    const manifestPath = path.join(book.directoryPath, 'Libro.md')
    const originalContent = await readSafeManifest(manifestPath)
    const manifest = parseBookManifest(originalContent)
    if (!manifest || manifest.title !== book.title || manifest.number !== book.number) {
      throw new Error('Libro.md ya no coincide con el libro activo.')
    }
    if (manifest.inheritGenres !== expectedInheritGenres ||
        JSON.stringify(manifest.genres) !== JSON.stringify(expectedGenres)) {
      throw new Error('Los géneros del libro cambiaron externamente. Vuelve a abrir el diálogo.')
    }
    const nextContent = replaceFrontmatterFields(originalContent, {
      hereda_generos: String(inheritGenres),
      generos: JSON.stringify(genres),
    })
    if (nextContent !== originalContent) {
      await rewriteExistingDocument(manifestPath, originalContent, nextContent)
    }
    return { inheritGenres, genres }
  }

  async function createProject(input) {
    if (!input || typeof input !== 'object') {
      throw new Error('Los datos de la obra no son válidos.')
    }

    if (input.type !== 'novela' && input.type !== 'saga') {
      throw new Error('Selecciona un tipo de obra válido.')
    }

    const title = input.type === 'novela'
      ? validateNarrativeTitle(input.bookTitle, 'El título del libro')
      : validateNarrativeTitle(input.sagaTitle, 'El título de la saga')
    const firstBookTitle = input.type === 'saga'
      ? validateNarrativeTitle(input.firstBookTitle, 'El título del primer libro')
      : null
    const genres = normalizeGenres(input.genres ?? [])
    const realProjectsRoot = await resolveProjectsRoot(true)
    const projectDirectory = path.join(realProjectsRoot, title)
    let projectDirectoryCreated = false
    let createdBook = null

    try {
      await fs.mkdir(projectDirectory)
      projectDirectoryCreated = true

      if (input.type === 'novela') {
        await createDirectories(projectDirectory, [
          ['Mundo'],
          ['Estilo'],
          ['Referencias'],
          ['Capítulos'],
          ['Planificación'],
          ['Canon'],
          ['Notas'],
          ['Recursos'],
        ])

        for (const [fileName, heading] of PLANNING_DOCUMENTS) {
          await writeDocument(
            path.join(projectDirectory, 'Planificación', fileName),
            titledDocument(heading),
          )
        }

        await writeDocument(
          path.join(projectDirectory, 'Canon', 'Canon de libro.md'),
          titledDocument('Canon de libro'),
        )
      } else {
        await createDirectories(projectDirectory, [
          ['Mundo'],
          ['Estilo'],
          ['Referencias'],
          ['Libros'],
        ])

        createdBook = await createBookStructure(
          path.join(projectDirectory, 'Libros'),
          firstBookTitle,
          1,
          true,
          [],
        )
      }

      await writeDocument(
        path.join(projectDirectory, 'Proyecto.md'),
        projectManifest(title, input.type, genres),
      )
      const createdProject = await getProject(title)
      if (!createdProject) throw new Error('La obra se creó, pero no pudo validarse.')
      return {
        project: createdProject,
        createdBook,
      }
    } catch (error) {
      if (!projectDirectoryCreated && error?.code === 'EEXIST') {
        throw new Error('Ya existe una obra llamada "' + title + '".')
      }

      if (projectDirectoryCreated) {
        try {
          await fs.rm(projectDirectory, { recursive: true, force: true })
        } catch (rollbackError) {
          throw new AggregateError([error, rollbackError], 'La creación falló y no se pudo retirar la obra incompleta.', { cause: error })
        }
      }

      throw error
  }
  }

  async function createBook(project, input) {
    const currentProject = await getProject(project?.id)

    if (!currentProject || currentProject.type !== 'saga') {
      throw new Error('Solo se pueden añadir libros a una saga activa válida.')
    }

    if (!input || typeof input !== 'object') {
      throw new Error('Los datos del libro no son válidos.')
    }

    const title = validateNarrativeTitle(input.bookTitle, 'El título del libro')
    const genres = normalizeGenres(input.genres ?? [])
    const inheritGenres = input.inheritGenres ?? true
    if (typeof inheritGenres !== 'boolean') throw new Error('La herencia de géneros no es válida.')
    const booksRoot = await resolveBooksRoot(currentProject, true)
    const number = await findNextBookNumber(booksRoot)

    return createBookStructure(booksRoot, title, number, inheritGenres, genres)
  }

  async function renameProject(project, nextTitleValue) {
    const currentProject = await getProject(project?.id)

    if (!currentProject) {
      throw new Error('La obra activa ya no está disponible o no es válida.')
    }

    const label = currentProject.type === 'saga'
      ? 'El título de la saga'
      : 'El título del libro'
    const nextTitle = validateNarrativeTitle(nextTitleValue, label)

    if (nextTitle === currentProject.title) {
      return currentProject
    }

    const realProjectsRoot = await resolveProjectsRoot(false)
    const destinationPath = path.join(realProjectsRoot, nextTitle)
    await ensurePathDoesNotExist(
      destinationPath,
      'Ya existe una obra llamada "' + nextTitle + '".',
    )

    const manifestPath = path.join(currentProject.directoryPath, 'Proyecto.md')
    const originalContent = await readSafeManifest(manifestPath)
    const manifest = parseProjectManifest(originalContent)

    if (
      !manifest ||
      manifest.title !== currentProject.title ||
      manifest.type !== currentProject.type
    ) {
      throw new Error('Proyecto.md ya no coincide con la obra activa.')
    }

    const nextContent = replaceFrontmatterTitle(originalContent, manifest.title, nextTitle)
    await fs.rename(currentProject.directoryPath, destinationPath)

    try {
      await rewriteExistingDocument(
        path.join(destinationPath, 'Proyecto.md'),
        originalContent,
        nextContent,
      )
    } catch (error) {
      try {
        await fs.rename(destinationPath, currentProject.directoryPath)
      } catch {
        // Preserve the manifest update error.
      }

      throw error
    }

    return {
      id: nextTitle,
      title: nextTitle,
      type: currentProject.type,
      directoryPath: await fs.realpath(destinationPath),
    }
  }

  async function renameBook(project, bookId, nextTitleValue) {
    const currentProject = await getProject(project?.id)

    if (!currentProject || currentProject.type !== 'saga') {
      throw new Error('La saga activa ya no está disponible o no es válida.')
    }

    const currentBook = await getBook(currentProject, bookId)

    if (!currentBook) {
      throw new Error('El libro activo ya no está disponible o no es válido.')
    }

    const nextTitle = validateNarrativeTitle(nextTitleValue, 'El título del libro')

    if (nextTitle === currentBook.title) {
      return currentBook
    }

    const booksRoot = path.dirname(currentBook.directoryPath)
    const nextId = formatBookDirectoryName(currentBook.number, nextTitle)
    const destinationPath = path.join(booksRoot, nextId)
    await ensurePathDoesNotExist(
      destinationPath,
      'Ya existe un libro llamado "' + nextTitle + '" con ese número.',
    )

    const manifestPath = path.join(currentBook.directoryPath, 'Libro.md')
    const originalContent = await readSafeManifest(manifestPath)
    const manifest = parseBookManifest(originalContent)

    if (
      !manifest ||
      manifest.title !== currentBook.title ||
      manifest.number !== currentBook.number
    ) {
      throw new Error('Libro.md ya no coincide con el libro activo.')
    }

    const nextContent = replaceFrontmatterTitle(originalContent, manifest.title, nextTitle)
    await fs.rename(currentBook.directoryPath, destinationPath)

    try {
      await rewriteExistingDocument(
        path.join(destinationPath, 'Libro.md'),
        originalContent,
        nextContent,
      )
    } catch (error) {
      try {
        await fs.rename(destinationPath, currentBook.directoryPath)
      } catch {
        // Preserve the manifest update error.
      }

      throw error
    }

    return {
      id: nextId,
      title: nextTitle,
      number: currentBook.number,
      directoryPath: await fs.realpath(destinationPath),
    }
  }

  return {
    listProjects,
    getProject,
    listBooks,
    getBook,
    listGenreProfiles,
    getGenreConfiguration,
    updateProjectGenres,
    updateBookGenres,
    createProject,
    createBook,
    renameProject,
    renameBook,
  }
}

module.exports = {
  createProjectLibrary,
}
