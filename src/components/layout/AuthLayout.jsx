import { Logo } from './Logo'

/** Mise en page des écrans d'authentification (mobile-first). */
export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen flex-col bg-navy-900 sm:items-center sm:justify-center sm:p-6">
      <div className="flex items-center gap-3 px-6 pt-10 pb-6 text-white sm:pt-0">
        <Logo className="h-12 w-12" />
        <div>
          <p className="text-lg font-bold tracking-[0.2em] uppercase">RestauResa</p>
          <p className="text-xs tracking-wider text-khaki-300 uppercase">Réservation des repas</p>
        </div>
      </div>
      <main className="flex-1 rounded-t-2xl border-t-4 border-olive-700 bg-white px-6 py-8 shadow-xl sm:w-full sm:max-w-md sm:flex-none sm:rounded-lg">
        <h1 className="text-lg font-bold tracking-wide text-navy-900 uppercase">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-steel-600">{subtitle}</p>}
        <div className="mt-6">{children}</div>
        {footer && <div className="mt-6 border-t border-steel-100 pt-4 text-center text-sm">{footer}</div>}
      </main>
    </div>
  )
}
