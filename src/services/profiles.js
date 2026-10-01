/**
 * Profils utilisateurs.
 */
import { supabase } from '../lib/supabase'

const PROFILE_FIELDS =
  'id, full_name, email, role, is_validated, regiment_id, company_id, section_id, created_at, ' +
  'regiment:regiments(name), company:companies(name), section:sections(name)'

export async function fetchProfile(userId) {
  const { data, error } = await supabase.from('profiles').select(PROFILE_FIELDS).eq('id', userId).maybeSingle()
  if (error) throw error
  return data
}

/** Tous les profils visibles (admin : tous ; RLS appliquée). */
export async function fetchProfiles() {
  const { data, error } = await supabase.from('profiles').select(PROFILE_FIELDS).order('full_name')
  if (error) throw error
  return data
}

/** Membres d'une compagnie (ADU / CDU). */
export async function fetchCompanyMembers(companyId) {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_FIELDS)
    .eq('company_id', companyId)
    .order('full_name')
  if (error) throw error
  return data
}

/** Mise à jour d'un profil (admin : rôle, validation, rattachement). */
export async function updateProfile(id, changes) {
  const { error } = await supabase.from('profiles').update(changes).eq('id', id)
  if (error) throw error
}

/** Supprime le compte (auth + profil par cascade) — réservé à l'administrateur. */
export async function deleteUserAccount(id) {
  const { error } = await supabase.rpc('admin_delete_user', { p_user_id: id })
  if (error) throw error
}
