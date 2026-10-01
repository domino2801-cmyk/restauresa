import { Link } from 'react-router-dom'
import { AuthLayout } from '../components/layout/AuthLayout'

export default function NotFoundPage() {
  return (
    <AuthLayout title="Page introuvable">
      <Link to="/" className="font-semibold text-olive-700 hover:underline">
        Retour à l'accueil
      </Link>
    </AuthLayout>
  )
}
