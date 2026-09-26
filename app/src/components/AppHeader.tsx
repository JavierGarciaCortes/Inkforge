import { useTranslation } from 'react-i18next'
import type { InkforgeAppInfo, OpenCodeConnectionState } from '../types/inkforge'

interface AppHeaderProps {
  appInfo: InkforgeAppInfo | null
  onHelp: () => void
  onSettings: () => void
  connectionState: OpenCodeConnectionState
}

export function AppHeader({ appInfo, onHelp, onSettings, connectionState }: AppHeaderProps) {
  const { t } = useTranslation()
  const indicator = connectionState === 'connected'
    ? 'connected'
    : connectionState === 'starting' ? 'connecting' : 'error'
  const connectionLabel = t(`header.connection.${indicator}`)

  return (
    <header className="app-header">
      <div className="brand-block">
        <span className="brand-mark" aria-hidden="true">I</span>
        <div>
          <strong>Inkforge</strong>
          <span>{t('header.tagline')}</span>
        </div>
      </div>

      <div className="header-actions">
        {appInfo && (
          <span className="desktop-status">
            <span
              className={`status-dot status-dot-${indicator}`}
              role="img"
              aria-label={connectionLabel}
              title={connectionLabel}
            />
            {t('header.desktopVersion', { name: appInfo.name, version: appInfo.version })}
          </span>
        )}
        <span className="project-state">{t('common.library')}</span>
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
