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

    if (key && value !== null) {
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

  if (
    frontmatter.get('inkforge') !== '1' ||
    (type !== 'novela' && type !== 'saga') ||
    typeof title !== 'string'
  ) {
    return null
  }

  return { type, title }
}

function parseBookManifest(content) {
  const frontmatter = parseFrontmatter(content)

  if (!frontmatter) {
    return null
  }

  const title = frontmatter.get('titulo')
  const rawNumber = frontmatter.get('numero')
  const number = Number(rawNumber)

  if (
    frontmatter.get('inkforge') !== '1' ||
    frontmatter.get('tipo') !== 'libro' ||
    typeof title !== 'string' ||
    !Number.isInteger(number) ||
    number < 1 ||
    number > 99 ||
    String(number) !== rawNumber
  ) {
    return null
  }

  return { title, number }
}

function replaceFrontmatterTitle(content, title) {
  const bomLength = content.startsWith('\uFEFF') ? 1 : 0
  const source = content.slice(bomLength)
  let lineStart = 0
  let lineNumber = 0
  let foundClosingDelimiter = false
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

  return (
    content.slice(0, titleLine.start) +
    'titulo: ' + JSON.stringify(title) +
    content.slice(titleLine.end)
  )
}

function projectManifest(title, type) {
  return [
    '---',
    'inkforge: 1',
    'tipo: ' + type,
    'titulo: ' + JSON.stringify(title),
    '---',
    '',
    '# ' + title,
    '',
  ].join('\n')
}

function bookManifest(title, number) {
  return [
    '---',
    'inkforge: 1',
    'tipo: libro',
    'titulo: ' + JSON.stringify(title),
    'numero: ' + number,
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

  return fs.readFile(filePath, 'utf8')
}

async function rewriteExistingDocument(filePath, originalContent, nextContent) {
  const stats = await fs.lstat(filePath)

  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new Error('El manifiesto no es un archivo seguro.')
  }

  const fileHandle = await fs.open(filePath, 'r+')

  try {
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

async function createBookStructure(booksRoot, title, number) {
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
      bookManifest(title, number),
    )
  } catch (error) {
    if (!directoryCreated && error?.code === 'EEXIST') {
      throw new Error('Ya existe un libro con ese número y título.')
    }

    if (directoryCreated) {
      try {
        await fs.rm(bookDirectory, { recursive: true, force: true })
      } catch {
        // Preserve the original creation error.
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

        const manifest = parseProjectManifest(await fs.readFile(manifestPath, 'utf8'))

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

        const manifest = parseBookManifest(await fs.readFile(manifestPath, 'utf8'))

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
    const realProjectsRoot = await resolveProjectsRoot(true)
    const projectDirectory = path.join(realProjectsRoot, title)
    let projectDirectoryCreated = false

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

        await createBookStructure(
          path.join(projectDirectory, 'Libros'),
          firstBookTitle,
          1,
        )
      }

      await writeDocument(
        path.join(projectDirectory, 'Proyecto.md'),
        projectManifest(title, input.type),
      )
    } catch (error) {
      if (!projectDirectoryCreated && error?.code === 'EEXIST') {
        throw new Error('Ya existe una obra llamada "' + title + '".')
      }

      if (projectDirectoryCreated) {
        try {
          await fs.rm(projectDirectory, { recursive: true, force: true })
        } catch {
          // Preserve the original creation error.
        }
      }

      throw error
    }

    const createdProject = await getProject(title)

    if (!createdProject) {
      throw new Error('La obra se creó, pero no pudo validarse.')
    }

    return createdProject
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
    const booksRoot = await resolveBooksRoot(currentProject, true)
    const number = await findNextBookNumber(booksRoot)

    return createBookStructure(booksRoot, title, number)
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

    const nextContent = replaceFrontmatterTitle(originalContent, nextTitle)
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

    const nextContent = replaceFrontmatterTitle(originalContent, nextTitle)
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
    createProject,
    createBook,
    renameProject,
    renameBook,
  }
}

module.exports = {
  createProjectLibrary,
}
