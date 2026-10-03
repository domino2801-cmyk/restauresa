/** Message d'erreur lisible à partir d'une erreur Supabase / JS. */
export function errorMessage(error) {
  if (!error) return null
  if (/^new row violates row-level security policy for table "reservations"$/.test(error.message ?? '')) {
    return 'Impossible d’enregistrer cette réservation : vous ne disposez pas des autorisations nécessaires.'
  }
  return error.message || 'Une erreur est survenue.'
}
