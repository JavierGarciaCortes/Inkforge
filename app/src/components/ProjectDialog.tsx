import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { CreateProjectInput, InkforgeProjectType } from '../types/inkforge'

interface ProjectDialogProps {
  isCreating: boolean
  error: string | null
  onCancel: () => void
  onCreate: (input: CreateProjectInput) => void
}

export function ProjectDialog({
  isCreating,
  error,
  onCancel,
  onCreate,
}: ProjectDialogProps) {
  const titleInputRef = useRef<HTMLInputElement>(null)
  const [type, setType] = useState<InkforgeProjectType>('novela')
  const [narrativeTitle, setNarrativeTitle] = useState('')
  const [firstBookTitle, setFirstBookTitle] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    titleInputRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isCreating) {
        onCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isCreating, onCancel])

  const submitProject = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (narrativeTitle.trim().length === 0) {
      setValidationError(
        type === 'saga'
          ? 'Escribe un título para la saga.'
          : 'Escribe un título para el libro.',
      )
      return
    }

    if (type === 'saga' && firstBookTitle.trim().length === 0) {
      setValidationError('Escribe el título del primer libro.')
      return
    }

    setValidationError(null)
    onCreate(type === 'saga'
      ? {
          type: 'saga',
          sagaTitle: narrativeTitle,
          firstBookTitle,
        }
      : {
          type: 'novela',
          bookTitle: narrativeTitle,
        })
  }

  return (
    <div
      className="dialog-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isCreating) {
          onCancel()
        }
      }}
    >
      <form
        className="confirm-dialog project-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-dialog-title"
        onSubmit={submitProject}
      >
        <span className="eyebrow">Biblioteca</span>
        <h2 id="project-dialog-title">Nueva obra</h2>

        <label className="project-dialog-field">
          <span>Tipo de obra</span>
          <select
            value={type}
            disabled={isCreating}
            onChange={(event) => {
              setType(event.target.value as InkforgeProjectType)
              setValidationError(null)
            }}
          >
            <option value="novela">Novela independiente</option>
            <option value="saga">Saga</option>
          </select>
        </label>

        <label className="project-dialog-field">
          <span>{type === 'saga' ? 'Título de la saga' : 'Título del libro'}</span>
          <input
            ref={titleInputRef}
            type="text"
            value={narrativeTitle}
            disabled={isCreating}
            autoComplete="off"
            onChange={(event) => {
              setNarrativeTitle(event.target.value)
              setValidationError(null)
            }}
          />
        </label>

        {type === 'saga' && (
          <label className="project-dialog-field">
            <span>Título del primer libro</span>
            <input
              type="text"
              value={firstBookTitle}
              disabled={isCreating}
              autoComplete="off"
              onChange={(event) => {
                setFirstBookTitle(event.target.value)
                setValidationError(null)
              }}
            />
          </label>
        )}

        {(validationError || error) && (
          <p className="project-dialog-error" role="alert">
            {validationError ?? error}
          </p>
        )}

        <div className="confirm-dialog-actions">
          <button
            className="dialog-button dialog-button-secondary"
            type="button"
            disabled={isCreating}
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            className="dialog-button project-dialog-create"
            type="submit"
            disabled={isCreating}
          >
            {isCreating ? 'Creando…' : 'Crear'}
          </button>
        </div>
      </form>
    </div>
  )
}
