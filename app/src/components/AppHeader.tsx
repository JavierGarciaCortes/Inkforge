import { useTranslation } from 'react-i18next'
import {
  changeLocale,
  isSupportedLocale,
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
} from '../i18n'
import type { InkforgeAppInfo } from '../types/inkforge'

interface AppHeaderProps {
  appInfo: InkforgeAppInfo | null
}

export function AppHeader({ appInfo }: AppHeaderProps) {
  const { t, i18n } = useTranslation()

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
            <span className="status-dot" aria-hidden="true" />
            {t('header.desktopVersion', { name: appInfo.name, version: appInfo.version })}
          </span>
        )}
        <span className="project-state">{t('common.currentVault')}</span>
        <label className="locale-selector">
          <span className="sr-only">{t('header.language')}</span>
          <select
            aria-label={t('header.language')}
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
        <button className="icon-button" type="button" title={t('header.settingsUnavailable')} disabled>
          <span aria-hidden="true">&#9881;</span>
          <span className="sr-only">{t('header.settings')}</span>
        </button>
      </div>
    </header>
  )
}
