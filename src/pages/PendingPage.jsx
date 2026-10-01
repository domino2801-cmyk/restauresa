import { Navigate } from 'react-router-dom'
import { AuthLayout } from '../components/layout/AuthLayout'
import { Alert, Button, Spinner } from '../components/ui'
import { useAuth } from '../hooks/useAuth'

/** Compte confirmé mais pas encore validé par un administrateur. */
export default function PendingPage() {
  const { session, profile, loading, refreshProfile, signOut } = useAuth()

  if (loading) return <Spinner className="min-h-screen" />
  if (!session) return <Navigate to="/login" replace />
  if (profile?.is_validated) return <Navigate to="/" replace />

  return (
    <AuthLayout title="Compte en attente" subtitle={profile?.full_name}>
      <div className="space-y-4">
        <Alert tone="info">
          Votre adresse email est confirmée. Votre compte doit maintenant être validé par un administrateur
          avant de pouvoir réserver vos repas.
        </Alert>
        <Button className="w-full" onClick={refreshProfile}>
          Vérifier à nouveau
        </Button>
        <Button variant="outline" className="w-full" onClick={signOut}>
          Se déconnecter
        </Button>
      </div>
    </AuthLayout>
  )
}
