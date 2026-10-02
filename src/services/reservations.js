/**
 * Réservations de repas et validations d'effectifs.
 */
import { supabase } from '../lib/supabase'

/** Réservations (visibles selon la RLS) pour une liste de menus. */
export async function fetchReservationsForMenus(menuIds) {
  if (menuIds.length === 0) return []
  const { data, error } = await supabase
    .from('reservations')
    .select('id, user_id, menu_id, status, attended')
    .in('menu_id', menuIds)
  if (error) throw error
  return data
}

/** Réserve (ou ré-active) un repas pour l'utilisateur connecté. */
export async function reserveMeal(userId, menuId) {
  return saveMealSelections(userId, [{ menuId, reserved: true }])
}

/** Enregistre les choix de repas en une seule requête, y compris les refus explicites. */
export async function saveMealSelections(userId, selections) {
  if (selections.length === 0) return
  const { error } = await supabase
    .from('reservations')
    .upsert(
      selections.map(({ menuId, reserved }) => ({
        user_id: userId,
        menu_id: menuId,
        status: reserved ? 'reserved' : 'cancelled',
      })),
      { onConflict: 'user_id,menu_id' },
    )
  if (error) throw error
}

/** Modification ADU limitée par le serveur à sa CIE et à J-2 à 14 h. */
export async function setCompanyReservation(userId, menuId, reserved) {
  const { error } = await supabase.rpc('set_company_reservation', {
    target_user_id: userId,
    target_menu_id: menuId,
    reserve: reserved,
  })
  if (error) throw error
}

/** Annule une réservation de l'utilisateur connecté. */
export async function cancelReservation(reservationId) {
  const { error } = await supabase
    .from('reservations')
    .update({ status: 'cancelled' })
    .eq('id', reservationId)
    .select('id')
    .single()
  if (error?.code === 'PGRST116') {
    throw new Error('Annulation impossible : réservation clôturée, introuvable ou accès refusé.')
  }
  if (error) throw error
}

/** Pointage de présence (ADU). */
export async function setAttendance(reservationId, attended) {
  const { error } = await supabase.from('reservations').update({ attended }).eq('id', reservationId)
  if (error) throw error
}

/** Validations d'effectifs d'une compagnie pour une liste de menus. */
export async function fetchHeadcounts(companyId, menuIds) {
  if (menuIds.length === 0) return []
  const { data, error } = await supabase
    .from('headcount_validations')
    .select('id, company_id, menu_id, reserved_count, total_members, status, submitted_at, reviewed_at, comment')
    .eq('company_id', companyId)
    .in('menu_id', menuIds)
  if (error) throw error
  return data
}

/** Soumission de l'effectif d'un menu aux cuisines (ADU). */
export async function submitHeadcount({ companyId, menuId, reservedCount, totalMembers }) {
  const { error } = await supabase.from('headcount_validations').upsert(
    { company_id: companyId, menu_id: menuId, reserved_count: reservedCount, total_members: totalMembers },
    { onConflict: 'company_id,menu_id' },
  )
  if (error) {
    if (error.code === '42501') throw new Error('Cet effectif a déjà été approuvé par le CDU.')
    throw error
  }
}

/** Décision du CDU sur un effectif soumis. */
export async function reviewHeadcount(id, status, comment) {
  const { error } = await supabase
    .from('headcount_validations')
    .update({ status, comment: comment?.trim() || null })
    .eq('id', id)
  if (error) throw error
}
