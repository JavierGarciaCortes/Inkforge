import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { i18n as appI18n } from '../i18n'
import {
  loadOpenCodeModelSelection,
  saveOpenCodeModelSelection,
} from '../storage/model-selection-storage'
import type {
  DirectorChatState,
  OpenCodeAgent,
  OpenCodeChatMessage,
  OpenCodeError,
  OpenCodeEvent,
  OpenCodeInterruptedInteraction,
  OpenCodeModel,
  OpenCodePermissionRequest,
  OpenCodeQuestionRequest,
  OpenCodeStatus,
} from '../types/inkforge'

const DIRECTOR_SAVE_DELAY_MS = 400

function modelKey(model: OpenCodeModel) {
  return JSON.stringify([model.providerID, model.modelID])
}

type OpenCodeActivityKey =
  | ''
  | 'openCode.activity.writing'
  | 'openCode.activity.waitingPermission'
  | 'openCode.activity.waitingAnswer'
  | 'openCode.activity.thinking'
  | 'openCode.activity.retrying'
  | 'openCode.activity.working'
  | 'openCode.activity.sending'

type MessageUpdater = (
  messages: OpenCodeChatMessage[],
) => OpenCodeChatMessage[]

interface PendingDirectorSave {
  projectId: string
  state: DirectorChatState
}

export function useOpenCode(projectId: string | null) {
  const { i18n: translation } = useTranslation()
  const language = translation.language
  const bridgeAvailable = window.inkforge?.opencode !== undefined
  const initialStatus = useMemo<OpenCodeStatus>(() => {
    const translate = translation.getFixedT(language)
    return {
      state: 'starting',
      message: translate('openCode.connecting'),
    }
  }, [language, translation])
  const unavailableError = useMemo<OpenCodeError>(() => {
    const translate = translation.getFixedT(language)
    return {
      code: 'disconnected',
      message: translate('openCode.unavailable'),
      retryable: false,
    }
  }, [language, translation])
  const directorStateAvailable = (
    projectId === null ||
    window.inkforge?.directorState !== undefined
  )
  const directorStateUnavailableError = useMemo<OpenCodeError>(() => {
    const translate = translation.getFixedT(language)
    return {
      code: 'unknown',
      message: translate('openCode.chatStateLoadFailed'),
      retryable: false,
    }
  }, [language, translation])
  const [status, setStatus] = useState<OpenCodeStatus>(
    bridgeAvailable ? initialStatus : { state: 'error', message: unavailableError.message },
  )
  const [models, setModels] = useState<OpenCodeModel[]>([])
  const [unavailableModelKey, setUnavailableModelKey] = useState<string | null>(null)
  const [primaryAgent, setPrimaryAgent] = useState<OpenCodeAgent | null>(null)
  const [initialModelSelection] = useState(loadOpenCodeModelSelection)
  const [selectedModelKey, setSelectedModelKey] = useState(() => initialModelSelection
    ? JSON.stringify([initialModelSelection.providerID, initialModelSelection.modelID])
    : '')
  const [selectedModelLabel, setSelectedModelLabel] = useState(() => initialModelSelection
    ? initialModelSelection.displayName
      ?? `${initialModelSelection.providerID} · ${initialModelSelection.modelID}`
    : '')
  const [selectedVariant, setSelectedVariant] = useState(initialModelSelection?.variant ?? '')
  const [sessionID, setSessionID] = useState<string | null>(null)
  const [messages, setMessages] = useState<OpenCodeChatMessage[]>([])
  const [composer, setComposer] = useState('')
  const [isWorking, setIsWorking] = useState(false)
  const [isChatReady, setIsChatReady] = useState(false)
  const [activityKey, setActivityKey] = useState<OpenCodeActivityKey>('')
  const [error, setError] = useState<OpenCodeError | null>(bridgeAvailable ? null : unavailableError)
  const [permission, setPermission] = useState<OpenCodePermissionRequest | null>(null)
  const [question, setQuestion] = useState<OpenCodeQuestionRequest | null>(null)
  const [interruptedInteraction, setInterruptedInteraction] = useState<
    (NonNullable<OpenCodeInterruptedInteraction> & { projectId: string; sessionID: string }) | null
  >(null)
  const recoveryRevisionRef = useRef(0)
  const sessionRefreshRef = useRef(0)
  const permissionRef = useRef<OpenCodePermissionRequest | null>(null)
  const questionRef = useRef<OpenCodeQuestionRequest | null>(null)
  const permissionRevisionRef = useRef(0)
  const questionRevisionRef = useRef(0)
  const pendingRefreshRef = useRef(0)
  const connectedRef = useRef(false)
  const mountedRef = useRef(false)
  const projectIdRef = useRef<string | null>(projectId)
  const projectGenerationRef = useRef(0)
  const stateReadyRef = useRef(false)
  const messagesRef = useRef<OpenCodeChatMessage[]>([])
  const sessionIDRef = useRef<string | null>(null)
  const sessionStartIndexRef = useRef<number | null>(null)
  const capabilitiesLoadedRef = useRef(false)
  const lastSubmittedTextRef = useRef('')
  const lastUserMessageIDRef = useRef<string | null>(null)
  const failedMessageIDRef = useRef<string | null>(null)
  const directorSaveTimerRef = useRef<number | null>(null)
  const pendingDirectorSaveRef = useRef<PendingDirectorSave | null>(null)
  const assistantPartsRef = useRef(
    new Map<string, Map<string, string>>(),
  )

  const selectedModel = useMemo(
    () => models.find((model) => modelKey(model) === selectedModelKey) ?? null,
    [models, selectedModelKey],
  )

  const updatePermission = useCallback((next: OpenCodePermissionRequest | null) => {
    if (next) setInterruptedInteraction(null)
    permissionRevisionRef.current += 1
    permissionRef.current = next
    setPermission(next)
  }, [])

  const updateQuestion = useCallback((next: OpenCodeQuestionRequest | null) => {
    if (next) setInterruptedInteraction(null)
    questionRevisionRef.current += 1
    questionRef.current = next
    setQuestion(next)
  }, [])

  const clearInteractions = useCallback(() => {
    recoveryRevisionRef.current += 1
    sessionRefreshRef.current += 1
    setInterruptedInteraction(null)
    pendingRefreshRef.current += 1
    updatePermission(null)
    updateQuestion(null)
    setActivityKey('')
  }, [updatePermission, updateQuestion])

  const reportDirectorSaveError = useCallback((savedProjectId: string) => {
    if (!mountedRef.current || projectIdRef.current !== savedProjectId) {
      return
    }

    setError({
      code: 'unknown',
      message: appI18n.t('openCode.chatStateSaveFailed'),
      retryable: false,
    })
  }, [])

  const executeDirectorSave = useCallback((pendingSave: PendingDirectorSave) => {
    const api = window.inkforge?.directorState

    if (!api) {
      reportDirectorSaveError(pendingSave.projectId)
      return
    }

    void api.save(pendingSave.projectId, pendingSave.state).catch(() => {
      reportDirectorSaveError(pendingSave.projectId)
    })
  }, [reportDirectorSaveError])

  const flushPendingDirectorSave = useCallback(() => {
    if (directorSaveTimerRef.current !== null) {
      window.clearTimeout(directorSaveTimerRef.current)
      directorSaveTimerRef.current = null
    }

    const pendingSave = pendingDirectorSaveRef.current
    pendingDirectorSaveRef.current = null

    if (pendingSave) {
      executeDirectorSave(pendingSave)
    }
  }, [executeDirectorSave])

  const queueDirectorSave = useCallback((immediate: boolean) => {
    const savedProjectId = projectIdRef.current

    if (!savedProjectId || !stateReadyRef.current) {
      return
    }

    pendingDirectorSaveRef.current = {
      projectId: savedProjectId,
      state: {
        version: 1,
        messages: messagesRef.current.map((message) => ({ ...message })),
        currentSession: (
          sessionIDRef.current && sessionStartIndexRef.current !== null
            ? {
                id: sessionIDRef.current,
                startIndex: sessionStartIndexRef.current,
              }
            : null
        ),
      },
    }

    if (immediate) {
      flushPendingDirectorSave()
      return
    }

    if (directorSaveTimerRef.current !== null) {
      window.clearTimeout(directorSaveTimerRef.current)
    }

    directorSaveTimerRef.current = window.setTimeout(() => {
      directorSaveTimerRef.current = null
      const pendingSave = pendingDirectorSaveRef.current
      pendingDirectorSaveRef.current = null

      if (pendingSave) {
        executeDirectorSave(pendingSave)
      }
    }, DIRECTOR_SAVE_DELAY_MS)
  }, [executeDirectorSave, flushPendingDirectorSave])

  const commitMessages = useCallback((
    updater: MessageUpdater | OpenCodeChatMessage[],
    immediate = false,
  ) => {
    const nextMessages = typeof updater === 'function'
      ? updater(messagesRef.current)
      : updater
    messagesRef.current = nextMessages
    setMessages(nextMessages)
    queueDirectorSave(immediate)
  }, [queueDirectorSave])

  const loadCapabilities = useCallback(async () => {
    const api = window.inkforge?.opencode
    const generation = projectGenerationRef.current

    if (!api) {
      return
    }

    const [modelResult, agentResult] = await Promise.all([
      api.listModels(),
      api.listAgents(),
    ])

    if (
      !mountedRef.current ||
      projectGenerationRef.current !== generation
    ) {
      return
    }

    if (!modelResult.ok) {
      capabilitiesLoadedRef.current = false
      setError(modelResult.error)
      return
    }

    setModels(modelResult.value)
    const storedSelection = loadOpenCodeModelSelection()
    const storedModel = storedSelection
      ? modelResult.value.find((model) => (
          model.providerID === storedSelection.providerID &&
          model.modelID === storedSelection.modelID
        ))
      : undefined
    const storedVariant = storedModel && storedSelection?.variant &&
      storedModel.variants.includes(storedSelection.variant)
        ? storedSelection.variant
        : ''
    setUnavailableModelKey(storedSelection && !storedModel
      ? JSON.stringify([storedSelection.providerID, storedSelection.modelID])
      : null)

    if (storedModel) {
      const displayName = `${storedModel.providerName} · ${storedModel.name}`
      setSelectedModelLabel(displayName)
      saveOpenCodeModelSelection({
        providerID: storedModel.providerID,
        modelID: storedModel.modelID,
        ...(storedVariant ? { variant: storedVariant } : {}),
        displayName,
      })
    }
    const representedProviders = new Set(
      modelResult.value.map((model) => model.providerID),
    )
    const automaticModel = representedProviders.size === 1
      ? modelResult.value.find((model) => model.isProviderDefault)
      : undefined

    setSelectedModelKey((current) => {
      if (storedModel) {
        return modelKey(storedModel)
      }

      if (modelResult.value.some((model) => modelKey(model) === current)) {
        return current
      }

      return automaticModel ? modelKey(automaticModel) : ''
    })
    setSelectedVariant(storedVariant)

    if (!agentResult.ok) {
      capabilitiesLoadedRef.current = false
      setError(agentResult.error)
      return
    }

    if (projectIdRef.current === null) return

    const detectedPrimary = agentResult.value.length === 1
      && agentResult.value[0]?.mode === 'primary'
      ? agentResult.value[0]
      : null

    if (!detectedPrimary) {
      capabilitiesLoadedRef.current = false
      setPrimaryAgent(null)
      setError({
        code: 'incompatible',
        message: appI18n.t('openCode.primaryMissing'),
        retryable: false,
      })
      return
    }

    setPrimaryAgent(detectedPrimary)
  }, [])

  const applyStatus = useCallback((nextStatus: OpenCodeStatus) => {
    if (!mountedRef.current) {
      return
    }

    setStatus(nextStatus)
    connectedRef.current = nextStatus.state === 'connected'

    if (nextStatus.state === 'connected') {
      if (!capabilitiesLoadedRef.current) {
        capabilitiesLoadedRef.current = true
        void loadCapabilities()
      }
    } else {
      capabilitiesLoadedRef.current = false
      pendingRefreshRef.current += 1
      recoveryRevisionRef.current += 1
    }
  }, [loadCapabilities])

  const forgetMissingSession = useCallback(() => {
    sessionIDRef.current = null
    sessionStartIndexRef.current = null
    setSessionID(null)
    clearInteractions()
    setIsWorking(false)
    assistantPartsRef.current.clear()
    queueDirectorSave(true)
  }, [clearInteractions, queueDirectorSave])

  const refreshHistory = useCallback(async () => {
    const revision = recoveryRevisionRef.current
    const refresh = sessionRefreshRef.current
    const api = window.inkforge?.opencode
    const currentSessionID = sessionIDRef.current
    const currentStartIndex = sessionStartIndexRef.current
    const currentProjectId = projectIdRef.current
    const generation = projectGenerationRef.current

    if (!api || !currentSessionID || currentStartIndex === null || currentProjectId === null) {
      return
    }

    const result = await api.getMessages(currentSessionID, currentProjectId)

    if (
      !mountedRef.current ||
      projectGenerationRef.current !== generation ||
      sessionIDRef.current !== currentSessionID ||
      recoveryRevisionRef.current !== revision || sessionRefreshRef.current !== refresh
    ) {
      return
    }

    if (!result.ok) {
      if (result.error.code === 'session_missing') {
        forgetMissingSession()
        return
      }

      setError(result.error)
      return
    }

    assistantPartsRef.current.clear()
    const preservedMessages = messagesRef.current.slice(0, currentStartIndex)
    commitMessages([...preservedMessages, ...result.value.messages], true)
    return result.value.unfinishedInteraction
  }, [commitMessages, forgetMissingSession])

  const refreshPendingInteractions = useCallback(async (history: {
    interaction: OpenCodeInterruptedInteraction | undefined
    revision: number
    permissionRevision: number
    questionRevision: number
    refresh: number
  }) => {
    const api = window.inkforge?.opencode
    const expectedSession = sessionIDRef.current
    const expectedProject = projectIdRef.current
    const generation = projectGenerationRef.current
    if (!api || !expectedProject || !expectedSession || !connectedRef.current) return
    const refresh = ++pendingRefreshRef.current
    const permissionRevision = permissionRevisionRef.current
    const questionRevision = questionRevisionRef.current
    const result = await api.getPendingInteractions(expectedSession, expectedProject)
    if (
      !mountedRef.current || !connectedRef.current ||
      projectGenerationRef.current !== generation || projectIdRef.current !== expectedProject ||
      sessionIDRef.current !== expectedSession || pendingRefreshRef.current !== refresh
    ) return
    if (!result.ok) {
      if (result.error.code === 'session_missing') forgetMissingSession()
      else setError(result.error)
      return
    }
    // One card per kind: choose the lowest ID, independently of API array order.
    const select = <T extends { id: string; sessionID: string }>(requests: T[]) => (
      requests.filter((request) => request.sessionID === expectedSession)
        .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)[0] ?? null
    )
    // SSE events and local replies after the GET started take precedence.
    const historyIsCurrent = (
      history.refresh === sessionRefreshRef.current &&
      history.revision === recoveryRevisionRef.current &&
      history.permissionRevision === permissionRevisionRef.current &&
      history.questionRevision === questionRevisionRef.current
    )
    if (permissionRevisionRef.current === permissionRevision && history.permissionRevision === permissionRevision) {
      updatePermission(select(result.value.permissions))
    }
    if (questionRevisionRef.current === questionRevision && history.questionRevision === questionRevision) {
      updateQuestion(select(result.value.questions))
    }
    if (historyIsCurrent && history.interaction !== undefined) {
      // Any live request wins. Never manufacture an actionable historical card.
      const interrupted = permissionRef.current || questionRef.current ? null : history.interaction
      setInterruptedInteraction(interrupted ? { ...interrupted, projectId: expectedProject, sessionID: expectedSession } : null)
      if (interrupted) {
        setIsWorking(false)
        setActivityKey('')
      }
    }
  }, [forgetMissingSession, updatePermission, updateQuestion])

  const refreshSession = useCallback(async () => {
    const generation = projectGenerationRef.current
    const expectedSession = sessionIDRef.current
    const refresh = ++sessionRefreshRef.current
    const revision = recoveryRevisionRef.current
    const permissionRevision = permissionRevisionRef.current
    const questionRevision = questionRevisionRef.current
    const interaction = await refreshHistory()
    if (mountedRef.current && projectGenerationRef.current === generation && sessionIDRef.current === expectedSession && sessionRefreshRef.current === refresh) {
      await refreshPendingInteractions({ interaction, revision, permissionRevision, questionRevision, refresh })
    }
  }, [refreshHistory, refreshPendingInteractions])

  const handleEvent = useCallback((event: OpenCodeEvent) => {
    if (projectIdRef.current === null) return
    if (event.type === 'inkforge.sse.reconnected') {
      void refreshSession()
      return
    }

    const currentSessionID = sessionIDRef.current

    if (!currentSessionID || event.sessionID !== currentSessionID) {
      return
    }

    recoveryRevisionRef.current += 1
    if (event.type !== 'session.idle' && event.type !== 'session.status') {
      setInterruptedInteraction(null)
    }

    const updateAssistantPart = (
      messageID: string,
      partID: string | undefined,
      text: string,
      replace: boolean,
    ) => {
      const partKey = partID ?? '__legacy__'
      const parts = assistantPartsRef.current.get(messageID)
        ?? new Map<string, string>()

      if (partID && parts.has('__legacy__')) {
        parts.delete('__legacy__')
      }

      const existingPart = parts.get(partKey)
      parts.set(partKey, replace ? text : (existingPart ?? '') + text)
      assistantPartsRef.current.set(messageID, parts)
      const reconciledText = Array.from(parts.values())
        .join('')

      commitMessages((current) => {
        const existingIndex = current.findIndex((message) => message.id === messageID)

        if (existingIndex < 0) {
          return [...current, { id: messageID, role: 'assistant', text: reconciledText }]
        }

        return current.map((message, index) => (
          index === existingIndex ? { ...message, text: reconciledText } : message
        ))
      })
    }

    if (event.type === 'session.next.text.delta' && event.delta) {
      const messageID = event.assistantMessageID ?? 'assistant-' + currentSessionID
      updateAssistantPart(messageID, event.partID, event.delta, false)
      setIsWorking(true)
      setActivityKey('openCode.activity.writing')
      return
    }

    if (event.type === 'session.next.text.updated' && typeof event.text === 'string') {
      const messageID = event.assistantMessageID ?? 'assistant-' + currentSessionID
      updateAssistantPart(messageID, event.partID, event.text, true)
      setIsWorking(true)
      setActivityKey('openCode.activity.writing')
      return
    }

    if (event.type === 'permission.v2.asked' && event.permission) {
      updatePermission(event.permission)
      return
    }

    if (event.type === 'question.v2.asked' && event.question) {
      updateQuestion(event.question)
      return
    }

    if (event.type === 'permission.v2.replied') {
      permissionRevisionRef.current += 1
      if (permissionRef.current?.id === event.requestID) updatePermission(null)
      return
    }

    if (event.type === 'question.v2.replied' || event.type === 'question.v2.rejected') {
      questionRevisionRef.current += 1
      if (questionRef.current?.id === event.requestID) updateQuestion(null)
      return
    }

    if (event.error) {
      setError(event.error)
      setIsWorking(false)
      setActivityKey('')
      setComposer((current) => current || lastSubmittedTextRef.current)
      failedMessageIDRef.current = lastUserMessageIDRef.current
      commitMessages((current) => current.map((message) => (
        message.id === lastUserMessageIDRef.current ? { ...message, status: 'error' } : message
      )), true)
      return
    }

    if (event.type === 'session.idle') {
      setIsWorking(false)
      setActivityKey('')
      queueDirectorSave(true)
      return
    }

    if (event.type.includes('reasoning')) {
      setIsWorking(true)
      setActivityKey('openCode.activity.thinking')
      return
    }

    if (event.type.includes('tool') || event.type.includes('step') || event.type.includes('retried')) {
      setIsWorking(true)
      setActivityKey(event.type.includes('retried')
        ? 'openCode.activity.retrying'
        : 'openCode.activity.working')
    }
  }, [commitMessages, queueDirectorSave, refreshSession, updatePermission, updateQuestion])

  useEffect(() => {
    mountedRef.current = true
    const api = window.inkforge?.opencode

    if (!api) {
      return () => {
        mountedRef.current = false
        flushPendingDirectorSave()
      }
    }

    const unsubscribeStatus = api.onStatus(applyStatus)
    const unsubscribeEvents = projectIdRef.current === null ? () => undefined : api.onEvent(handleEvent)

    void api.status().then((result) => {
      if (!mountedRef.current) {
        return
      }

      if (result.ok) {
        applyStatus(result.value)
      } else {
        setStatus({ state: 'error', message: result.error.message })
        setError(result.error)
      }
    })

    return () => {
      flushPendingDirectorSave()
      mountedRef.current = false
      unsubscribeStatus()
      unsubscribeEvents()
    }
  }, [applyStatus, flushPendingDirectorSave, handleEvent])

  useEffect(() => {
    const generation = projectGenerationRef.current + 1
    projectGenerationRef.current = generation
    projectIdRef.current = projectId
    stateReadyRef.current = false
    recoveryRevisionRef.current += 1
    sessionRefreshRef.current += 1

    if (projectId === null) {
      return
    }

    const api = window.inkforge?.directorState

    if (!api) {
      return
    }

    void api.load(projectId).then((loadedState) => {
      if (
        !mountedRef.current ||
        projectGenerationRef.current !== generation ||
        projectIdRef.current !== projectId
      ) {
        return
      }

      messagesRef.current = loadedState.messages
      setInterruptedInteraction(null)
      sessionIDRef.current = loadedState.currentSession?.id ?? null
      sessionStartIndexRef.current = loadedState.currentSession?.startIndex ?? null
      stateReadyRef.current = true
      setMessages(loadedState.messages)
      setSessionID(loadedState.currentSession?.id ?? null)
      setIsChatReady(true)
    }).catch(() => {
      if (
        mountedRef.current &&
        projectGenerationRef.current === generation &&
        projectIdRef.current === projectId
      ) {
        setError({
          code: 'unknown',
          message: appI18n.t('openCode.chatStateLoadFailed'),
          retryable: false,
        })
      }
    })
  }, [projectId])

  useEffect(() => {
    if (isChatReady && sessionID && status.state === 'connected') {
      void refreshSession()
    }
  }, [isChatReady, refreshSession, sessionID, status.state])

  const connect = useCallback(async () => {
    const api = window.inkforge?.opencode

    if (!api) {
      setError(unavailableError)
      return
    }

    setStatus(initialStatus)
    connectedRef.current = false
    setError(null)
    const generation = projectGenerationRef.current
    const result = await api.start()

    if (projectGenerationRef.current !== generation) {
      return
    }

    if (result.ok) {
      applyStatus(result.value)
    } else {
      setStatus({
        state: result.error.code === 'not_found'
          ? 'not_found'
          : result.error.code === 'incompatible'
            ? 'incompatible'
            : 'error',
        message: result.error.message,
      })
      setError(result.error)
    }
  }, [applyStatus, initialStatus, unavailableError])

  const ensureSession = useCallback(async () => {
    if (projectIdRef.current === null) return null
    if (sessionIDRef.current) {
      return sessionIDRef.current
    }

    const api = window.inkforge?.opencode

    if (!api || !primaryAgent) {
      setError({
        code: 'incompatible',
        message: appI18n.t('openCode.primaryUnavailable'),
        retryable: false,
      })
      return null
    }

    const generation = projectGenerationRef.current
    const result = await api.createSession({ projectId: projectIdRef.current, title: 'Inkforge', agent: primaryAgent.name })

    if (!mountedRef.current || projectGenerationRef.current !== generation) {
      return null
    }

    if (!result.ok) {
      setError(result.error)
      return null
    }

    clearInteractions()
    sessionIDRef.current = result.value.id
    sessionStartIndexRef.current = messagesRef.current.length
    setSessionID(result.value.id)
    queueDirectorSave(true)
    return result.value.id
  }, [clearInteractions, primaryAgent, queueDirectorSave])

  const sendText = useCallback(async (sourceText: string) => {
    const api = window.inkforge?.opencode
    const text = sourceText.trim()

    if (
      !api ||
      !text ||
      !stateReadyRef.current ||
      projectIdRef.current === null ||
      isWorking ||
      status.state !== 'connected' ||
      !selectedModel ||
      !primaryAgent
    ) {
      return
    }

    setError(null)
    const generation = projectGenerationRef.current
    let variantForMessage = selectedVariant
    if (selectedVariant) {
      const catalog = await api.listModels()
      if (!mountedRef.current || projectGenerationRef.current !== generation) {
        return
      }
      if (!catalog.ok) {
        setError(catalog.error)
        return
      }

      setModels(catalog.value)
      const currentModel = catalog.value.find((model) => (
        model.providerID === selectedModel.providerID && model.modelID === selectedModel.modelID
      ))
      if (!currentModel) {
        setUnavailableModelKey(modelKey(selectedModel))
        return
      }
      setUnavailableModelKey(null)
      if (!currentModel.variants.includes(selectedVariant)) {
        variantForMessage = ''
        setSelectedVariant('')
        saveOpenCodeModelSelection({
          providerID: currentModel.providerID,
          modelID: currentModel.modelID,
          displayName: `${currentModel.providerName} · ${currentModel.name}`,
        })
      }
    }

    const currentSessionID = await ensureSession()

    if (!currentSessionID || projectGenerationRef.current !== generation) {
      return
    }

    const localMessageID = 'local-' + crypto.randomUUID()
    recoveryRevisionRef.current += 1
    setInterruptedInteraction(null)
    lastSubmittedTextRef.current = text
    lastUserMessageIDRef.current = localMessageID
    failedMessageIDRef.current = null
    commitMessages((current) => [
      ...current,
      { id: localMessageID, role: 'user', text, status: 'sending' },
    ], true)
    setComposer('')
    setIsWorking(true)
    setActivityKey('openCode.activity.sending')

    const result = await api.sendMessage({
      projectId: projectIdRef.current,
      sessionID: currentSessionID,
      agent: primaryAgent.name,
      model: {
        providerID: selectedModel.providerID,
        modelID: selectedModel.modelID,
        ...(variantForMessage ? { variant: variantForMessage } : {}),
      },
      text,
    })

    if (!mountedRef.current || projectGenerationRef.current !== generation) {
      return
    }

    if (result.ok) {
      commitMessages((current) => current.map((message) => (
        message.id === localMessageID ? { ...message, status: 'sent' } : message
      )), true)
      return
    }

    failedMessageIDRef.current = localMessageID
    commitMessages((current) => current.map((message) => (
      message.id === localMessageID ? { ...message, status: 'error' } : message
    )), true)
    setComposer((current) => current || text)
    setError(result.error)
    setIsWorking(false)
    setActivityKey('')
  }, [
    commitMessages,
    ensureSession,
    isWorking,
    primaryAgent,
    selectedModel,
    selectedVariant,
    status.state,
  ])

  const sendCurrentMessage = useCallback(() => {
    void sendText(composer)
  }, [composer, sendText])

  const retryLastMessage = useCallback(() => {
    const text = lastSubmittedTextRef.current
    const failedMessageID = failedMessageIDRef.current

    if (!text || !failedMessageID) {
      void connect()
      return
    }

    commitMessages(
      (current) => current.filter((message) => message.id !== failedMessageID),
      true,
    )
    failedMessageIDRef.current = null
    void sendText(text)
  }, [commitMessages, connect, sendText])

  const chooseModel = useCallback(async (nextKey: string) => {
    setSelectedModelKey(nextKey)
    if (!failedMessageIDRef.current) {
      setError(null)
    }
    const api = window.inkforge?.opencode
    const currentSessionID = sessionIDRef.current
    const generation = projectGenerationRef.current
    const model = models.find((candidate) => modelKey(candidate) === nextKey)
    const nextVariant = model?.variants.includes(selectedVariant) ? selectedVariant : ''
    setSelectedVariant(nextVariant)

    if (model) {
      setUnavailableModelKey(null)
      const displayName = `${model.providerName} · ${model.name}`
      setSelectedModelLabel(displayName)
      saveOpenCodeModelSelection({
        providerID: model.providerID,
        modelID: model.modelID,
        ...(nextVariant ? { variant: nextVariant } : {}),
        displayName,
      })
    }

    if (!api || !currentSessionID || !model) {
      return
    }

    const result = await api.switchModel({
      projectId: projectIdRef.current,
      sessionID: currentSessionID,
      model: {
        providerID: model.providerID,
        modelID: model.modelID,
        ...(nextVariant ? { variant: nextVariant } : {}),
      },
    })

    if (!result.ok && projectGenerationRef.current === generation) {
      setError(result.error)
    }
  }, [models, selectedVariant])

  const chooseVariant = useCallback((variant: string) => {
    if (!selectedModel || (variant && !selectedModel.variants.includes(variant))) {
      return
    }

    setSelectedVariant(variant)
    saveOpenCodeModelSelection({
      providerID: selectedModel.providerID,
      modelID: selectedModel.modelID,
      ...(variant ? { variant } : {}),
      displayName: `${selectedModel.providerName} · ${selectedModel.name}`,
    })
    if (!failedMessageIDRef.current) {
      setError(null)
    }
  }, [selectedModel])

  const answerPermission = useCallback(async (reply: 'once' | 'always' | 'reject') => {
    const api = window.inkforge?.opencode

    if (!api || !permission || !projectIdRef.current || permission.sessionID !== sessionIDRef.current) {
      return
    }

    const generation = projectGenerationRef.current
    const result = await api.replyPermission({
      projectId: projectIdRef.current,
      sessionID: permission.sessionID,
      requestID: permission.id,
      reply,
    })

    if (!mountedRef.current || projectGenerationRef.current !== generation || sessionIDRef.current !== permission.sessionID) {
      return
    }

    if (result.ok) {
      permissionRevisionRef.current += 1
      if (permissionRef.current?.id === permission.id) updatePermission(null)
    } else {
      setError(result.error)
    }
  }, [permission, updatePermission])

  const answerQuestion = useCallback(async (answers: string[][]) => {
    const api = window.inkforge?.opencode

    if (!api || !question || !projectIdRef.current || question.sessionID !== sessionIDRef.current) {
      return
    }

    const generation = projectGenerationRef.current
    const result = await api.replyQuestion({
      projectId: projectIdRef.current,
      sessionID: question.sessionID,
      requestID: question.id,
      answers,
    })

    if (!mountedRef.current || projectGenerationRef.current !== generation || sessionIDRef.current !== question.sessionID) {
      return
    }

    if (result.ok) {
      questionRevisionRef.current += 1
      if (questionRef.current?.id === question.id) updateQuestion(null)
    } else {
      setError(result.error)
    }
  }, [question, updateQuestion])

  const rejectQuestion = useCallback(async () => {
    const api = window.inkforge?.opencode

    if (!api || !question || !projectIdRef.current || question.sessionID !== sessionIDRef.current) {
      return
    }

    const generation = projectGenerationRef.current
    const result = await api.rejectQuestion({
      projectId: projectIdRef.current,
      sessionID: question.sessionID,
      requestID: question.id,
    })

    if (!mountedRef.current || projectGenerationRef.current !== generation || sessionIDRef.current !== question.sessionID) {
      return
    }

    if (result.ok) {
      questionRevisionRef.current += 1
      if (questionRef.current?.id === question.id) updateQuestion(null)
    } else {
      setError(result.error)
    }
  }, [question, updateQuestion])

  const displayedStatus = status.state === 'starting'
    ? initialStatus
    : !bridgeAvailable && status.state === 'error'
      ? { ...status, message: unavailableError.message }
      : status
  const displayedError = !directorStateAvailable
    ? directorStateUnavailableError
    : !bridgeAvailable && error?.code === 'disconnected'
      ? unavailableError
      : error

  const displayedActivityKey = question
    ? 'openCode.activity.waitingAnswer'
    : permission
      ? 'openCode.activity.waitingPermission'
      : isWorking ? activityKey : ''

  return {
    status: displayedStatus,
    models,
    unavailableModelKey,
    primaryAgent,
    selectedModelKey,
    selectedModel,
    selectedModelLabel,
    selectedVariant,
    sessionID,
    messages,
    composer,
    isWorking,
    isChatReady,
    activity: displayedActivityKey ? appI18n.t(displayedActivityKey) : '',
    error: displayedError,
    interruptedInteraction: interruptedInteraction?.projectId === projectId && interruptedInteraction.sessionID === sessionID
      ? interruptedInteraction : null,
    permission,
    question,
    setComposer,
    connect,
    chooseModel,
    chooseVariant,
    sendCurrentMessage,
    retryLastMessage,
    answerPermission,
    answerQuestion,
    rejectQuestion,
  }
}
