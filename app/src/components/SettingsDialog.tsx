import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { changeLocale, isSupportedLocale, LOCALE_LABELS, SUPPORTED_LOCALES } from '../i18n'
import { changeTheme, getThemePreference, isThemePreference, subscribeTheme } from '../storage/theme-preference'

interface SettingsDialogProps {
  children: ReactNode
  onClose: () => void
  modelNotice: string | null
}

export function SettingsDialog({ children, onClose, modelNotice }: SettingsDialogProps) {
  const { t, i18n } = useTranslation()
  const theme = useSyncExternalStore(subscribeTheme, getThemePreference)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    const previousFocus = document.activeElement
    dialog?.showModal()
    return () => {
      dialog?.close()
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true })
      }
    }
  }, [])

  return createPortal(
    <dialog
      ref={dialogRef}
      className="confirm-dialog settings-dialog"
      aria-labelledby="settings-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <h2 id="settings-dialog-title">{t('header.settings')}</h2>
      <section className="settings-section" aria-labelledby="settings-general">
      <h3 id="settings-general">{t('settings.general')}</h3>
      <div className="opencode-controls">
        <label>
          <span>{t('header.language')}</span>
          <select
            value={i18n.language}
            onChange={(event) => {
              if (isSupportedLocale(event.target.value)) {
                void changeLocale(event.target.value)
              }
            }}
          >
            {SUPPORTED_LOCALES.map((locale) => (
              <option key={locale} value={locale}>{LOCALE_LABELS[locale]}</option>
            ))}
          </select>
        </label>
      </div>
      </section>
      <section className="settings-section" aria-labelledby="settings-appearance">
        <h3 id="settings-appearance">{t('settings.appearance')}</h3>
        <div className="opencode-controls">
          <label>
            <span>{t('settings.theme')}</span>
            <select value={theme} onChange={(event) => {
              if (isThemePreference(event.target.value)) changeTheme(event.target.value)
            }}>
              <option value="system">{t('settings.system')}</option>
              <option value="dark">{t('settings.dark')}</option>
              <option value="light">{t('settings.light')}</option>
            </select>
          </label>
        </div>
      </section>
      <section className="settings-section" aria-labelledby="settings-director">
        <h3 id="settings-director">{t('settings.director')}</h3>
        {modelNotice && <p className="settings-notice" role="status">{modelNotice}</p>}
        {children}
      </section>
      <div className="confirm-dialog-actions">
        <button className="dialog-button dialog-button-secondary" type="button" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </dialog>,
    document.body,
  )
}
