import type { OpenCodePermissionRequest } from '../types/inkforge'

interface OpenCodePermissionCardProps {
  request: OpenCodePermissionRequest
  onReply: (reply: 'once' | 'always' | 'reject') => void
}

export function OpenCodePermissionCard({ request, onReply }: OpenCodePermissionCardProps) {
  return (
    <section className="opencode-request" aria-label="Permiso solicitado por OpenCode">
      <span className="eyebrow">Permiso requerido</span>
      <h3>{request.action}</h3>
      {request.resources.length > 0 && (
        <ul className="opencode-resource-list">
          {request.resources.map((resource) => <li key={resource}>{resource}</li>)}
        </ul>
      )}
      <div className="opencode-request-actions">
        <button type="button" onClick={() => onReply('reject')}>Rechazar</button>
        <button type="button" onClick={() => onReply('once')}>Permitir una vez</button>
        <button type="button" className="request-primary" onClick={() => onReply('always')}>
          Permitir siempre
        </button>
      </div>
    </section>
  )
}
