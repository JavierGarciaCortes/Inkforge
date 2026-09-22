import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  OpenCodeAgent,
  OpenCodeChatMessage,
  OpenCodeError,
  OpenCodeEvent,
  OpenCodeModel,
  OpenCodePermissionRequest,
  OpenCodeQuestionRequest,
  OpenCodeStatus,
} from '../types/inkforge'

const initialStatus: OpenCodeStatus = {
  state: 'starting',
  message: 'Conectando con OpenCode…',
}

const unavailableError: OpenCodeError = {
  code: 'disconnected',
  message: 'La integración de OpenCode solo está disponible en Inkforge Desktop.',
  retryable: false,
}

function modelKey(model: OpenCodeModel) {
  return JSON.stringify([model.providerID, model.modelID])
}

export function useOpenCode() {
  const bridgeAvailable = window.inkforge?.opencode !== undefined
  const [status, setStatus] = useState<OpenCodeStatus>(
    bridgeAvailable ? initialStatus : { state: 'error', message: unavailableError.message },
  )
  const [models, setModels] = useState<OpenCodeModel[]>([])
  const [primaryAgent, setPrimaryAgent] = useState<OpenCodeAgent | null>(null)
  const [selectedModelKey, setSelectedModelKey] = useState('')
  const [selectedVariant, setSelectedVariant] = useState('')
  const [sessionID, setSessionID] = useState<string | null>(null)
  const [messages, setMessages] = useState<OpenCodeChatMessage[]>([])
  const [composer, setComposer] = useState('')
  const [isWorking, setIsWorking] = useState(false)
  const [activity, setActivity] = useState('')
  const [error, setError] = useState<OpenCodeError | null>(bridgeAvailable ? null : unavailableError)
  const [permission, setPermission] = useState<OpenCodePermissionRequest | null>(null)
  const [question, setQuestion] = useState<OpenCodeQuestionRequest | null>(null)
  const mountedRef = useRef(false)
  const sessionIDRef = useRef<string | null>(null)
  const capabilitiesLoadedRef = useRef(false)
  const lastSubmittedTextRef = useRef('')
  const lastUserMessageIDRef = useRef<string | null>(null)
  const failedMessageIDRef = useRef<string | null>(null)
  const assistantPartsRef = useRef(
    new Map<string, Map<string, { text: string; final: boolean }>>(),
  )

  const selectedModel = useMemo(
    () => models.find((model) => modelKey(model) === selectedModelKey) ?? null,
    [models, selectedModelKey],
  )

  const loadCapabilities = useCallback(async () => {
    const api = window.inkforge?.opencode

    if (!api) {
      return
    }

    const [modelResult, agentResult] = await Promise.all([
      api.listModels(),
      api.listAgents(),
    ])

    if (!mountedRef.current) {
      return
    }

    if (!modelResult.ok) {
      capabilitiesLoadedRef.current = false
      setError(modelResult.error)
      return
    }

    if (!agentResult.ok) {
      capabilitiesLoadedRef.current = false
      setError(agentResult.error)
      return
    }

    setModels(modelResult.value)
    setSelectedVariant('')
    const representedProviders = new Set(
      modelResult.value.map((model) => model.providerID),
    )
    const automaticModel = representedProviders.size === 1
      ? modelResult.value.find((model) => model.isProviderDefault)
      : undefined

    setSelectedModelKey((current) => {
      if (modelResult.value.some((model) => modelKey(model) === current)) {
        return current
      }

      return automaticModel ? modelKey(automaticModel) : ''
    })
    const detectedPrimary = agentResult.value.length === 1
      && agentResult.value[0]?.mode === 'primary'
      ? agentResult.value[0]
      : null

    if (!detectedPrimary) {
      capabilitiesLoadedRef.current = false
      setPrimaryAgent(null)
      setError({
        code: 'incompatible',
        message: 'OpenCode no devolvi\u00f3 un \u00fanico agente principal del proyecto.',
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

    if (!api || !currentSessionID) {
      return
    }

    const result = await api.getMessages(currentSessionID)

    if (mountedRef.current && result.ok && sessionIDRef.current === currentSessionID) {
      setMessages(result.value)
    }
  }, [])

  const handleEvent = useCallback((event: OpenCodeEvent) => {
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
        ?? new Map<string, { text: string; final: boolean }>()

      if (partID && parts.has('__legacy__')) {
        parts.delete('__legacy__')
      }

      const existingPart = parts.get(partKey)
      if (!replace && existingPart?.final) {
        return
      }

      parts.set(partKey, {
        text: replace ? text : `${existingPart?.text ?? ''}${text}`,
        final: replace,
      })
      assistantPartsRef.current.set(messageID, parts)
      const reconciledText = Array.from(parts.values())
        .map((part) => part.text)
        .join('')

      setMessages((current) => {
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
      const messageID = event.assistantMessageID ?? `assistant-${currentSessionID}`
      updateAssistantPart(messageID, event.partID, event.delta, false)
      setIsWorking(true)
      setActivity('Escribiendo…')
      return
    }

    if (event.type === 'session.next.text.updated' && typeof event.text === 'string') {
      const messageID = event.assistantMessageID ?? `assistant-${currentSessionID}`
      updateAssistantPart(messageID, event.partID, event.text, true)
      setIsWorking(true)
      setActivity('Escribiendo…')
      return
    }

    if (event.type === 'permission.v2.asked' && event.permission) {
      setPermission(event.permission)
      setActivity('Esperando permiso')
      return
    }

    if (event.type === 'question.v2.asked' && event.question) {
      setQuestion(event.question)
      setActivity('Esperando respuesta')
      return
    }

    if (event.error) {
      const nextError = event.error ?? {
        code: 'unknown' as const,
        message: 'OpenCode no pudo completar la respuesta.',
        retryable: true,
      }
      setError(nextError)
      setIsWorking(false)
      setActivity('')
      setComposer((current) => current || lastSubmittedTextRef.current)
      failedMessageIDRef.current = lastUserMessageIDRef.current
      setMessages((current) => current.map((message) => (
        message.id === lastUserMessageIDRef.current ? { ...message, status: 'error' } : message
      )))
      return
    }

    if (event.type === 'session.idle') {
      setIsWorking(false)
      setActivity('')
      return
    }

    if (event.type.includes('reasoning')) {
      setIsWorking(true)
      setActivity('Pensando…')
      return
    }

    if (event.type.includes('tool') || event.type.includes('step') || event.type.includes('retried')) {
      setIsWorking(true)
      setActivity(event.type.includes('retried') ? 'Reintentando…' : 'Trabajando…')
    }
  }, [refreshHistory])

  useEffect(() => {
    mountedRef.current = true
    const api = window.inkforge?.opencode

    if (!api) {
      return () => {
        mountedRef.current = false
      }
    }

    const unsubscribeStatus = api.onStatus(applyStatus)
    const unsubscribeEvents = api.onEvent(handleEvent)

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
      mountedRef.current = false
      unsubscribeStatus()
      unsubscribeEvents()
    }
  }, [applyStatus, handleEvent])

  const connect = useCallback(async () => {
    const api = window.inkforge?.opencode

    if (!api) {
      setError(unavailableError)
      return
    }

    setStatus(initialStatus)
    setError(null)
    const result = await api.start()

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
  }, [applyStatus])

  const ensureSession = useCallback(async () => {
    if (sessionIDRef.current) {
      return sessionIDRef.current
    }

    const api = window.inkforge?.opencode

    if (!api || !primaryAgent) {
      setError({
        code: 'incompatible',
        message: 'OpenCode no devolvió un agente principal utilizable.',
        retryable: false,
      })
      return null
    }

    const result = await api.createSession({ title: 'Inkforge', agent: primaryAgent.name })

    if (!result.ok) {
      setError(result.error)
      return null
    }

    sessionIDRef.current = result.value.id
    setSessionID(result.value.id)
    return result.value.id
  }, [primaryAgent])

  const sendText = useCallback(async (sourceText: string) => {
    const api = window.inkforge?.opencode
    const text = sourceText.trim()

    if (
      !api ||
      !text ||
      isWorking ||
      status.state !== 'connected' ||
      !selectedModel ||
      !primaryAgent
    ) {
      return
    }

    setError(null)
    const currentSessionID = await ensureSession()

    if (!currentSessionID) {
      return
    }

    const localMessageID = `local-${crypto.randomUUID()}`
    lastSubmittedTextRef.current = text
    lastUserMessageIDRef.current = localMessageID
    failedMessageIDRef.current = null
    setMessages((current) => [
      ...current,
      { id: localMessageID, role: 'user', text, status: 'sending' },
    ])
    setComposer('')
    setIsWorking(true)
    setActivity('Enviando…')

    const result = await api.sendMessage({
      sessionID: currentSessionID,
      agent: primaryAgent.name,
      model: {
        providerID: selectedModel.providerID,
        modelID: selectedModel.modelID,
        ...(selectedVariant ? { variant: selectedVariant } : {}),
      },
      text,
    })

    if (!mountedRef.current) {
      return
    }

    if (result.ok) {
      setMessages((current) => current.map((message) => (
        message.id === localMessageID ? { ...message, status: 'sent' } : message
      )))
      return
    }

    failedMessageIDRef.current = localMessageID
    setMessages((current) => current.map((message) => (
      message.id === localMessageID ? { ...message, status: 'error' } : message
    )))
    setComposer((current) => current || text)
    setError(result.error)
    setIsWorking(false)
    setActivity('')
  }, [ensureSession, isWorking, primaryAgent, selectedModel, selectedVariant, status.state])

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

    setMessages((current) => current.filter((message) => message.id !== failedMessageID))
    failedMessageIDRef.current = null

    void sendText(text)
  }, [connect, sendText])

  const chooseModel = useCallback(async (nextKey: string) => {
    setSelectedModelKey(nextKey)
    if (!failedMessageIDRef.current) {
      setError(null)
    }
    const api = window.inkforge?.opencode
    const currentSessionID = sessionIDRef.current
    const model = models.find((candidate) => modelKey(candidate) === nextKey)
    const nextVariant = model?.variants.includes(selectedVariant) ? selectedVariant : ''
    setSelectedVariant(nextVariant)

    if (!api || !currentSessionID || !model) {
      return
    }

    const result = await api.switchModel({
      sessionID: currentSessionID,
      model: {
        providerID: model.providerID,
        modelID: model.modelID,
        ...(nextVariant ? { variant: nextVariant } : {}),
      },
    })

    if (!result.ok) {
      setError(result.error)
    }
  }, [models, selectedVariant])

  const chooseVariant = useCallback(async (variant: string) => {
    if (!selectedModel || (variant && !selectedModel.variants.includes(variant))) {
      return
    }

    setSelectedVariant(variant)
    if (!failedMessageIDRef.current) {
      setError(null)
    }
    const api = window.inkforge?.opencode
    const currentSessionID = sessionIDRef.current

    if (!api || !currentSessionID) {
      return
    }

    const result = await api.switchModel({
      sessionID: currentSessionID,
      model: {
        providerID: selectedModel.providerID,
        modelID: selectedModel.modelID,
        ...(variant ? { variant } : {}),
      },
    })

    if (!result.ok) {
      setError(result.error)
    }
  }, [selectedModel])

  const answerPermission = useCallback(async (reply: 'once' | 'always' | 'reject') => {
    const api = window.inkforge?.opencode

    if (!api || !permission) {
      return
    }

    const result = await api.replyPermission({
      sessionID: permission.sessionID,
      requestID: permission.id,
      reply,
    })

    if (result.ok) {
      setPermission(null)
      setActivity('Trabajando…')
    } else {
      setError(result.error)
    }
  }, [permission])

  const answerQuestion = useCallback(async (answers: string[][]) => {
    const api = window.inkforge?.opencode

    if (!api || !question) {
      return
    }

    const result = await api.replyQuestion({
      sessionID: question.sessionID,
      requestID: question.id,
      answers,
    })

    if (result.ok) {
      setQuestion(null)
      setActivity('Trabajando…')
    } else {
      setError(result.error)
    }
  }, [question])

  const rejectQuestion = useCallback(async () => {
    const api = window.inkforge?.opencode

    if (!api || !question) {
      return
    }

    const result = await api.rejectQuestion({
      sessionID: question.sessionID,
      requestID: question.id,
    })

    if (result.ok) {
      setQuestion(null)
      setActivity('Trabajando…')
    } else {
      setError(result.error)
    }
  }, [question])

  return {
    status,
    models,
    primaryAgent,
    selectedModelKey,
    selectedModel,
    selectedVariant,
    sessionID,
    messages,
    composer,
    isWorking,
    activity,
    error,
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
