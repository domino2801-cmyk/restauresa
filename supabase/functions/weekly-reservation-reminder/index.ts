// Edge Function appelée chaque mercredi par le workflow GitHub Actions.
// L'envoi est limité à 09 h, heure de Paris, même si le workflow est déclenché
// aux deux heures UTC possibles lors des changements heure d'été / heure d'hiver.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-weekly-reminder-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const LOGIN_URL = 'https://domino2801-cmyk.github.io/restauresa/login'
const RESEND_URL = 'https://api.resend.com/emails'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => HTML_ENTITIES[character])

function parisDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

function isParisWednesdayAtNine(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return values.weekday === 'Wed' && values.hour === '09'
}

async function listConfirmedValidatedRecipients(admin: ReturnType<typeof createClient>) {
  const authUsers: Array<{ id: string; email?: string; email_confirmed_at?: string | null }> = []
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`Impossible de lire les comptes Auth : ${error.message}`)
    authUsers.push(...data.users)
    if (data.users.length < 1000) break
  }

  const confirmedUsers = authUsers.filter((user) => user.email && user.email_confirmed_at)
  const profiles: Array<{ id: string; full_name: string; is_validated: boolean }> = []
  for (let start = 0; start < confirmedUsers.length; start += 500) {
    const userIds = confirmedUsers.slice(start, start + 500).map((user) => user.id)
    if (userIds.length === 0) continue
    const { data, error } = await admin
      .from('profiles')
      .select('id, full_name, is_validated')
      .eq('is_validated', true)
      .in('id', userIds)
    if (error) throw new Error(`Impossible de lire les profils validés : ${error.message}`)
    profiles.push(...data)
  }

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  return confirmedUsers.flatMap((user) => {
    const profile = profileById.get(user.id)
    const email = user.email?.trim()
    if (!profile || !email || email.length > 254 || !EMAIL_RE.test(email)) return []
    return [{ id: user.id, email, fullName: profile.full_name }]
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405)

  const expectedSecret = Deno.env.get('WEEKLY_REMINDER_SECRET')
  if (!expectedSecret) return json({ error: 'WEEKLY_REMINDER_SECRET n’est pas configuré.' }, 500)
  if (request.headers.get('x-weekly-reminder-secret') !== expectedSecret) {
    return json({ error: 'Authentification invalide.' }, 401)
  }

  if (!isParisWednesdayAtNine(new Date())) {
    return json({ skipped: true, reason: 'Envoi autorisé uniquement le mercredi à 09 h, heure de Paris.' })
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) return json({ error: 'RESEND_API_KEY n’est pas configurée.' }, 500)
  const from = Deno.env.get('RESEND_FROM')
  if (!from) return json({ error: 'RESEND_FROM doit être configuré avec un expéditeur vérifié dans Resend.' }, 500)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Configuration Supabase serveur incomplète.' }, 500)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const sendDate = parisDateKey(new Date())
  let recipients: Awaited<ReturnType<typeof listConfirmedValidatedRecipients>>
  try {
    recipients = await listConfirmedValidatedRecipients(admin)
  } catch (error) {
    console.error('Échec du chargement des destinataires du rappel hebdomadaire.', error)
    return json({ error: 'Impossible de charger les destinataires du rappel.' }, 500)
  }

  let sent = 0
  let failed = 0
  for (const [index, recipient] of recipients.entries()) {
    const safeName = escapeHtml(recipient.fullName)
    try {
      const response = await fetch(RESEND_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `weekly-reminder-${sendDate}-${recipient.id}`,
        },
        body: JSON.stringify({
          from,
          to: [recipient.email],
          subject: 'RestauResa — Réservez vos repas pour la semaine prochaine',
          text:
            `Bonjour ${recipient.fullName},\n\n` +
            'Veuillez réserver vos repas pour la semaine prochaine avant le jeudi à 14 h.\n\n' +
            `Connectez-vous à RestauResa : ${LOGIN_URL}\n\n` +
            'L’équipe RestauResa',
          html:
            `<p>Bonjour ${safeName},</p>` +
            '<p>Veuillez réserver vos repas pour la semaine prochaine avant le <strong>jeudi à 14 h</strong>.</p>' +
            `<p><a href="${LOGIN_URL}">Se connecter à RestauResa</a></p>` +
            '<p>L’équipe RestauResa</p>',
        }),
      })

      if (response.ok) {
        sent += 1
      } else {
        failed += 1
        console.error(`Échec Resend pour un destinataire du rappel (HTTP ${response.status}).`)
      }
    } catch (error) {
      failed += 1
      console.error('Erreur réseau lors de l’envoi d’un rappel via Resend.', error)
    }

    if (index < recipients.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 600))
    }
  }

  if (failed > 0) {
    return json(
      { error: 'Certains rappels n’ont pas pu être envoyés.', sent, failed, total: recipients.length },
      502,
    )
  }

  return json({ sent, failed, total: recipients.length })
})
