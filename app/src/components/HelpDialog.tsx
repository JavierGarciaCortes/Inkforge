import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface HelpDialogProps {
  onClose: () => void
}

const STANDALONE_STRUCTURE = `Proyecto/
  Proyecto.md
  Mundo/
  Estilo/
  Referencias/
  Capítulos/
  Planificación/
    Cronología.md
    Escaleta.md
    Estado.md
    Foreshadowing.md
    Fundamentos.md
    Guía editorial.md
    Índice.md
    Léxico.md
    Outliner.md
    Pendientes.md
    Trama.md
  Canon/
    Canon de libro.md
  Notas/
  Recursos/`

const SAGA_STRUCTURE = `Saga/
  Proyecto.md
  Mundo/
  Estilo/
  Referencias/
  Libros/
    01 - Primer libro/
      Libro.md
      Capítulos/
      Planificación/
        Cronología.md
        Escaleta.md
        Estado.md
        Foreshadowing.md
        Fundamentos.md
        Guía editorial.md
        Índice.md
        Léxico.md
        Outliner.md
        Pendientes.md
        Trama.md
      Canon/
        Canon de libro.md
      Notas/
      Recursos/`

export function HelpDialog({ onClose }: HelpDialogProps) {
  const { t } = useTranslation()
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeButtonRef.current?.focus({ preventScroll: true })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="dialog-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section
        className="confirm-dialog help-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-dialog-title"
        aria-describedby="help-dialog-intro"
      >
        <span className="eyebrow">{t('help.eyebrow')}</span>
        <h2 id="help-dialog-title">{t('help.title')}</h2>
        <p id="help-dialog-intro">{t('help.intro')}</p>

        <div className="help-dialog-content">
          <section className="help-section">
            <h3>{t('help.library.title')}</h3>
            <ul className="help-list">
              <li>{t('help.library.works')}</li>
              <li>{t('help.library.active')}</li>
            </ul>
          </section>

          <section className="help-section">
            <h3>{t('help.projectTypes.title')}</h3>
            <ul className="help-list">
              <li>{t('help.projectTypes.standalone')}</li>
              <li>{t('help.projectTypes.saga')}</li>
              <li>{t('help.projectTypes.visibility')}</li>
            </ul>
          </section>

          <section className="help-section">
            <h3>{t('help.manage.title')}</h3>
            <ul className="help-list">
              <li>{t('help.manage.standalone')}</li>
              <li>{t('help.manage.saga')}</li>
              <li>{t('help.manage.advanced')}</li>
              <li>{t('help.manage.destructive')}</li>
              <li>{t('help.manage.extraction')}</li>
              <li>{t('help.manage.navigation')}</li>
            </ul>
          </section>

          <section className="help-section">
            <h3>{t('help.genres.title')}</h3>
            <ul className="help-list">
              <li>{t('help.genres.selection')}</li>
              <li>{t('help.genres.inheritance')}</li>
              <li>{t('help.genres.guidance')}</li>
            </ul>
          </section>

          <section className="help-section">
            <h3>{t('help.editing.title')}</h3>
            <ul className="help-list">
              <li>{t('help.editing.open')}</li>
              <li>{t('help.editing.save')}</li>
              <li>{t('help.editing.noAutosave')}</li>
            </ul>
          </section>

          <section className="help-section">
            <h3>{t('help.safety.title')}</h3>
            <ul className="help-list">
              <li>{t('help.safety.conflict')}</li>
              <li>{t('help.safety.missing')}</li>
              <li>{t('help.safety.tree')}</li>
              <li>{t('help.safety.confirm')}</li>
            </ul>
          </section>

          <section className="help-section">
            <h3>{t('help.ai.title')}</h3>
            <ul className="help-list">
              <li>{t('help.ai.openCode')}</li>
              <li>{t('help.ai.models')}</li>
              <li>{t('help.ai.retry')}</li>
              <li>{t('help.ai.scope')}</li>
              <li>{t('help.ai.identity')}</li>
            </ul>
          </section>

          <section className="help-section">
            <h3>{t('help.language.title')}</h3>
            <ul className="help-list">
              <li>{t('help.language.available')}</li>
              <li>{t('help.language.preservation')}</li>
              <li>{t('help.language.labels')}</li>
            </ul>
          </section>

          <section className="help-section help-import-guide">
            <h3>{t('help.importGuide.title')}</h3>
            <p className="help-notice">{t('help.importGuide.unavailable')}</p>
            <ul className="help-list">
              <li>{t('help.importGuide.compatibility')}</li>
              <li>{t('help.importGuide.generic')}</li>
              <li>{t('help.importGuide.validation')}</li>
              <li>{t('help.importGuide.nonDestructive')}</li>
              <li>{t('help.importGuide.developmentReference')}</li>
            </ul>

            <p>{t('help.importGuide.physicalNames')}</p>
            <div className="help-structure-grid">
              <div>
                <h4>{t('help.importGuide.standaloneTitle')}</h4>
                <pre className="help-structure">{STANDALONE_STRUCTURE}</pre>
              </div>
              <div>
                <h4>{t('help.importGuide.sagaTitle')}</h4>
                <pre className="help-structure">{SAGA_STRUCTURE}</pre>
              </div>
            </div>
          </section>
        </div>

        <div className="confirm-dialog-actions">
          <button
            ref={closeButtonRef}
            className="dialog-button dialog-button-secondary"
            type="button"
            onClick={onClose}
          >
            {t('common.close')}
          </button>
        </div>
      </section>
    </div>
  )
}
