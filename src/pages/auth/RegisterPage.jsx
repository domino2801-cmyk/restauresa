import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../../components/layout/AuthLayout'
import { OrgSelectors } from '../../components/OrgSelectors'
import { Alert, Button, Input, Spinner } from '../../components/ui'
import { useOrganization } from '../../hooks/useOrganization'
import { MIN_PASSWORD_LENGTH, PENDING_EMAIL_KEY } from '../../lib/constants'
import { errorMessage } from '../../lib/errors'
import { signUp } from '../../services/auth'
import { validateRegistration } from '../../lib/validation'

/** Écran de création de compte. À la soumission, un code OTP est envoyé par email. */
export default function RegisterPage() {
  const navigate = useNavigate()
  const { org, loading, error: orgError } = useOrganization()
  const [form, setForm] = useState({
    regiment_id: null,
    company_id: null,
    section_id: null,
    fullName: '',
    email: '',
    password: '',
    confirm: '',
  })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const setField = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    const fieldErrors = validateRegistration(form)
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return

    setError(null)
    setSubmitting(true)
    try {
      await signUp({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        regimentId: form.regiment_id,
        companyId: form.company_id,
        sectionId: form.section_id,
      })
      sessionStorage.setItem(PENDING_EMAIL_KEY, form.email.trim())
      navigate('/verify', { state: { email: form.email.trim() } })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Création de compte"
      subtitle="Un code vous sera envoyé par email. Sa confirmation activera automatiquement votre compte."
      footer={
        <>
          Déjà inscrit ?{' '}
          <Link to="/login" className="font-semibold text-olive-700 hover:underline">
            Se connecter
          </Link>
        </>
      }
    >
      {loading ? (
        <Spinner />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Alert tone="error">{error ?? errorMessage(orgError)}</Alert>
          <fieldset className="space-y-4 rounded-md border border-steel-200 p-4">
            <legend className="px-1 text-xs font-bold tracking-wider text-olive-700 uppercase">Affectation</legend>
            <OrgSelectors
              org={org}
              value={form}
              required
              errors={errors}
              onChange={(next) => setForm((f) => ({ ...f, ...next }))}
            />
          </fieldset>
          <fieldset className="space-y-4 rounded-md border border-steel-200 p-4">
            <legend className="px-1 text-xs font-bold tracking-wider text-olive-700 uppercase">Identité</legend>
            <Input
              label="Nom"
              autoComplete="family-name"
              required
              maxLength={120}
              value={form.fullName}
              error={errors.fullName}
              onChange={setField('fullName')}
            />
            <Input
              label="Adresse mail personnelle"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              error={errors.email}
              onChange={setField('email')}
            />
            <Input
              label="Mot de passe"
              type="password"
              autoComplete="new-password"
              required
              value={form.password}
              error={errors.password}
              hint={`${MIN_PASSWORD_LENGTH} caractères minimum.`}
              onChange={setField('password')}
            />
            <Input
              label="Confirmation du mot de passe"
              type="password"
              autoComplete="new-password"
              required
              value={form.confirm}
              error={errors.confirm}
              onChange={setField('confirm')}
            />
          </fieldset>
          <Button type="submit" size="lg" className="w-full" loading={submitting}>
            Créer mon compte
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
