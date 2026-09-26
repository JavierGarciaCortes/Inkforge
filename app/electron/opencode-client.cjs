const path = require('node:path')
const fs = require('node:fs/promises')
const { spawn } = require('node:child_process')

const START_TIMEOUT_MS = 15000
const REQUEST_TIMEOUT_MS = 15000
const EVENT_RECONNECT_DELAY_MS = 1000
const MAX_SEEN_EVENT_IDS = 5000

class OpenCodeError extends Error {
  constructor(code, message, options = {}) {
    super(message)
    this.name = 'OpenCodeError'
    this.code = code
    this.httpStatus = options.httpStatus
    this.retryable = options.retryable ?? false
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function compactText(value, fallback = '') {
  if (typeof value === 'string') {
    return value.slice(0, 500)
  }

  if (isRecord(value)) {
    for (const key of ['message', 'error', 'detail', 'name']) {
      if (typeof value[key] === 'string') {
        return value[key].slice(0, 500)
      }
    }

    try {
      return JSON.stringify(value).slice(0, 500)
    } catch {
      return fallback
    }
  }

  return fallback
}

function classifyHttpError(status, payload) {
  const technicalMessage = compactText(payload).toLowerCase()

  if (status === 401 || status === 403 || technicalMessage.includes('credential')) {
    return new OpenCodeError(
      'invalid_credential',
      'El proveedor rechazó sus credenciales. Revisa la conexión del proveedor en OpenCode.',
      { httpStatus: status },
    )
  }

  if (status === 402 || status === 429 || technicalMessage.includes('quota') || technicalMessage.includes('limit')) {
    return new OpenCodeError(
      'quota',
      'El modelo o proveedor alcanzó su límite o cuota.',
      { httpStatus: status, retryable: true },
    )
  }

  if (status === 404 && technicalMessage.includes('session')) {
    return new OpenCodeError(
      'session_missing',
      'La sesión de OpenCode ya no está disponible.',
      { httpStatus: status, retryable: true },
    )
  }

  if (
    technicalMessage.includes('model') ||
    technicalMessage.includes('provider') ||
    technicalMessage.includes('upstream')
  ) {
    return new OpenCodeError(
      'model_unavailable',
      'El modelo o proveedor seleccionado no está disponible.',
      { httpStatus: status, retryable: true },
    )
  }

  return new OpenCodeError(
    status === 404 || status === 405 ? 'incompatible' : 'unknown',
    status === 404 || status === 405
      ? 'Esta versión de OpenCode no ofrece una capacidad necesaria.'
      : 'OpenCode devolvió un error inesperado.',
    { httpStatus: status, retryable: status >= 500 },
  )
}

function classifyEmbeddedError(embeddedError, fallbackStatus = 500) {
  const embeddedData = isRecord(embeddedError) && isRecord(embeddedError.data)
    ? embeddedError.data
    : null
  const internalStatus = typeof embeddedData?.statusCode === 'number'
    ? embeddedData.statusCode
    : isRecord(embeddedError) && typeof embeddedError.statusCode === 'number'
      ? embeddedError.statusCode
      : fallbackStatus

  return classifyHttpError(internalStatus, embeddedData ?? embeddedError)
}

function normalizeError(error) {
  if (error instanceof OpenCodeError) {
    return error
  }

  if (error?.name === 'AbortError') {
    return new OpenCodeError(
      'disconnected',
      'OpenCode tardó demasiado en responder.',
      { retryable: true },
    )
  }

  const code = error?.cause?.code ?? error?.code

  if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'EPIPE') {
    return new OpenCodeError(
      'disconnected',
      'Se perdió la conexión con OpenCode.',
      { retryable: true },
    )
  }

  return new OpenCodeError(
    'unknown',
    'No se pudo completar la operación con OpenCode.',
    { retryable: true },
  )
}

function serializeError(error) {
  const normalized = normalizeError(error)

  return {
    code: normalized.code,
    message: normalized.message,
    retryable: normalized.retryable,
  }
}

function assertIdentifier(value, label) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 200) {
    throw new OpenCodeError('invalid_request', `${label} no es válido.`)
  }

  return value
}

function normalizeAgents(payload) {
  let entries = []

  if (Array.isArray(payload)) {
    entries = payload.map((agent) => [agent?.name ?? agent?.id, agent])
  } else if (isRecord(payload)) {
    const source = isRecord(payload.agent) ? payload.agent : payload
    entries = Object.entries(source)
  }

  return entries
    .filter(([, agent]) => isRecord(agent))
    .map(([key, agent]) => ({
      name: String(agent.name ?? agent.id ?? key),
      description: typeof agent.description === 'string' ? agent.description : '',
      mode: agent.mode === 'primary' ? 'primary' : 'subagent',
    }))
    .filter((agent) => agent.name.length > 0)
    .sort((left, right) => {
      if (left.mode !== right.mode) {
        return left.mode === 'primary' ? -1 : 1
      }

      return left.name.localeCompare(right.name, 'es', { sensitivity: 'base' })
    })
}

function resolveProjectPrimaryAgent(configPayload, availableAgents) {
  const configuredAgents = isRecord(configPayload) && isRecord(configPayload.agent)
    ? configPayload.agent
    : {}
  const primaryNames = Object.entries(configuredAgents)
    .filter(([, agent]) => isRecord(agent) && agent.mode === 'primary')
    .map(([name]) => name)

  if (primaryNames.length === 0) {
    throw new OpenCodeError(
      'incompatible',
      'La configuraci\u00f3n del proyecto no define ning\u00fan agente principal.',
    )
  }

  if (primaryNames.length > 1) {
    throw new OpenCodeError(
      'incompatible',
      'La configuraci\u00f3n del proyecto define m\u00e1s de un agente principal.',
    )
  }

  const primaryAgent = availableAgents.find((agent) => agent.name === primaryNames[0])
  if (!primaryAgent) {
    throw new OpenCodeError(
      'incompatible',
      'El agente principal definido por el proyecto no est\u00e1 disponible en OpenCode.',
    )
  }

  return primaryAgent
}

function hasStandaloneFreeToken(value) {
  return /(^|[^a-z0-9])free(?=$|[^a-z0-9])/i.test(value)
}

function normalizeModels(payload) {
  if (!isRecord(payload) || !Array.isArray(payload.connected)) {
    throw new OpenCodeError(
      'incompatible',
      'OpenCode no informó qué proveedores están conectados.',
    )
  }

  const connected = new Set(payload.connected.filter((id) => typeof id === 'string'))
  const providerDefaults = isRecord(payload.default) ? payload.default : {}
  let providerEntries = []

  if (Array.isArray(payload.all)) {
    providerEntries = payload.all.map((provider) => [provider?.id, provider])
  } else if (Array.isArray(payload.providers)) {
    providerEntries = payload.providers.map((provider) => [provider?.id, provider])
  } else if (isRecord(payload.providers)) {
    providerEntries = Object.entries(payload.providers)
  } else if (isRecord(payload.all)) {
    providerEntries = Object.entries(payload.all)
  }

  const models = []

  for (const [providerKey, provider] of providerEntries) {
    if (!isRecord(provider)) {
      continue
    }

    const providerID = String(provider.id ?? providerKey ?? '')

    if (!providerID || !connected.has(providerID)) {
      continue
    }

    const providerName = String(provider.name ?? providerID)
    const modelEntries = Array.isArray(provider.models)
      ? provider.models.map((model) => [model?.id, model])
      : isRecord(provider.models)
        ? Object.entries(provider.models)
        : []

    for (const [modelKey, model] of modelEntries) {
      if (!isRecord(model)) {
        continue
      }

      const modelID = String(model.id ?? modelKey ?? '')

      if (!modelID) {
        continue
      }

      const variants = Array.isArray(model.variants)
        ? model.variants.filter((variant) => typeof variant === 'string')
        : isRecord(model.variants)
          ? Object.keys(model.variants)
          : []

      models.push({
        providerID,
        providerName,
        modelID,
        name: String(model.name ?? modelID),
        variants,
        isProviderDefault: providerDefaults[providerID] === modelID,
        isFree: (
          hasStandaloneFreeToken(String(model.name ?? '')) ||
          hasStandaloneFreeToken(modelID)
        ),
      })
    }
  }

  return models.sort((left, right) => {
    const providerOrder = left.providerName.localeCompare(right.providerName, 'es', { sensitivity: 'base' })
    return providerOrder || left.name.localeCompare(right.name, 'es', { sensitivity: 'base' })
  })
}

function normalizeMessages(payload) {
  if (!Array.isArray(payload)) {
    return []
  }

  return payload.flatMap((entry) => {
    if (!isRecord(entry) || !isRecord(entry.info) || !Array.isArray(entry.parts)) {
      return []
    }

    const role = entry.info.role === 'assistant' ? 'assistant' : entry.info.role === 'user' ? 'user' : null

    if (!role) {
      return []
    }

    const text = entry.parts
      .filter((part) => (
        isRecord(part) &&
        part.type === 'text' &&
        part.synthetic !== true &&
        part.ignored !== true &&
        typeof part.text === 'string'
      ))
      .map((part) => part.text)
      .join('')

    if (!text) {
      return []
    }

    return [{
      id: String(entry.info.id ?? `${role}-${entry.info.time?.created ?? Date.now()}`),
      role,
      text,
    }]
  })
}

function normalizeServerEvent(payload, messageRoles, visibleParts) {
  if (!isRecord(payload) || typeof payload.type !== 'string') {
    return null
  }

  const properties = isRecord(payload.properties) ? payload.properties : {}
  const event = {
    id: typeof payload.id === 'string' ? payload.id : undefined,
    type: payload.type,
    sessionID: typeof properties.sessionID === 'string' ? properties.sessionID : undefined,
  }

  if (payload.type === 'session.next.text.delta') {
    const messageID = typeof properties.assistantMessageID === 'string'
      ? properties.assistantMessageID
      : undefined
    const partID = typeof properties.partID === 'string' ? properties.partID : undefined

    if (
      !event.sessionID || !messageID || !partID ||
      messageRoles.get(event.sessionID)?.get(messageID) !== 'assistant' ||
      visibleParts.get(event.sessionID)?.get(messageID)?.get(partID) !== true
    ) {
      return null
    }

    return {
      ...event,
      assistantMessageID: messageID,
      partID,
      delta: typeof properties.delta === 'string' ? properties.delta : '',
    }
  }

  if (payload.type === 'message.part.delta') {
    const messageID = typeof properties.messageID === 'string' ? properties.messageID : undefined
    const partID = typeof properties.partID === 'string' ? properties.partID : undefined
    const messageRole = event.sessionID && messageID
      ? messageRoles.get(event.sessionID)?.get(messageID)
      : undefined

    if (
      properties.field !== 'text' || messageRole !== 'assistant' || !partID ||
      visibleParts.get(event.sessionID)?.get(messageID)?.get(partID) !== true
    ) {
      return null
    }

    return {
      ...event,
      type: 'session.next.text.delta',
      assistantMessageID: messageID,
      partID,
      delta: typeof properties.delta === 'string' ? properties.delta : '',
    }
  }

  if (payload.type === 'message.part.updated') {
    const part = isRecord(properties.part) ? properties.part : null

    if (!part) {
      return null
    }

    const sessionID = event.sessionID ?? (
      typeof part.sessionID === 'string' ? part.sessionID : undefined
    )
    const messageID = typeof part.messageID === 'string' ? part.messageID : undefined
    const partID = typeof part.id === 'string' ? part.id : undefined
    const visible = (
      part.type === 'text' &&
      part.synthetic !== true &&
      part.ignored !== true &&
      typeof part.text === 'string'
    )

    if (sessionID && messageID && partID) {
      const sessionParts = visibleParts.get(sessionID) ?? new Map()
      const messageParts = sessionParts.get(messageID) ?? new Map()
      messageParts.set(partID, visible)
      sessionParts.set(messageID, messageParts)
      visibleParts.set(sessionID, sessionParts)
    }

    const messageRole = sessionID && messageID
      ? messageRoles.get(sessionID)?.get(messageID)
      : undefined

    if (!visible || !partID || messageRole !== 'assistant') {
      return null
    }

    return {
      ...event,
      type: 'session.next.text.updated',
      sessionID,
      assistantMessageID: messageID,
      partID,
      text: part.text,
    }
  }

  if (payload.type === 'message.updated') {
    const info = isRecord(properties.info) ? properties.info : null
    const sessionID = event.sessionID ?? (
      typeof info?.sessionID === 'string' ? info.sessionID : undefined
    )
    const messageID = typeof info?.id === 'string' ? info.id : undefined
    const messageRole = info?.role === 'user' || info?.role === 'assistant'
      ? info.role
      : undefined

    if (sessionID && messageID && messageRole) {
      const sessionRoles = messageRoles.get(sessionID) ?? new Map()
      sessionRoles.set(messageID, messageRole)
      messageRoles.set(sessionID, sessionRoles)
    }

    return {
      ...event,
      sessionID,
      messageID,
      messageRole,
      ...(messageRole === 'assistant' && info?.error
        ? { error: serializeError(classifyEmbeddedError(info.error)) }
        : {}),
    }
  }

  if (payload.type === 'session.idle' && event.sessionID) {
    messageRoles.delete(event.sessionID)
    visibleParts.delete(event.sessionID)
  }

  if (payload.type === 'permission.v2.asked') {
    return {
      ...event,
      permission: {
        id: String(properties.id ?? ''),
        sessionID: String(properties.sessionID ?? ''),
        action: typeof properties.action === 'string' ? properties.action : 'Acción solicitada',
        resources: Array.isArray(properties.resources)
          ? properties.resources.filter((resource) => typeof resource === 'string')
          : [],
      },
    }
  }

  if (payload.type === 'question.v2.asked') {
    const questions = Array.isArray(properties.questions)
      ? properties.questions.filter(isRecord).map((question) => ({
        question: String(question.question ?? ''),
        header: String(question.header ?? 'Pregunta'),
        multiple: question.multiple === true,
        custom: question.custom === true,
        options: Array.isArray(question.options)
          ? question.options.filter(isRecord).map((option) => ({
            label: String(option.label ?? ''),
            description: typeof option.description === 'string' ? option.description : '',
          })).filter((option) => option.label.length > 0)
          : [],
      }))
      : []

    return {
      ...event,
      question: {
        id: String(properties.id ?? ''),
        sessionID: String(properties.sessionID ?? ''),
        questions,
      },
    }
  }

  if (payload.type === 'session.error' || payload.type === 'session.next.step.failed') {
    return {
      ...event,
      error: serializeError(classifyHttpError(500, properties.error ?? properties)),
    }
  }

  return event
}

class OpenCodeClient {
  constructor({ projectRoot, catalogDirectory, workingDirectory = null, validateWorkspace, onStatus, onEvent }) {
    this.infrastructureRoot = path.resolve(projectRoot)
    this.catalogDirectory = path.resolve(catalogDirectory)
    this.workingDirectory = workingDirectory === null ? null : path.resolve(workingDirectory)
    this.validateWorkspace = validateWorkspace
    this.workspaceGeneration = 0
    this.requestedWorkingDirectory = this.workingDirectory
    this.onStatus = onStatus
    this.onEvent = onEvent
    this.child = null
    this.baseUrl = null
    this.startPromise = null
    this.stopping = false
    this.eventAbortController = null
    this.models = []
    this.agents = []
    this.seenEventIDs = new Set()
    this.seenEventQueue = []
    this.messageRoles = new Map()
    this.visibleParts = new Map()
    this.hasConnectedEventStream = false
    this.workspaceChangePromise = Promise.resolve()
    this.workspaceStatusBeforeChange = null
    this.status = {
      state: 'idle',
      message: 'OpenCode todavía no se ha iniciado.',
    }
  }

  getStatus() {
    return { ...this.status }
  }

  setStatus(status) {
    this.status = status
    this.onStatus(this.getStatus())
  }

  async start() {
    await this.ensureConnected()
    return this.getStatus()
  }

  async startCurrentWorkspace() {
    if (this.status.state === 'connected' && this.baseUrl) {
      return this.getStatus()
    }

    if (this.startPromise) {
      return this.startPromise
    }

    this.stopping = false
    this.setStatus({ state: 'starting', message: 'Iniciando OpenCode…' })
    this.startPromise = this.startInternal().finally(() => {
      this.startPromise = null
    })

    return this.startPromise
  }

  setWorkingDirectory(workingDirectory) {
    const nextWorkingDirectory = workingDirectory === null ? null : path.resolve(workingDirectory)
    const previousRequestedDirectory = this.requestedWorkingDirectory
    if (nextWorkingDirectory !== previousRequestedDirectory) this.workspaceGeneration += 1
    this.requestedWorkingDirectory = nextWorkingDirectory
    const previousChange = this.workspaceChangePromise

    if (nextWorkingDirectory !== this.workingDirectory) {
      if (
        previousRequestedDirectory === this.workingDirectory &&
        this.workspaceStatusBeforeChange === null
      ) {
        this.workspaceStatusBeforeChange = this.getStatus()
      }

      this.eventAbortController?.abort()
      this.eventAbortController = null
      this.setStatus({ state: 'starting', message: 'Iniciando OpenCode…' })
    }

    const nextChange = previousChange.catch(() => undefined).then(async () => {
      if (nextWorkingDirectory !== this.requestedWorkingDirectory) {
        return this.getStatus()
      }

      if (nextWorkingDirectory === this.workingDirectory) {
        const previousStatus = this.workspaceStatusBeforeChange
        this.workspaceStatusBeforeChange = null

        if (previousStatus) {
          this.setStatus(previousStatus)

          if (previousStatus.state === 'connected' && this.baseUrl) {
            void this.runEventStream()
          }
        }

        return this.getStatus()
      }

      this.workspaceStatusBeforeChange = null
      this.stopping = true
      await this.terminateManagedProcess()
      await this.startPromise?.catch(() => undefined)
      this.baseUrl = null
      this.models = []
      this.agents = []
      this.messageRoles.clear()
      this.visibleParts.clear()
      this.seenEventIDs.clear()
      this.seenEventQueue = []
      this.hasConnectedEventStream = false
      this.workingDirectory = nextWorkingDirectory
      this.stopping = false
      this.setStatus({ state: 'idle', message: 'OpenCode detenido.' })
      return this.startCurrentWorkspace()
    })

    this.workspaceChangePromise = nextChange
    return nextChange
  }

  async startInternal() {
    try {
      if (this.workingDirectory === null) {
        await fs.mkdir(this.catalogDirectory, { recursive: true })
      }
      this.baseUrl = await this.launchProcess()
      const health = await this.waitForHealth()
      await this.loadCapabilities()
      this.setStatus({
        state: 'connected',
        message: 'OpenCode conectado.',
        version: typeof health.version === 'string' ? health.version : undefined,
      })
      if (this.workingDirectory !== null) void this.runEventStream()
      return this.getStatus()
    } catch (error) {
      const normalized = normalizeError(error)
      this.stopping = true
      await this.terminateManagedProcess()
      this.stopping = false
      this.baseUrl = null
      this.setStatus({
        state: normalized.code === 'not_found'
          ? 'not_found'
          : normalized.code === 'incompatible'
            ? 'incompatible'
            : 'error',
        message: normalized.message,
      })
      throw normalized
    }
  }

  launchProcess() {
    const environment = { ...process.env }
    delete environment.VAULT_PATH
    if (this.workingDirectory !== null) environment.VAULT_PATH = this.workingDirectory
    return new Promise((resolve, reject) => {
      const child = spawn(
        'opencode',
        ['serve', '--hostname', '127.0.0.1', '--port', '0'],
        {
          cwd: this.workingDirectory === null ? this.catalogDirectory : this.infrastructureRoot,
          env: environment,
          shell: process.platform === 'win32',
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      )
      this.child = child
      let output = ''
      let launchSettled = false

      const finishWithError = (error) => {
        if (launchSettled) {
          return
        }

        launchSettled = true
        clearTimeout(timeout)
        reject(error)
      }

      const inspectOutput = (chunk) => {
        output = `${output}${chunk.toString('utf8')}`.slice(-8000)
        const match = output.match(/https?:\/\/127\.0\.0\.1:\d+/i)

        if (!match || launchSettled) {
          return
        }

        const candidate = new URL(match[0])

        if (candidate.protocol !== 'http:' || candidate.hostname !== '127.0.0.1') {
          finishWithError(new OpenCodeError('incompatible', 'OpenCode anunció una dirección no segura.'))
          return
        }

        launchSettled = true
        clearTimeout(timeout)
        resolve(candidate.origin)
      }

      const timeout = setTimeout(() => {
        finishWithError(new OpenCodeError(
          'disconnected',
          'OpenCode no anunció una dirección local válida a tiempo.',
          { retryable: true },
        ))
      }, START_TIMEOUT_MS)

      child.stdout.on('data', inspectOutput)
      child.stderr.on('data', inspectOutput)
      child.once('error', (error) => {
        finishWithError(new OpenCodeError(
          error.code === 'ENOENT' ? 'not_found' : 'unknown',
          error.code === 'ENOENT'
            ? 'No se encontró el ejecutable de OpenCode en el sistema.'
            : 'No se pudo iniciar OpenCode.',
          { retryable: true },
        ))
      })
      child.once('exit', (code) => {
        if (this.child === child) {
          this.child = null
        }

        if (!launchSettled) {
          const missingCommand = /not recognized|no se reconoce|not found/i.test(output)
          finishWithError(new OpenCodeError(
            missingCommand ? 'not_found' : 'disconnected',
            missingCommand
              ? 'No se encontró el ejecutable de OpenCode en el sistema.'
              : `OpenCode terminó antes de estar disponible${code === null ? '.' : ` (código ${code}).`}`,
            { retryable: true },
          ))
          return
        }

        if (!this.stopping) {
          this.baseUrl = null
          this.eventAbortController?.abort()
          this.setStatus({
            state: 'error',
            message: 'El proceso de OpenCode terminó inesperadamente.',
          })
        }
      })
    })
  }

  async waitForHealth() {
    const deadline = Date.now() + START_TIMEOUT_MS
    let lastError = null

    while (Date.now() < deadline && this.child) {
      try {
        const health = await this.fetchJson('/global/health', { timeout: 2500 })

        if (!isRecord(health) || health.healthy !== true) {
          throw new OpenCodeError('incompatible', 'OpenCode respondió, pero no informó un estado saludable.')
        }

        return health
      } catch (error) {
        lastError = error
        await delay(250)
      }
    }

    throw lastError instanceof OpenCodeError
      ? lastError
      : new OpenCodeError('disconnected', 'OpenCode no respondió al control de salud.', { retryable: true })
  }

  withDirectory(endpoint, catalog = false) {
    const directory = catalog ? this.workingDirectory ?? this.catalogDirectory : this.workingDirectory
    if (!directory || (!catalog && this.requestedWorkingDirectory !== directory)) {
      throw new OpenCodeError('invalid_request', 'No hay una obra activa para esta operación.')
    }
    const url = new URL(endpoint, this.baseUrl)
    url.searchParams.set('directory', directory)
    return `${url.pathname}${url.search}`
  }

  async loadCapabilities() {
    if (this.workingDirectory === null) {
      const providers = await this.fetchJson(this.withDirectory('/provider', true))
      this.models = normalizeModels(providers)
      this.agents = []
      return
    }
    let agentPayload
    let providerPayload
    let configPayload

    try {
      ;[agentPayload, providerPayload, configPayload] = await Promise.all([
        this.fetchJson(this.withDirectory('/agent')),
        this.fetchJson(this.withDirectory('/provider')),
        this.fetchJson(this.withDirectory('/config')),
        this.fetchJson(this.withDirectory('/mcp')).catch(() => null),
      ])
    } catch (error) {
      const normalized = normalizeError(error)
      throw new OpenCodeError(
        'incompatible',
        normalized.code === 'disconnected'
          ? normalized.message
          : 'OpenCode no ofrece las capacidades de agentes y proveedores necesarias.',
        { retryable: normalized.retryable },
      )
    }

    const availableAgents = normalizeAgents(agentPayload)
    const primaryAgent = resolveProjectPrimaryAgent(configPayload, availableAgents)
    this.agents = [primaryAgent]
    this.models = normalizeModels(providerPayload)

    if (this.models.length === 0) {
      throw new OpenCodeError(
        'incompatible',
        'OpenCode no devolvió agentes o modelos de proveedores conectados.',
      )
    }
  }

  async fetchJson(endpoint, options = {}) {
    if (!this.baseUrl) {
      throw new OpenCodeError('disconnected', 'OpenCode no está conectado.', { retryable: true })
    }

    const url = new URL(endpoint, this.baseUrl)

    if (url.hostname !== '127.0.0.1' || url.origin !== this.baseUrl) {
      throw new OpenCodeError('invalid_request', 'La solicitud no pertenece al servidor local de OpenCode.')
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeout ?? REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(url, {
        method: options.method ?? 'GET',
        headers: {
          Accept: 'application/json',
          ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        redirect: 'error',
        signal: controller.signal,
      })
      const responseText = response.status === 204 ? '' : await response.text()
      let payload = null

      if (responseText) {
        try {
          payload = JSON.parse(responseText)
        } catch {
          payload = { message: responseText.slice(0, 500) }
        }
      }

      if (!response.ok) {
        throw classifyHttpError(response.status, payload)
      }

      return payload
    } catch (error) {
      throw normalizeError(error)
    } finally {
      clearTimeout(timeout)
    }
  }

  async ensureConnected() {
    while (true) {
      const pendingWorkspaceChange = this.workspaceChangePromise
      await pendingWorkspaceChange.catch(() => undefined)

      if (pendingWorkspaceChange !== this.workspaceChangePromise) {
        continue
      }

      if (this.requestedWorkingDirectory !== this.workingDirectory) {
        continue
      }

      if (this.status.state !== 'connected' || !this.baseUrl) {
        await this.startCurrentWorkspace()
        continue
      }

      return
    }
  }

  async ensureNarrativeConnected(directory) {
    const generation = this.workspaceGeneration
    const assertScope = () => {
      if (
        !directory ||
        directory !== this.requestedWorkingDirectory ||
        generation !== this.workspaceGeneration
      ) {
        throw new OpenCodeError('invalid_request', 'Crea o selecciona una obra para utilizar el Director.')
      }
    }
    assertScope()
    await this.ensureConnected()
    assertScope()
    await this.validateWorkspace(directory)
    assertScope()
    if (this.workingDirectory !== directory) {
      throw new OpenCodeError('invalid_request', 'La obra activa ha cambiado.')
    }
  }

  async listModels() {
    await this.ensureConnected()
    return this.models.map((model) => ({ ...model, variants: [...model.variants] }))
  }

  async listAgents() {
    await this.ensureConnected()
    return this.agents.map((agent) => ({ ...agent }))
  }

  async createSession(input = {}) {
    await this.ensureNarrativeConnected(input.workingDirectory)
    const agent = typeof input.agent === 'string' ? input.agent : undefined

    if (agent && !this.agents.some((candidate) => candidate.name === agent)) {
      throw new OpenCodeError('invalid_request', 'El agente seleccionado no está disponible.')
    }

    const payload = await this.fetchJson(this.withDirectory('/session'), {
      method: 'POST',
      body: {
        title: typeof input.title === 'string' ? input.title.slice(0, 120) : 'Inkforge',
        ...(agent ? { agent } : {}),
      },
    })

    if (!isRecord(payload) || typeof payload.id !== 'string') {
      throw new OpenCodeError('incompatible', 'OpenCode no devolvió una sesión válida.')
    }

    return {
      id: payload.id,
      title: typeof payload.title === 'string' ? payload.title : 'Inkforge',
      agent: typeof payload.agent === 'string' ? payload.agent : agent,
    }
  }

  async getMessages(sessionID, workingDirectory) {
    await this.ensureNarrativeConnected(workingDirectory)
    const safeSessionID = encodeURIComponent(assertIdentifier(sessionID, 'La sesión'))

    try {
      const payload = await this.fetchJson(this.withDirectory(`/session/${safeSessionID}/message`))
      return normalizeMessages(payload)
    } catch (error) {
      const normalized = normalizeError(error)

      if (normalized.httpStatus === 404) {
        throw new OpenCodeError(
          'session_missing',
          'La sesión de OpenCode ya no está disponible.',
          { httpStatus: 404, retryable: true },
        )
      }

      throw normalized
    }
  }

  validateAgent(agent) {
    if (!this.agents.some((candidate) => candidate.name === agent)) {
      throw new OpenCodeError('invalid_request', 'El agente seleccionado no está disponible.')
    }
  }

  validateModel(model) {
    const availableModel = isRecord(model)
      ? this.models.find((candidate) => (
        candidate.providerID === model.providerID && candidate.modelID === model.modelID
      ))
      : null

    if (!availableModel) {
      throw new OpenCodeError('invalid_request', 'El modelo seleccionado no está disponible.')
    }

    if (
      typeof model.variant === 'string' &&
      model.variant.length > 0 &&
      !availableModel.variants.includes(model.variant)
    ) {
      throw new OpenCodeError('invalid_request', 'La variante seleccionada no está disponible para este modelo.')
    }
  }

  validateSelection(agent, model) {
    this.validateAgent(agent)
    this.validateModel(model)
  }

  async sendMessage(input) {
    await this.ensureNarrativeConnected(input?.workingDirectory)
    const sessionID = encodeURIComponent(assertIdentifier(input?.sessionID, 'La sesión'))
    const text = typeof input?.text === 'string' ? input.text : ''

    if (!text.trim() || text.length > 200000) {
      throw new OpenCodeError('invalid_request', 'El mensaje está vacío o es demasiado largo.')
    }

    this.validateSelection(input.agent, input.model)

    const payload = await this.fetchJson(this.withDirectory(`/session/${sessionID}/message`), {
      method: 'POST',
      body: {
        agent: input.agent,
        model: {
          providerID: input.model.providerID,
          modelID: input.model.modelID,
          ...(input.model.variant ? { variant: input.model.variant } : {}),
        },
        ...(typeof input.system === 'string' ? { system: input.system } : {}),
        parts: [{ type: 'text', text }],
      },
      timeout: 10 * 60 * 1000,
    })

    const embeddedError = isRecord(payload) && isRecord(payload.info)
      ? payload.info.error
      : null

    if (embeddedError) {
      throw classifyEmbeddedError(embeddedError)
    }

    return { accepted: true }
  }

  async switchModel(input) {
    await this.ensureNarrativeConnected(input?.workingDirectory)
    const sessionID = encodeURIComponent(assertIdentifier(input?.sessionID, 'La sesión'))
    this.validateModel(input.model)

    try {
      await this.fetchJson(this.withDirectory(`/api/session/${sessionID}/model`), {
        method: 'POST',
        body: {
          model: {
            id: input.model.modelID,
            providerID: input.model.providerID,
            ...(input.model.variant ? { variant: input.model.variant } : {}),
          },
        },
      })
      return { applied: true, fallback: false }
    } catch (error) {
      const normalized = normalizeError(error)

      if (normalized.httpStatus === 404 || normalized.httpStatus === 405) {
        return { applied: false, fallback: true }
      }

      throw normalized
    }
  }

  async switchAgent(input) {
    await this.ensureNarrativeConnected(input?.workingDirectory)
    const sessionID = encodeURIComponent(assertIdentifier(input?.sessionID, 'La sesión'))
    const agent = assertIdentifier(input?.agent, 'El agente')

    if (!this.agents.some((candidate) => candidate.name === agent)) {
      throw new OpenCodeError('invalid_request', 'El agente seleccionado no está disponible.')
    }

    try {
      await this.fetchJson(this.withDirectory(`/api/session/${sessionID}/agent`), {
        method: 'POST',
        body: { agent },
      })
      return { applied: true, fallback: false }
    } catch (error) {
      const normalized = normalizeError(error)

      if (normalized.httpStatus === 404 || normalized.httpStatus === 405) {
        return { applied: false, fallback: true }
      }

      throw normalized
    }
  }

  async replyPermission(input) {
    await this.ensureNarrativeConnected(input?.workingDirectory)
    const sessionID = encodeURIComponent(assertIdentifier(input?.sessionID, 'La sesión'))
    const requestID = encodeURIComponent(assertIdentifier(input?.requestID, 'El permiso'))

    if (!['once', 'always', 'reject'].includes(input?.reply)) {
      throw new OpenCodeError('invalid_request', 'La respuesta al permiso no es válida.')
    }

    await this.fetchJson(this.withDirectory(`/api/session/${sessionID}/permission/${requestID}/reply`), {
      method: 'POST',
      body: { reply: input.reply },
    })
    return { accepted: true }
  }

  async replyQuestion(input) {
    await this.ensureNarrativeConnected(input?.workingDirectory)
    const sessionID = encodeURIComponent(assertIdentifier(input?.sessionID, 'La sesión'))
    const requestID = encodeURIComponent(assertIdentifier(input?.requestID, 'La pregunta'))

    if (
      !Array.isArray(input?.answers) ||
      input.answers.some((answer) => !Array.isArray(answer) || answer.some((item) => typeof item !== 'string'))
    ) {
      throw new OpenCodeError('invalid_request', 'Las respuestas no tienen un formato válido.')
    }

    await this.fetchJson(this.withDirectory(`/api/session/${sessionID}/question/${requestID}/reply`), {
      method: 'POST',
      body: { answers: input.answers },
    })
    return { accepted: true }
  }

  async rejectQuestion(input) {
    await this.ensureNarrativeConnected(input?.workingDirectory)
    const sessionID = encodeURIComponent(assertIdentifier(input?.sessionID, 'La sesión'))
    const requestID = encodeURIComponent(assertIdentifier(input?.requestID, 'La pregunta'))
    await this.fetchJson(this.withDirectory(`/api/session/${sessionID}/question/${requestID}/reject`), {
      method: 'POST',
    })
    return { accepted: true }
  }

  rememberEvent(event) {
    if (!event.id) {
      return true
    }

    if (this.seenEventIDs.has(event.id)) {
      return false
    }

    this.seenEventIDs.add(event.id)
    this.seenEventQueue.push(event.id)

    if (this.seenEventQueue.length > MAX_SEEN_EVENT_IDS) {
      const oldestID = this.seenEventQueue.shift()
      this.seenEventIDs.delete(oldestID)
    }

    return true
  }

  async consumeEventStream() {
    const controller = new AbortController()
    this.eventAbortController = controller
    const url = new URL('/event', this.baseUrl)
    url.searchParams.set('directory', this.workingDirectory)
    const response = await fetch(url, {
      headers: { Accept: 'text/event-stream' },
      redirect: 'error',
      signal: controller.signal,
    })

    if (!response.ok || !response.body) {
      throw classifyHttpError(response.status, { message: 'Event stream unavailable' })
    }

    const contentType = response.headers.get('content-type') ?? ''

    if (!contentType.toLowerCase().includes('text/event-stream')) {
      throw new OpenCodeError(
        'incompatible',
        'OpenCode no ofrece el stream de eventos necesario para el chat.',
      )
    }

    if (this.hasConnectedEventStream) {
      this.onEvent({ type: 'inkforge.sse.reconnected' })
      this.setStatus({ ...this.status, message: 'OpenCode conectado.' })
    }
    this.hasConnectedEventStream = true

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (!this.stopping) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      buffer = `${buffer}${decoder.decode(value, { stream: true })}`.replaceAll('\r\n', '\n')
      let separatorIndex = buffer.indexOf('\n\n')

      while (separatorIndex >= 0) {
        const frame = buffer.slice(0, separatorIndex)
        buffer = buffer.slice(separatorIndex + 2)
        const data = frame
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n')

        if (data) {
          try {
            const event = normalizeServerEvent(JSON.parse(data), this.messageRoles, this.visibleParts)

            if (event && this.rememberEvent(event)) {
              this.onEvent(event)
            }
          } catch {
            // Ignore malformed individual events and keep the stream alive.
          }
        }

        separatorIndex = buffer.indexOf('\n\n')
      }
    }
  }

  async runEventStream() {
    while (!this.stopping && this.workingDirectory !== null && this.status.state === 'connected' && this.baseUrl) {
      try {
        await this.consumeEventStream()
      } catch (error) {
        if (this.stopping || error?.name === 'AbortError') {
          return
        }

        const normalized = normalizeError(error)

        if (normalized.code === 'incompatible') {
          this.setStatus({ state: 'incompatible', message: normalized.message })
          return
        }
      }

      if (!this.stopping && this.status.state === 'connected') {
        this.setStatus({ ...this.status, message: 'OpenCode conectado. Reconectando eventos…' })
        await delay(EVENT_RECONNECT_DELAY_MS)
      }
    }
  }

  async terminateManagedProcess() {
    this.eventAbortController?.abort()
    this.eventAbortController = null
    const child = this.child
    this.child = null

    if (!child || child.exitCode !== null || !child.pid) {
      return
    }

    await new Promise((resolve) => {
      let finished = false
      const finish = () => {
        if (!finished) {
          finished = true
          clearTimeout(timeout)
          resolve()
        }
      }
      const timeout = setTimeout(() => {
        try {
          child.kill('SIGKILL')
        } catch {
          // The managed process may already have exited.
        }
        finish()
      }, 3000)

      child.once('exit', finish)

      if (process.platform === 'win32') {
        const terminator = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
          windowsHide: true,
          stdio: 'ignore',
        })
        terminator.once('error', () => {
          try {
            child.kill()
          } catch {
            finish()
          }
        })
      } else {
        try {
          child.kill('SIGTERM')
        } catch {
          finish()
        }
      }
    })
  }

  async stop() {
    await this.workspaceChangePromise.catch(() => undefined)
    this.stopping = true
    await this.terminateManagedProcess()
    this.baseUrl = null
    this.models = []
    this.agents = []
    this.messageRoles.clear()
    this.visibleParts.clear()
    this.setStatus({ state: 'idle', message: 'OpenCode detenido.' })
  }
}

function createOpenCodeClient(options) {
  return new OpenCodeClient(options)
}

module.exports = {
  createOpenCodeClient,
  serializeError,
}
