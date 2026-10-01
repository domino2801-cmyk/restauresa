/**
 * Organisation : régiments, compagnies, sections.
 */
import { supabase } from '../lib/supabase'

/** Charge toute l'arborescence (lecture publique, utilisée à l'inscription). */
export async function fetchOrganization() {
  const [regiments, companies, sections] = await Promise.all([
    supabase.from('regiments').select('id, name').order('name'),
    supabase.from('companies').select('id, name, regiment_id').order('name'),
    supabase.from('sections').select('id, name, company_id').order('name'),
  ])
  for (const res of [regiments, companies, sections]) if (res.error) throw res.error
  return { regiments: regiments.data, companies: companies.data, sections: sections.data }
}

const TABLES = { regiment: 'regiments', company: 'companies', section: 'sections' }

/** Création d'une entité (admin). `parent` : { regiment_id } ou { company_id }. */
export async function createUnit(kind, name, parent = {}) {
  const { error } = await supabase.from(TABLES[kind]).insert({ name: name.trim(), ...parent })
  if (error) throw error
}

/** Suppression d'une entité (admin) — supprime en cascade les sous-unités. */
export async function deleteUnit(kind, id) {
  const { error } = await supabase.from(TABLES[kind]).delete().eq('id', id)
  if (error) throw error
}
