/** Message d'erreur lisible à partir d'une erreur Supabase / JS. */
export function errorMessage(error) {
  if (!error) return null
  return error.message || 'Une erreur est survenue.'
}
