import { supabase } from '../lib/supabase'

export async function fetchCateringOverview(fromDate, toDate) {
  const { data, error } = await supabase.rpc('get_catering_overview', {
    from_date: fromDate,
    to_date: toDate,
  })
  if (error) throw error
  if (!Array.isArray(data?.quarter_hours)) {
    throw new Error('Les tranches de 15 minutes sont indisponibles. Appliquez la migration de fréquentation Supabase.')
  }
  return data
}
