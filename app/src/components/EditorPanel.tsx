import { useEffect, useRef } from 'react'
import { useOpenCode } from '../hooks/useOpenCode'
import { OpenCodePermissionCard } from './OpenCodePermissionCard'
import { OpenCodeQuestionCard } from './OpenCodeQuestionCard'

const statusLabels = {
  idle: 'Inactivo',
  starting: 'Iniciando',
  connected: 'Conectado',
  incompatible: 'Incompatible',
  not_found: 'No encontrado',
  error: 'Error',
}

export function EditorPanel() {
  const chat = useOpenCode()
  const messageListRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const list = messageListRef.current

    if (list) {
      list.scrollTop = list.scrollHeight
    }
  }, [chat.messages, chat.activity, chat.permission, chat.question])

  const canSend = (
    chat.status.state === 'connected' &&
    chat.composer.trim().length > 0 &&
    chat.selectedModelKey.length > 0 &&
    chat.primaryAgent !== null &&
    !chat.isWorking
  )

  return (
    <aside className="editor-panel opencode-panel" aria-label="Editor con OpenCode">
      <div className="panel-heading editor-heading">
        <span className="eyebrow">OpenCode</span>
        <span className={`connection-state connection-${chat.status.state}`}>
          {statusLabels[chat.status.state]}
        </span>
      </div>

      <div className="opencode-controls">
        <label>
          <span>Modelo</span>
          <select
            value={chat.selectedModelKey}
            disabled={chat.status.state !== 'connected' || chat.models.length === 0}
            onChange={(event) => void chat.chooseModel(event.target.value)}
          >
            {chat.models.length === 0
              ? <option value="">Sin modelos conectados</option>
              : <option value="">Selecciona un modelo</option>}
            {chat.models.map((model) => (
              <option
                key={`${model.providerID}:${model.modelID}`}
                value={JSON.stringify([model.providerID, model.modelID])}
              >
                {model.providerName} · {model.name}
              </option>
            ))}
          </select>
        </label>
        {chat.selectedModel && chat.selectedModel.variants.length > 0 && (
          <label>
            <span>Variante</span>
            <select
              value={chat.selectedVariant}
              disabled={chat.status.state !== 'connected'}
              onChange={(event) => void chat.chooseVariant(event.target.value)}
            >
              <option value="">Predeterminado</option>
              {chat.selectedModel.variants.map((variant) => (
                <option key={variant} value={variant}>{variant}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="opencode-messages" ref={messageListRef} aria-live="polite">
        {chat.messages.length === 0 && chat.status.state === 'connected' && (
          <div className="opencode-empty">
            <div className="editor-monogram" aria-hidden="true">O</div>
            <h2>Asistente editorial</h2>
            <p>La conversación utilizará los agentes, skills y herramientas configurados en este proyecto.</p>
          </div>
        )}

        {chat.status.state !== 'connected' && (
          <div className="opencode-empty">
            <div className="editor-monogram" aria-hidden="true">O</div>
            <h2>{statusLabels[chat.status.state]}</h2>
            <p>{chat.status.message}</p>
            {chat.status.state !== 'starting' && (
              <button type="button" onClick={() => void chat.connect()}>Reintentar conexión</button>
            )}
          </div>
        )}

        {chat.messages.map((message) => (
          <article
            className={`chat-message chat-message-${message.role}${message.status === 'error' ? ' chat-message-error' : ''}`}
            key={message.id}
          >
            <span>{message.role === 'user' ? 'Tú' : 'Inkforge'}</span>
            <p>{message.text}</p>
            {message.status === 'error' && <small>No se pudo completar este envío.</small>}
          </article>
        ))}

        {chat.activity && <div className="opencode-activity">{chat.activity}</div>}

        {chat.permission && (
          <OpenCodePermissionCard
            request={chat.permission}
            onReply={(reply) => void chat.answerPermission(reply)}
          />
        )}

        {chat.question && (
          <OpenCodeQuestionCard
            key={chat.question.id}
            request={chat.question}
            onReply={(answers) => void chat.answerQuestion(answers)}
            onReject={() => void chat.rejectQuestion()}
          />
        )}

        {chat.error && (
          <div className="opencode-error" role="alert">
            <strong>No se pudo completar la operación</strong>
            <p>{chat.error.message}</p>
            {chat.error.retryable && (
              <button type="button" onClick={() => void chat.retryLastMessage()}>
                Reintentar con el modelo seleccionado
              </button>
            )}
          </div>
        )}
      </div>

      <form
        className="opencode-composer"
        onSubmit={(event) => {
          event.preventDefault()

          if (canSend) {
            chat.sendCurrentMessage()
          }
        }}
      >
        <textarea
          value={chat.composer}
          placeholder="Escribe al editor…"
          aria-label="Mensaje para OpenCode"
          disabled={chat.status.state !== 'connected'}
          onChange={(event) => chat.setComposer(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && canSend) {
              event.preventDefault()
              chat.sendCurrentMessage()
            }
          }}
        />
        <div className="opencode-composer-footer">
          <span>{chat.sessionID ? 'Sesión activa' : 'Nueva sesión al enviar'}</span>
          <button type="submit" disabled={!canSend}>
            {chat.isWorking ? 'Trabajando…' : 'Enviar'}
          </button>
        </div>
      </form>
    </aside>
  )
}
