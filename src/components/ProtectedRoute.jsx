import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { ROLE_HOME } from '../lib/constants'
import { errorMessage } from '../lib/errors'
import { Alert, Button, Spinner } from './ui'

/**
 * Protège un groupe de routes :
 *  - non connecté        → /login
 *  - compte non validé   → /pending
 *  - rôle non autorisé   → page d'accueil du rôle
 * @param {{ roles?: string[] }} props
 */
export function ProtectedRoute({ roles }) {
  const { session, profile, profileError, loading, signOut, passwordRecovery } = useAuth()
  const location = useLocation()

  if (passwordRecovery) return <Navigate to="/reset-password" replace />
  if (loading) return <Spinner className="min-h-screen" />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (profileError || !profile) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-6">
        <Alert tone="error">{errorMessage(profileError) ?? 'Profil introuvable.'}</Alert>
        <Button variant="outline" onClick={signOut}>
          Se déconnecter
        </Button>
      </div>
    )
  }
  if (!profile.is_validated) return <Navigate to="/pending" replace />
  if (roles && !roles.includes(profile.role)) return <Navigate to={ROLE_HOME[profile.role] ?? '/reservations'} replace />
  return <Outlet />
}

/** Redirige « / » vers l'accueil correspondant au rôle connecté. */
export function RoleRedirect() {
  const { profile } = useAuth()
  return <Navigate to={ROLE_HOME[profile?.role] ?? '/reservations'} replace />
}

/** Routes publiques (connexion, inscription) : redirige si déjà connecté. */
export function PublicOnlyRoute() {
  const { session, loading, passwordRecovery } = useAuth()
  if (passwordRecovery) return <Navigate to="/reset-password" replace />
  if (loading) return <Spinner className="min-h-screen" />
  if (session) return <Navigate to="/" replace />
  return <Outlet />
}
