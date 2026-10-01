import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../../components/layout/AuthLayout'
import { Alert, Button, Input } from '../../components/ui'
import { errorMessage } from '../../lib/errors'
import { isEmail, requestPasswordReset } from '../../services/auth'

/** Récupération du mot de passe : envoi d'un lien de réinitialisation par email. */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!isEmail(email)) {
      setError('Adresse email invalide.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Mot de passe oublié"
      subtitle="Indiquez l'adresse mail personnelle utilisée lors de l'inscription."
      footer={
        <Link to="/login" className="font-semibold text-olive-700 hover:underline">
          Retour à la connexion
        </Link>
      }
    >
      {sent ? (
        <Alert tone="success">
          Si un compte est associé à cette adresse, un email contenant un lien de réinitialisation vient d'être envoyé.
        </Alert>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Alert tone="error">{error}</Alert>
          <Input
            label="Adresse mail personnelle"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" size="lg" className="w-full" loading={submitting}>
            Envoyer le lien
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
