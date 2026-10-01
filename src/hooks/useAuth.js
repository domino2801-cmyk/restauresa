import { useContext } from 'react'
import { AuthContext } from '../contexts/auth-context'

/** Accès au contexte d'authentification (session, profil, déconnexion). */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}
