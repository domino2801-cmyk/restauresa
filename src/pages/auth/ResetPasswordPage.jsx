import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../../components/layout/AuthLayout'
import { Alert, Button, Input, Spinner } from '../../components/ui'
import { useAuth } from '../../hooks/useAuth'
import { MIN_PASSWORD_LENGTH } from '../../lib/constants'
import { errorMessage } from '../../lib/errors'
import { updatePassword } from '../../services/auth'

/**
 * Définition d'un nouveau mot de passe. Le lien reçu par email ouvre une session
 * de récupération (détectée automatiquement par supabase-js).
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const { session, loading, finishPasswordRecovery } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`)
      return
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await updatePassword(password)
      finishPasswordRecovery()
      navigate('/', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Nouveau mot de passe"
      footer={
        <Link to="/login" className="font-semibold text-olive-700 hover:underline">
          Retour à la connexion
        </Link>
      }
    >
      {loading ? (
        <Spinner />
      ) : !session ? (
        <Alert tone="warning">
          Lien invalide ou expiré. Refaites une demande depuis « Mot de passe oublié ».
        </Alert>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Alert tone="error">{error}</Alert>
          <Input
            label="Nouveau mot de passe"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            label="Confirmation"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <Button type="submit" size="lg" className="w-full" loading={submitting}>
            Enregistrer
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
