import { AuthLayout } from '../components/layout/AuthLayout'
import { Alert } from '../components/ui'

/** Affiché lorsque les variables d'environnement Supabase sont absentes. */
export default function ConfigMissingPage() {
  return (
    <AuthLayout title="Configuration requise">
      <Alert tone="warning">
        Les variables <code>VITE_SUPABASE_URL</code> et <code>VITE_SUPABASE_ANON_KEY</code> ne sont pas définies.
        Copiez <code>.env.example</code> en <code>.env.local</code>, renseignez-les puis relancez l'application.
      </Alert>
    </AuthLayout>
  )
}
