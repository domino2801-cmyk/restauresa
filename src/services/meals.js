/**
 * Catalogue des repas et menus de la semaine.
 */
import { supabase } from '../lib/supabase'

export async function fetchMeals({ activeOnly = false } = {}) {
  let query = supabase.from('meals').select('id, name, description, category, unit_price, is_active').order('name')
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

/** Menus entre deux dates ISO incluses, avec le repas associé. */
export async function fetchMenus(from, to) {
  const { data, error } = await supabase
    .from('menus')
    .select('id, menu_date, service, meal_id, meal:meals(id, name, description, category, unit_price)')
    .gte('menu_date', from)
    .lte('menu_date', to)
    .order('menu_date')
  if (error) throw error
  return data
}

/** Définit (ou retire si `mealId` est vide) le repas d'un service pour une date (admin). */
export async function setMenu(menuDate, service, mealId) {
  if (!mealId) {
    const { error } = await supabase.from('menus').delete().eq('menu_date', menuDate).eq('service', service)
    if (error) throw error
    return
  }
  const { error } = await supabase
    .from('menus')
    .upsert({ menu_date: menuDate, service, meal_id: mealId }, { onConflict: 'menu_date,service' })
  if (error) throw error
}
