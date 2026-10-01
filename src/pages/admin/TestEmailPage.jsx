import { useState } from 'react'
import { Alert, Button, Card, Input, PageHeader } from '../../components/ui'
import { errorMessage } from '../../lib/errors'
import { isEmail } from '../../lib/validation'
import { sendTestEmail } from '../../services/email'

/** Envoi d'un email de test pour vérifier l'intégration Supabase + Resend. */
export default function TestEmailPage() {
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const invalid = to.trim() !== '' && !isEmail(to)

  const submit = async (event) => {
    event.preventDefault()
    if (invalid) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const result = await sendTestEmail(to)
      setSuccess(`Email de test envoyé à ${result?.to ?? to.trim()}.`)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Email de test" subtitle="Vérifier l'envoi d'emails (Supabase + Resend)" />
      <Card>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Input
            label="Destinataire"
            type="email"
            placeholder="vous@exemple.fr"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            error={invalid ? 'Adresse email invalide.' : undefined}
            hint="Laisser vide pour utiliser le destinataire par défaut (RESEND_TEST_RECIPIENT ou votre email)."
          />
          <Alert tone="error">{error}</Alert>
          <Alert tone="success">{success}</Alert>
          <Button type="submit" loading={busy} disabled={invalid}>
            Envoyer l'email de test
          </Button>
        </form>
      </Card>
    </>
  )
}
