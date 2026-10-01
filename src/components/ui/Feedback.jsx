const ALERT_TONES = {
  error: 'border-red-200 bg-red-50 text-red-800',
  success: 'border-olive-300 bg-olive-50 text-olive-800',
  info: 'border-navy-200 bg-navy-50 text-navy-800',
  warning: 'border-khaki-300 bg-khaki-100 text-steel-800',
}

/** Message d'information / d'erreur. */
export function Alert({ tone = 'info', children, className = '' }) {
  if (!children) return null
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-md border px-3 py-2 text-sm ${ALERT_TONES[tone]} ${className}`}>
      {children}
    </div>
  )
}

/** Indicateur de chargement. */
export function Spinner({ label = 'Chargement…', className = '' }) {
  return (
    <div role="status" className={`flex items-center justify-center gap-3 py-8 text-steel-600 ${className}`}>
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-navy-900 border-t-transparent" aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

const BADGE_TONES = {
  navy: 'bg-navy-100 text-navy-800',
  olive: 'bg-olive-100 text-olive-800',
  khaki: 'bg-khaki-100 text-khaki-600',
  steel: 'bg-steel-100 text-steel-700',
  red: 'bg-red-100 text-red-800',
}

/** Pastille de statut. */
export function Badge({ tone = 'steel', children }) {
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  )
}

/** État vide. */
export function EmptyState({ children }) {
  return <p className="py-6 text-center text-sm text-steel-600">{children}</p>
}
