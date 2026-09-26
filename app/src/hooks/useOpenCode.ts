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

    if (nextStatus.state === 'connected') {
      if (!capabilitiesLoadedRef.current) {
        capabilitiesLoadedRef.current = true
        void loadCapabilities()
      }
    } else {
      capabilitiesLoadedRef.current = false
    }
  }, [loadCapabilities])

  const refreshHistory = useCallback(async () => {
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
      sessionIDRef.current !== currentSessionID
    ) {
      return
    }

    if (!result.ok) {
      if (result.error.code === 'session_missing') {
        sessionIDRef.current = null
        sessionStartIndexRef.current = null
        setSessionID(null)
        assistantPartsRef.current.clear()
        queueDirectorSave(true)
        return
      }

      setError(result.error)
      return
    }

    assistantPartsRef.current.clear()
    const preservedMessages = messagesRef.current.slice(0, currentStartIndex)
    commitMessages([...preservedMessages, ...result.value], true)
  }, [commitMessages, queueDirectorSave])

  const handleEvent = useCallback((event: OpenCodeEvent) => {
    if (projectIdRef.current === null) return
    if (event.type === 'inkforge.sse.reconnected') {
      void refreshHistory()
      return
    }

    const currentSessionID = sessionIDRef.current

    if (!currentSessionID || event.sessionID !== currentSessionID) {
      return
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
      setPermission(event.permission)
      setActivityKey('openCode.activity.waitingPermission')
      return
    }

    if (event.type === 'question.v2.asked' && event.question) {
      setQuestion(event.question)
      setActivityKey('openCode.activity.waitingAnswer')
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
  }, [commitMessages, queueDirectorSave, refreshHistory])

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
      void refreshHistory()
    }
  }, [isChatReady, refreshHistory, sessionID, status.state])

  const connect = useCallback(async () => {
    const api = window.inkforge?.opencode

    if (!api) {
      setError(unavailableError)
      return
    }

    setStatus(initialStatus)
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

    if (projectGenerationRef.current !== generation) {
      return null
    }

    if (!result.ok) {
      setError(result.error)
      return null
    }

    sessionIDRef.current = result.value.id
    sessionStartIndexRef.current = messagesRef.current.length
    setSessionID(result.value.id)
    queueDirectorSave(true)
    return result.value.id
  }, [primaryAgent, queueDirectorSave])

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
    const currentSessionID = await ensureSession()

    if (!currentSessionID || projectGenerationRef.current !== generation) {
      return
    }

    const localMessageID = 'local-' + crypto.randomUUID()
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
        ...(selectedVariant ? { variant: selectedVariant } : {}),
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

  const chooseVariant = useCallback(async (variant: string) => {
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
    const api = window.inkforge?.opencode
    const currentSessionID = sessionIDRef.current
    const generation = projectGenerationRef.current

    if (!api || !currentSessionID) {
      return
    }

    const result = await api.switchModel({
      projectId: projectIdRef.current,
      sessionID: currentSessionID,
      model: {
        providerID: selectedModel.providerID,
        modelID: selectedModel.modelID,
        ...(variant ? { variant } : {}),
      },
    })

    if (!result.ok && projectGenerationRef.current === generation) {
      setError(result.error)
    }
  }, [selectedModel])

  const answerPermission = useCallback(async (reply: 'once' | 'always' | 'reject') => {
    const api = window.inkforge?.opencode

    if (!api || !permission) {
      return
    }

    const generation = projectGenerationRef.current
    const result = await api.replyPermission({
      projectId: projectIdRef.current,
      sessionID: permission.sessionID,
      requestID: permission.id,
      reply,
    })

    if (projectGenerationRef.current !== generation) {
      return
    }

    if (result.ok) {
      setPermission(null)
      setActivityKey('openCode.activity.working')
    } else {
      setError(result.error)
    }
  }, [permission])

  const answerQuestion = useCallback(async (answers: string[][]) => {
    const api = window.inkforge?.opencode

    if (!api || !question) {
      return
    }

    const generation = projectGenerationRef.current
    const result = await api.replyQuestion({
      projectId: projectIdRef.current,
      sessionID: question.sessionID,
      requestID: question.id,
      answers,
    })

    if (projectGenerationRef.current !== generation) {
      return
    }

    if (result.ok) {
      setQuestion(null)
      setActivityKey('openCode.activity.working')
    } else {
      setError(result.error)
    }
  }, [question])

  const rejectQuestion = useCallback(async () => {
    const api = window.inkforge?.opencode

    if (!api || !question) {
      return
    }

    const generation = projectGenerationRef.current
    const result = await api.rejectQuestion({
      projectId: projectIdRef.current,
      sessionID: question.sessionID,
      requestID: question.id,
    })

    if (projectGenerationRef.current !== generation) {
      return
    }

    if (result.ok) {
      setQuestion(null)
      setActivityKey('openCode.activity.working')
    } else {
      setError(result.error)
    }
  }, [question])

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
    activity: activityKey ? appI18n.t(activityKey) : '',
    error: displayedError,
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
