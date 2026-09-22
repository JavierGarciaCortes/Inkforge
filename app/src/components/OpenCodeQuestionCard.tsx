import { useState } from 'react'
import type { OpenCodeQuestionRequest } from '../types/inkforge'

interface OpenCodeQuestionCardProps {
  request: OpenCodeQuestionRequest
  onReply: (answers: string[][]) => void
  onReject: () => void
}

export function OpenCodeQuestionCard({
  request,
  onReply,
  onReject,
}: OpenCodeQuestionCardProps) {
  const [answers, setAnswers] = useState<string[][]>(() => request.questions.map(() => []))
  const [customAnswers, setCustomAnswers] = useState<string[]>(() => request.questions.map(() => ''))

  const selectOption = (questionIndex: number, label: string, multiple: boolean) => {
    setAnswers((current) => current.map((answer, index) => {
      if (index !== questionIndex) {
        return answer
      }

      if (!multiple) {
        return [label]
      }

      return answer.includes(label)
        ? answer.filter((item) => item !== label)
        : [...answer, label]
    }))
  }

  const resolvedAnswers = answers.map((answer, index) => {
    const customAnswer = customAnswers[index]?.trim()
    return customAnswer ? [...answer, customAnswer] : answer
  })
  const canSubmit = request.questions.length > 0 && resolvedAnswers.every((answer) => answer.length > 0)

  return (
    <section className="opencode-request" aria-label="Pregunta de OpenCode">
      <span className="eyebrow">OpenCode pregunta</span>
      {request.questions.map((question, questionIndex) => (
        <fieldset className="opencode-question" key={`${question.header}-${questionIndex}`}>
          <legend>{question.header}</legend>
          <p>{question.question}</p>
          <div className="opencode-options">
            {question.options.map((option) => (
              <label key={option.label}>
                <input
                  type={question.multiple ? 'checkbox' : 'radio'}
                  name={`question-${request.id}-${questionIndex}`}
                  checked={answers[questionIndex]?.includes(option.label) ?? false}
                  onChange={() => selectOption(questionIndex, option.label, question.multiple)}
                />
                <span>
                  <strong>{option.label}</strong>
                  {option.description && <small>{option.description}</small>}
                </span>
              </label>
            ))}
          </div>
          {question.custom && (
            <input
              className="opencode-custom-answer"
              type="text"
              value={customAnswers[questionIndex] ?? ''}
              placeholder="Respuesta personalizada"
              onChange={(event) => {
                const value = event.target.value
                setCustomAnswers((current) => current.map((answer, index) => (
                  index === questionIndex ? value : answer
                )))
              }}
            />
          )}
        </fieldset>
      ))}
      <div className="opencode-request-actions">
        <button type="button" onClick={onReject}>Cancelar</button>
        <button
          type="button"
          className="request-primary"
          disabled={!canSubmit}
          onClick={() => onReply(resolvedAnswers)}
        >
          Responder
        </button>
      </div>
    </section>
  )
}
