import { supabase } from '../lib/supabase'

export async function fetchCateringOverview(fromDate, toDate) {
  const { data, error } = await supabase.rpc('get_catering_overview', {
    from_date: fromDate,
    to_date: toDate,
  })
  if (error) throw error
  return data
}
