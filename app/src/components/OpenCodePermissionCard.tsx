import { useTranslation } from 'react-i18next'
import type { OpenCodePermissionRequest } from '../types/inkforge'

interface OpenCodePermissionCardProps {
  request: OpenCodePermissionRequest
  onReply: (reply: 'once' | 'always' | 'reject') => void
}

export function OpenCodePermissionCard({ request, onReply }: OpenCodePermissionCardProps) {
  const { t } = useTranslation()

  return (
    <section className="opencode-request" aria-label={t('permission.ariaLabel')}>
      <span className="eyebrow">{t('permission.required')}</span>
      <h3>{request.action}</h3>
      {request.resources.length > 0 && (
        <ul className="opencode-resource-list">
          {request.resources.map((resource) => <li key={resource}>{resource}</li>)}
        </ul>
      )}
      <div className="opencode-request-actions">
        <button type="button" onClick={() => onReply('reject')}>{t('permission.reject')}</button>
        <button type="button" onClick={() => onReply('once')}>{t('permission.allowOnce')}</button>
        <button type="button" className="request-primary" onClick={() => onReply('always')}>
          {t('permission.allowAlways')}
        </button>
      </div>
    </section>
  )
}
