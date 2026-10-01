// Edge Function : envoi d'un email de test via Resend (https://resend.com).
//
// Réservée aux administrateurs validés : l'appelant est identifié par son JWT
// Supabase, puis son profil est vérifié. La clé Resend reste côté serveur
// (secret `RESEND_API_KEY`) et n'est jamais exposée au navigateur.
//
// Secrets (supabase secrets set … ou supabase/functions/.env en local) :
//   RESEND_API_KEY         clé API Resend (obligatoire)
//   RESEND_FROM            expéditeur, ex. "RestauResa <noreply@votre-domaine.fr>"
//                          (défaut : "RestauResa <onboarding@resend.dev>", domaine de test Resend)
//   RESEND_TEST_RECIPIENT  destinataire par défaut si aucun n'est fourni
//                          (défaut : l'email de l'administrateur connecté)
//
// Déploiement : supabase functions deploy send-test-email
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DEFAULT_FROM = 'RestauResa <onboarding@resend.dev>'
const RESEND_URL = 'https://api.resend.com/emails'

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => HTML_ENTITIES[c])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) return json({ error: "RESEND_API_KEY n'est pas configurée sur le serveur." }, 500)

  const authorization = req.headers.get('Authorization')
  if (!authorization) return json({ error: 'Authentification requise.' }, 401)

  // Client agissant au nom de l'appelant : la RLS limite la lecture à son propre profil.
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError || !userData.user) return json({ error: 'Authentification requise.' }, 401)

  const { data: profile } = await client
    .from('profiles')
    .select('full_name, email, role, is_validated')
    .eq('id', userData.user.id)
    .maybeSingle()
  if (!profile || profile.role !== 'admin' || !profile.is_validated) {
    return json({ error: 'Accès réservé aux administrateurs.' }, 403)
  }

  let to: unknown
  try {
    ;({ to } = await req.json())
  } catch {
    to = undefined
  }
  if (to === undefined || to === null || (typeof to === 'string' && to.trim() === '')) {
    to = Deno.env.get('RESEND_TEST_RECIPIENT') || profile.email
  }
  if (typeof to !== 'string' || to.length > 254 || !EMAIL_RE.test(to.trim())) {
    return json({ error: 'Adresse email du destinataire invalide.' }, 400)
  }
  const recipient = to.trim()

  const sentAt = new Date().toISOString()
  const requester = String(profile.full_name ?? '')
  const response = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: Deno.env.get('RESEND_FROM') || DEFAULT_FROM,
      to: [recipient],
      subject: 'RestauResa — Email de test',
      text:
        "Cet email de test confirme que l'envoi via Supabase + Resend fonctionne.\n" +
        `Demandé par : ${requester}\nDate : ${sentAt}`,
      html:
        "<p>Cet email de test confirme que l'envoi via <strong>Supabase + Resend</strong> fonctionne.</p>" +
        `<p>Demandé par : ${escapeHtml(requester)}<br />Date : ${sentAt}</p>`,
    }),
  })

  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const reason = typeof result?.message === 'string' ? result.message : response.statusText
    return json({ error: `Échec de l'envoi via Resend : ${reason}` }, 502)
  }
  return json({ id: result.id, to: recipient })
})
