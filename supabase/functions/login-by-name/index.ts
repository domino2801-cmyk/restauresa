// Edge Function : connexion avec le Nom (au lieu de l'email) + mot de passe.
//
// Le nom est résolu en email côté serveur (service_role) puis l'authentification
// est effectuée auprès de Supabase Auth. Seuls les jetons de session sont
// renvoyés : l'email n'est jamais exposé au client et toute erreur produit le
// même message générique (pas d'énumération des comptes).
//
// Déploiement : supabase functions deploy login-by-name --no-verify-jwt
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

const INVALID = { error: 'Identifiants invalides' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  let name: unknown
  let password: unknown
  try {
    ;({ name, password } = await req.json())
  } catch {
    return json(INVALID, 400)
  }
  if (
    typeof name !== 'string' || typeof password !== 'string' ||
    name.trim().length === 0 || name.length > 120 ||
    password.length === 0 || password.length > 128
  ) {
    return json(INVALID, 400)
  }

  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: email, error: lookupError } = await admin.rpc('login_email_for_name', {
    p_name: name,
  })
  if (lookupError || !email) return json(INVALID, 401)

  const client = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.session) return json(INVALID, 401)

  return json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  })
})
