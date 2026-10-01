import { MIN_PASSWORD_LENGTH } from './constants'

/** Vrai si la valeur ressemble à une adresse email. */
export const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim())

/**
 * Valide le formulaire d'inscription.
 * @returns {Record<string, string>} erreurs par champ (vide si valide)
 */
export function validateRegistration(form) {
  const errors = {}
  if (!form.regiment_id) errors.regiment_id = 'Sélectionnez votre régiment.'
  if (!form.company_id) errors.company_id = 'Sélectionnez votre compagnie.'
  if (!form.section_id) errors.section_id = 'Sélectionnez votre section.'
  if (!form.fullName.trim()) errors.fullName = 'Le nom est obligatoire.'
  if (!isEmail(form.email)) errors.email = 'Adresse email invalide.'
  if (form.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Au moins ${MIN_PASSWORD_LENGTH} caractères.`
  }
  if (form.password !== form.confirm) errors.confirm = 'Les mots de passe ne correspondent pas.'
  return errors
}
