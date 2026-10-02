import { NavLink, Outlet } from 'react-router-dom'

const TABS = [
  { to: '/admin', label: "Vue d'ensemble", end: true },
  { to: '/admin/users', label: 'Utilisateurs' },
  { to: '/admin/organization', label: 'Organisation' },
  { to: '/admin/meals', label: 'Catalogue' },
  { to: '/admin/menus', label: 'Menus de la semaine' },
  { to: '/admin/qr', label: 'QR établissement' },
]

/** Interface Administrateur : sous-navigation par onglets. */
export default function AdminLayout() {
  return (
    <>
      <nav className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-steel-200 px-4" aria-label="Administration">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-t-md px-3 py-2 text-sm font-semibold ${
                isActive ? 'bg-navy-900 text-white' : 'text-steel-700 hover:bg-steel-100'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </>
  )
}
