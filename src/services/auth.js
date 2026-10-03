/**
 * Requêtes d'authentification Supabase.
 */
import { supabase } from '../lib/supabase'
import { isEmail } from '../lib/validation'

export { isEmail }

const PRODUCTION_APP_URL = 'https://domino2801-cmyk.github.io/restauresa/'

/**
 * Inscription : crée le compte et déclenche l'envoi du code OTP par email.
 * Les métadonnées servent au trigger SQL `handle_new_user` pour créer le profil.
 */
export async function signUp({ fullName, email, password, regimentId, companyId, sectionId }) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        full_name: fullName.trim(),
        regiment_id: regimentId,
        company_id: companyId,
        section_id: sectionId,
      },
    },
  })
  if (error) throw error
  // Supabase renvoie un utilisateur sans identité si l'email est déjà utilisé.
  if (data.user && data.user.identities?.length === 0) {
    throw new Error('Un compte existe déjà avec cette adresse email.')
  }
  return data
}

/** Valide le code OTP à 6 chiffres reçu par email et ouvre la session. */
export async function verifySignupOtp(email, token) {
  const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: 'email' })
  if (error) throw error
  return data
}

/** Renvoie le code OTP d'inscription. */
export async function resendSignupOtp(email) {
  const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() })
  if (error) throw error
}

/**
 * Connexion par email ou par nom.
 * - email : authentification directe ;
 * - nom   : passe par l'Edge Function `login-by-name` (l'email n'est jamais exposé).
 */
export async function signIn(identifier, password) {
  const id = identifier.trim()
  if (isEmail(id)) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: id, password })
    if (error) throw new Error('Identifiants invalides ou compte non confirmé.')
    return data
  }

  const { data, error } = await supabase.functions.invoke('login-by-name', {
    body: { name: id, password },
  })
  if (error || !data?.access_token) throw new Error('Identifiants invalides ou compte non confirmé.')
  const { data: session, error: sessionError } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  })
  if (sessionError) throw sessionError
  return session
}

/** Envoie l'email de réinitialisation du mot de passe. */
export async function requestPasswordReset(email) {
  const appUrl = window.location.hostname === 'localhost'
    ? PRODUCTION_APP_URL
    : `${window.location.origin}${import.meta.env.BASE_URL}`
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${appUrl}reset-password`,
  })
  if (error) throw error
}

/** Met à jour le mot de passe de l'utilisateur connecté (flux de récupération). */
export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
