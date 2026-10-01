import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../../components/layout/AuthLayout'
import { Alert, Button, Input } from '../../components/ui'
import { errorMessage } from '../../lib/errors'
import { signIn } from '../../services/auth'

/** Écran de connexion : Nom (ou email) + mot de passe. */
export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signIn(identifier, password)
      navigate(location.state?.from ?? '/', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Connexion"
      subtitle="Accédez à vos réservations de repas."
      footer={
        <>
          Pas encore de compte ?{' '}
          <Link to="/register" className="font-semibold text-olive-700 hover:underline">
            Créer un compte
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Alert tone="error">{error}</Alert>
        <Input
          label="Nom ou email"
          name="identifier"
          autoComplete="username"
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
        <Input
          label="Mot de passe"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" className="w-full" size="lg" loading={submitting} disabled={!identifier || !password}>
          Se connecter
        </Button>
        <Link
          to="/forgot-password"
          className="block w-full rounded-md border border-khaki-400 py-2.5 text-center text-sm font-semibold text-navy-900 hover:bg-khaki-100"
        >
          Mot de passe oublié ?
        </Link>
      </form>
    </AuthLayout>
  )
}
