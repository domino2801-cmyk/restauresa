import { Navigate } from 'react-router-dom'
import { AuthLayout } from '../components/layout/AuthLayout'
import { Alert, Button, Spinner } from '../components/ui'
import { useAuth } from '../hooks/useAuth'

/** Accès indisponible si l'activation n'est pas effective ou a été retirée. */
export default function PendingPage() {
  const { session, profile, loading, refreshProfile, signOut } = useAuth()

  if (loading) return <Spinner className="min-h-screen" />
  if (!session) return <Navigate to="/login" replace />
  if (profile?.is_validated) return <Navigate to="/" replace />

  return (
    <AuthLayout title="Accès au compte indisponible" subtitle={profile?.full_name}>
      <div className="space-y-4">
        <Alert tone="info">
          Votre compte est activé automatiquement après confirmation de votre adresse email.
          Cliquez sur « Vérifier à nouveau » pour actualiser votre accès.
          Si l’accès reste indisponible, contactez un administrateur.
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
