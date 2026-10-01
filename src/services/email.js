/**
 * Envoi d'emails via l'Edge Function `send-test-email` (Supabase + Resend).
 * La clé Resend reste côté serveur : le navigateur n'appelle que la fonction.
 */
import { supabase } from '../lib/supabase'
import { isEmail } from '../lib/validation'

/**
 * Envoie un email de test (administrateurs uniquement).
 * @param {string} [to] destinataire ; vide = destinataire par défaut du serveur
 *   (`RESEND_TEST_RECIPIENT`, sinon l'email de l'administrateur connecté).
 * @returns {Promise<{ id: string, to: string }>}
 */
export async function sendTestEmail(to = '') {
  const recipient = to.trim()
  if (recipient && !isEmail(recipient)) throw new Error('Adresse email invalide.')

  const { data, error } = await supabase.functions.invoke('send-test-email', {
    body: recipient ? { to: recipient } : {},
  })
  if (error) {
    // Erreur HTTP de la fonction : on remonte son message lisible s'il existe.
    const body = await error.context?.json?.().catch(() => null)
    throw new Error(body?.error || "Échec de l'envoi de l'email de test.")
  }
  return data
}
