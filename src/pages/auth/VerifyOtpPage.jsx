import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../../components/layout/AuthLayout'
import { OtpInput } from '../../components/OtpInput'
import { Alert, Button } from '../../components/ui'
import { OTP_LENGTH, PENDING_EMAIL_KEY } from '../../lib/constants'
import { errorMessage } from '../../lib/errors'
import { resendSignupOtp, verifySignupOtp } from '../../services/auth'

const RESEND_DELAY = 60

/** Écran intermédiaire : saisie du code OTP à 6 chiffres reçu par email. */
export default function VerifyOtpPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const email = location.state?.email ?? sessionStorage.getItem(PENDING_EMAIL_KEY)
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [cooldown, setCooldown] = useState(RESEND_DELAY)

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  if (!email) return <Navigate to="/register" replace />

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await verifySignupOtp(email, code)
      sessionStorage.removeItem(PENDING_EMAIL_KEY)
      navigate('/', { replace: true })
    } catch (err) {
      setError(errorMessage(err) ?? 'Code invalide ou expiré.')
      setCode('')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResend = async () => {
    setError(null)
    setInfo(null)
    try {
      await resendSignupOtp(email)
      setInfo('Un nouveau code a été envoyé.')
      setCooldown(RESEND_DELAY)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <AuthLayout
      title="Validation du compte"
      subtitle={
        <>
          Saisissez le code à {OTP_LENGTH} chiffres envoyé à <strong className="text-navy-900">{email}</strong>.
        </>
      }
      footer={
        <Link to="/register" className="font-semibold text-olive-700 hover:underline">
          Modifier mes informations
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <Alert tone="error">{error}</Alert>
        <Alert tone="success">{info}</Alert>
        <OtpInput value={code} onChange={setCode} disabled={submitting} />
        <Button type="submit" size="lg" className="w-full" loading={submitting} disabled={code.length !== OTP_LENGTH}>
          Valider l'inscription
        </Button>
        <Button variant="ghost" className="w-full" onClick={handleResend} disabled={cooldown > 0}>
          {cooldown > 0 ? `Renvoyer le code (${cooldown} s)` : 'Renvoyer le code'}
        </Button>
      </form>
    </AuthLayout>
  )
}
