/** Conteneur blanc à bordure fine. */
export function Card({ title, actions, children, className = '' }) {
  return (
    <section className={`rounded-lg border border-steel-200 bg-white shadow-sm ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-steel-100 px-4 py-3">
          {title && <h2 className="text-sm font-bold tracking-wider text-navy-900 uppercase">{title}</h2>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}

/** Indicateur clé (KPI). */
export function StatCard({ label, value, hint, tone = 'navy' }) {
  const accents = {
    navy: 'border-l-navy-900',
    olive: 'border-l-olive-700',
    khaki: 'border-l-khaki-400',
    red: 'border-l-red-700',
  }
  return (
    <div className={`rounded-lg border border-steel-200 border-l-4 bg-white p-4 shadow-sm ${accents[tone]}`}>
      <p className="text-xs font-semibold tracking-wider text-steel-600 uppercase">{label}</p>
      <p className="mt-1 text-2xl font-bold text-navy-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-steel-600">{hint}</p>}
    </div>
  )
}
