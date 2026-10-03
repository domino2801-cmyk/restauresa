/**
 * Contexte d'authentification : session Supabase + profil applicatif (rôle,
 * rattachement, validation).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { API_CACHE_NAME } from '../lib/constants'
import { fetchProfile } from '../services/profiles'
import { signOut as signOutRequest } from '../services/auth'
import { AuthContext } from './auth-context'

/** Charge le profil d'un utilisateur sans jamais rejeter. */
async function resolveProfile(userId) {
  try {
    const profile = await fetchProfile(userId)
    return { loadedFor: userId, profile, error: profile ? null : new Error('Profil introuvable.') }
  } catch (error) {
    return { loadedFor: userId, profile: null, error }
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  // Profil chargé pour `loadedFor` (identifiant utilisateur) : évite d'afficher
  // l'interface d'un compte avec le profil d'un autre.
  const [profileState, setProfileState] = useState({ loadedFor: null, profile: null, error: null })

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setSessionLoading(false)
    })
    // Pas de requête Supabase dans ce callback (recommandation supabase-js).
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      if (event === 'SIGNED_OUT') setPasswordRecovery(false)
      // Déconnexion (manuelle ou expiration) : on purge les données mises en
      // cache hors-ligne pour qu'elles ne soient pas servies à un autre utilisateur.
      if (event === 'SIGNED_OUT' && 'caches' in window) caches.delete(API_CACHE_NAME)
      setSession(nextSession)
      setSessionLoading(false)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const userId = session?.user?.id

  const loadProfile = useCallback(async () => {
    if (userId) setProfileState(await resolveProfile(userId))
  }, [userId])

  useEffect(() => {
    if (!userId) return undefined
    let cancelled = false
    resolveProfile(userId).then((state) => !cancelled && setProfileState(state))
    return () => {
      cancelled = true
    }
  }, [userId])

  const signOut = useCallback(async () => {
    await signOutRequest()
  }, [])

  const finishPasswordRecovery = useCallback(() => setPasswordRecovery(false), [])

  const profileReady = !userId || profileState.loadedFor === userId

  const value = useMemo(
    () => ({
      session,
      passwordRecovery,
      finishPasswordRecovery,
      user: session?.user ?? null,
      profile: profileReady ? profileState.profile : null,
      profileError: profileReady ? profileState.error : null,
      loading: sessionLoading || !profileReady,
      refreshProfile: loadProfile,
      signOut,
    }),
    [session, passwordRecovery, finishPasswordRecovery, profileState, profileReady, sessionLoading, loadProfile, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
