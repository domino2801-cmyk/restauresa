import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from '../contexts/auth-context'
import { ProtectedRoute, PublicOnlyRoute, RoleRedirect } from './ProtectedRoute'

function renderAt(path, auth) {
  const value = { session: null, profile: null, profileError: null, loading: false, signOut: vi.fn(), ...auth }
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<p>login</p>} />
          </Route>
          <Route path="/reset-password" element={<p>reset password</p>} />
          <Route path="/pending" element={<p>pending</p>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<RoleRedirect />} />
            <Route path="/reservations" element={<p>reservations</p>} />
            <Route element={<ProtectedRoute roles={['admin']} />}>
              <Route path="/admin" element={<p>admin</p>} />
            </Route>
            <Route element={<ProtectedRoute roles={['adu']} />}>
              <Route path="/adu" element={<p>adu</p>} />
            </Route>
            <Route element={<ProtectedRoute roles={['cdu']} />}>
              <Route path="/cdu" element={<p>cdu</p>} />
            </Route>
            <Route element={<ProtectedRoute roles={['restauration', 'admin']} />}>
              <Route path="/restauration" element={<p>restauration</p>} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

const session = { user: { id: 'u1' } }
const profileFor = (role, is_validated = true) => ({ id: 'u1', full_name: 'Test', role, is_validated })

describe('ProtectedRoute', () => {
  it.each(['/', '/login', '/reservations'])('ouvre la récupération depuis %s sans attendre le profil', (path) => {
    renderAt(path, { session, passwordRecovery: true, loading: true })
    expect(screen.getByText('reset password')).toBeInTheDocument()
  })

  it('redirige vers la connexion sans session', () => {
    renderAt('/admin', {})
    expect(screen.getByText('login')).toBeInTheDocument()
  })

  it('redirige un compte non validé vers la page d’attente', () => {
    renderAt('/reservations', { session, profile: profileFor('user', false) })
    expect(screen.getByText('pending')).toBeInTheDocument()
  })

  it.each([
    ['admin', 'admin'],
    ['adu', 'adu'],
    ['cdu', 'cdu'],
    ['user', 'reservations'],
    ['restauration', 'restauration'],
  ])('oriente le rôle %s vers son tableau de bord', (role, expected) => {
    renderAt('/', { session, profile: profileFor(role) })
    expect(screen.getByText(expected)).toBeInTheDocument()
  })

  it("empêche un militaire d'accéder à l'administration", () => {
    renderAt('/admin', { session, profile: profileFor('user') })
    expect(screen.getByText('reservations')).toBeInTheDocument()
  })

  it("empêche un ADU d'accéder à l'interface CDU", () => {
    renderAt('/cdu', { session, profile: profileFor('adu') })
    expect(screen.getByText('adu')).toBeInTheDocument()
  })

  it.each(['user', 'adu', 'cdu'])('refuse au rôle %s la vue globale restauration', (role) => {
    renderAt('/restauration', { session, profile: profileFor(role) })
    expect(screen.queryByText('restauration')).not.toBeInTheDocument()
    expect(screen.getByText(role === 'user' ? 'reservations' : role)).toBeInTheDocument()
  })

  it('ne donne pas au rôle restauration les droits CDU', () => {
    renderAt('/cdu', { session, profile: profileFor('restauration') })
    expect(screen.getByText('restauration')).toBeInTheDocument()
  })
})
