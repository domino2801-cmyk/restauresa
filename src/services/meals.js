/**
 * Catalogue des repas et menus de la semaine.
 */
import { supabase } from '../lib/supabase'

export async function fetchMeals({ activeOnly = false } = {}) {
  let query = supabase.from('meals').select('id, name, description, category, unit_price, is_active, is_service').order('name')
  if (activeOnly) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function saveMeal(meal) {
  const payload = {
    name: meal.name.trim(),
    description: meal.description?.trim() || null,
    category: meal.category?.trim() || null,
    unit_price: Number(meal.unit_price) || 0,
    is_active: meal.is_active ?? true,
  }
  const query = meal.id
    ? supabase.from('meals').update(payload).eq('id', meal.id)
    : supabase.from('meals').insert(payload)
  const { error } = await query
  if (error) throw error
}

export async function deleteMeal(id) {
  const { error } = await supabase.from('meals').delete().eq('id', id)
  if (error) {
    if (error.code === '23503') {
      throw new Error('Ce repas est utilisé dans des menus : désactivez-le plutôt que de le supprimer.')
    }
    throw error
  }
}

/** Services entre deux dates ISO incluses, avec un repas de service par défaut. */
export async function fetchMenus(from, to) {
  const { error: servicesError } = await supabase.rpc('ensure_meal_services', {
    from_date: from,
    to_date: to,
  })
  if (servicesError) throw servicesError
  const { data, error } = await supabase
    .from('menus')
    .select('id, menu_date, service, meal_id, meal:meals!inner(id, name, description, category, unit_price, is_active, is_service)')
    .eq('meal.is_active', true)
    .gte('menu_date', from)
    .lte('menu_date', to)
    .order('menu_date')
  if (error) throw error
  return data
}

/** Définit le plat ou rétablit le repas de service sans supprimer les réservations (admin). */
export async function setMenu(menuDate, service, mealId) {
  const { error } = await supabase
    .from('menus')
    .upsert({ menu_date: menuDate, service, meal_id: mealId || null }, { onConflict: 'menu_date,service' })
  if (error) throw error
}
