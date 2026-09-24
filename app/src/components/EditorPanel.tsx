import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useOpenCode } from '../hooks/useOpenCode'
import { OpenCodePermissionCard } from './OpenCodePermissionCard'
import { OpenCodeQuestionCard } from './OpenCodeQuestionCard'

export function EditorPanel() {
  const { t } = useTranslation()
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
    <aside className="editor-panel opencode-panel" aria-label={t('editor.ariaLabel')}>
      <div className="panel-heading editor-heading">
        <span className="eyebrow">OpenCode</span>
        <span className={`connection-state connection-${chat.status.state}`}>
          {t(`editor.status.${chat.status.state}`)}
        </span>
      </div>

      <div className="opencode-controls">
        <label>
          <span>{t('editor.model')}</span>
          <select
            value={chat.selectedModelKey}
            disabled={chat.status.state !== 'connected' || chat.models.length === 0}
            onChange={(event) => void chat.chooseModel(event.target.value)}
          >
            {chat.models.length === 0
              ? <option value="">{t('editor.noModels')}</option>
              : <option value="">{t('editor.selectModel')}</option>}
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
            <span>{t('editor.variant')}</span>
            <select
              value={chat.selectedVariant}
              disabled={chat.status.state !== 'connected'}
              onChange={(event) => void chat.chooseVariant(event.target.value)}
            >
              <option value="">{t('editor.defaultVariant')}</option>
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
            <h2>{t('editor.assistantTitle')}</h2>
            <p>{t('editor.assistantDescription')}</p>
          </div>
        )}

        {chat.status.state !== 'connected' && (
          <div className="opencode-empty">
            <div className="editor-monogram" aria-hidden="true">O</div>
            <h2>{t(`editor.status.${chat.status.state}`)}</h2>
            <p>{chat.status.message}</p>
            {chat.status.state !== 'starting' && (
              <button type="button" onClick={() => void chat.connect()}>{t('editor.reconnect')}</button>
            )}
          </div>
        )}

        {chat.messages.map((message) => (
          <article
            className={`chat-message chat-message-${message.role}${message.status === 'error' ? ' chat-message-error' : ''}`}
            key={message.id}
          >
            <span>{message.role === 'user' ? t('editor.you') : 'Inkforge'}</span>
            <p>{message.text}</p>
            {message.status === 'error' && <small>{t('editor.sendFailed')}</small>}
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
            <strong>{t('editor.operationFailed')}</strong>
            <p>{chat.error.message}</p>
            {chat.error.retryable && (
              <button type="button" onClick={() => void chat.retryLastMessage()}>
                {t('editor.retryModel')}
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
          placeholder={t('editor.composerPlaceholder')}
          aria-label={t('editor.composerAria')}
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
          <span>{chat.sessionID ? t('editor.activeSession') : t('editor.newSession')}</span>
          <button type="submit" disabled={!canSend}>
            {chat.isWorking ? t('editor.working') : t('editor.send')}
          </button>
        </div>
      </form>
    </aside>
  )
}
