import { supabase } from '../lib/supabase'

export async function getEstablishmentQr() {
  const { data, error } = await supabase.rpc('get_establishment_qr')
  if (error) throw error
  return data
}

export async function rotateEstablishmentQr() {
  const { data, error } = await supabase.rpc('rotate_establishment_qr')
  if (error) throw error
  return data
}

export async function checkInMeal(qrContent, service) {
  const { error } = await supabase.rpc('check_in_meal', {
    qr_content: qrContent, selected_service: service,
  })
  if (error) throw error
}
