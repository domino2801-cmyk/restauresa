/**
 * Client Supabase unique de l'application.
 *
 * Les variables d'environnement sont définies dans `.env.local`
 * (voir `.env.example`). Si elles sont absentes, `supabase` vaut `null` et
 * l'application affiche un écran de configuration au lieu de planter.
 */
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
