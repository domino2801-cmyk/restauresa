/** Rôles applicatifs (doivent correspondre à l'enum SQL `public.app_role`). */
export const ROLES = Object.freeze({
  ADMIN: 'admin',
  ADU: 'adu',
  CDU: 'cdu',
  USER: 'user',
})

export const ROLE_LABELS = Object.freeze({
  admin: 'Administrateur',
  adu: 'ADU — Adjudant de compagnie',
  cdu: 'CDU — Commandant de compagnie',
  user: 'Militaire',
})

/** Page d'accueil associée à chaque rôle. */
export const ROLE_HOME = Object.freeze({
  admin: '/admin',
  adu: '/adu',
  cdu: '/cdu',
  user: '/reservations',
})

/** Services de repas (enum SQL `public.meal_service`), dans l'ordre de la journée. */
export const SERVICES = Object.freeze(['petit_dejeuner', 'dejeuner', 'diner'])

export const SERVICE_LABELS = Object.freeze({
  petit_dejeuner: 'Petit-déjeuner',
  dejeuner: 'Déjeuner',
  diner: 'Dîner',
})

export const SERVICE_SHORT_LABELS = Object.freeze({
  petit_dejeuner: 'PDJ',
  dejeuner: 'DEJ',
  diner: 'DIN',
})

export const HEADCOUNT_STATUS_LABELS = Object.freeze({
  submitted: 'En attente',
  approved: 'Approuvé',
  rejected: 'Rejeté',
})

export const MIN_PASSWORD_LENGTH = 8
export const OTP_LENGTH = 6

/** Clé de stockage de l'email en attente de validation OTP. */
export const PENDING_EMAIL_KEY = 'restauresa:pending-email'

/** Cache du service worker contenant les réponses REST Supabase (données utilisateur). */
export const API_CACHE_NAME = 'supabase-rest'
