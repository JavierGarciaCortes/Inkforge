import { useTranslation } from 'react-i18next'
import type { OpenCodeConnectionState } from '../types/inkforge'

interface AppHeaderProps {
  onHelp: () => void
  onSettings: () => void
  connectionState: OpenCodeConnectionState
}

export function AppHeader({ onHelp, onSettings, connectionState }: AppHeaderProps) {
  const { t } = useTranslation()
  const indicator = connectionState === 'connected'
    ? 'connected'
    : connectionState === 'starting' ? 'connecting' : 'error'
  const connectionLabel = t(`header.connection.${indicator}`)
  const connectionContext = t('header.connectionContext', { status: connectionLabel })

  return (
    <header className="app-header">
      <div className="brand-block">
        <div>
          <strong>Inkforge</strong>
          <span>{t('header.tagline')}</span>
        </div>
      </div>

      <div className="header-actions">
        <span className="desktop-status" role="status" aria-label={connectionContext} title={connectionContext}>
          <span className={`status-dot status-dot-${indicator}`} aria-hidden="true" />
          {connectionLabel}
        </span>
        <button className="icon-button" type="button" title={t('header.openHelp')} onClick={onHelp}>
          <span aria-hidden="true">?</span>
          <span className="sr-only">{t('header.help')}</span>
        </button>
        <button className="icon-button" type="button" title={t('header.settings')} onClick={onSettings} aria-haspopup="dialog">
          <span aria-hidden="true">&#9881;</span>
          <span className="sr-only">{t('header.settings')}</span>
        </button>
      </div>
    </header>
  )
}
