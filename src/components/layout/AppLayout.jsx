import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { ROLE_LABELS, ROLES } from '../../lib/constants'
import { Logo } from './Logo'

/** Liens de navigation disponibles par rôle. */
const NAV_BY_ROLE = {
  [ROLES.ADMIN]: [
    { to: '/admin', label: 'Administration' },
    { to: '/reservations', label: 'Mes repas' },
  ],
  [ROLES.ADU]: [
    { to: '/adu', label: 'Ma compagnie' },
    { to: '/reservations', label: 'Mes repas' },
  ],
  [ROLES.CDU]: [
    { to: '/cdu', label: 'Supervision' },
    { to: '/reservations', label: 'Mes repas' },
  ],
  [ROLES.USER]: [{ to: '/reservations', label: 'Mes repas' }],
}

const linkClass = ({ isActive }) =>
  `whitespace-nowrap border-b-2 px-3 py-3 text-xs font-semibold tracking-wider uppercase transition-colors ${
    isActive ? 'border-khaki-400 text-white' : 'border-transparent text-navy-200 hover:text-white'
  }`

/** Mise en page de l'application connectée : bandeau, navigation, contenu. */
export function AppLayout() {
  const { profile, signOut } = useAuth()
  const links = NAV_BY_ROLE[profile.role] ?? NAV_BY_ROLE[ROLES.USER]
  const unit = [profile.company?.name, profile.section?.name].filter(Boolean).join(' · ')

  return (
    <div className="min-h-screen pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-20 bg-navy-900 text-white shadow-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2">
          <div className="flex min-w-0 items-center gap-3">
            <Logo className="h-9 w-9 shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-[0.15em] uppercase">RestauResa</p>
              <p className="truncate text-xs text-khaki-300">{ROLE_LABELS[profile.role]}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold">{profile.full_name}</p>
              {unit && <p className="text-xs text-navy-200">{unit}</p>}
            </div>
            <button
              type="button"
              onClick={signOut}
              className="rounded-md border border-navy-500 px-3 py-1.5 text-xs font-semibold tracking-wider uppercase hover:bg-navy-700"
            >
              Déconnexion
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl overflow-x-auto px-2" aria-label="Navigation principale">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className={linkClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="h-1 bg-olive-700" />
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
