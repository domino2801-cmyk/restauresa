/** En-tête de page (titre, sous-titre, actions). */
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-wide text-navy-900 uppercase sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-steel-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
