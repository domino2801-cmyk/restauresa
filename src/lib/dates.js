/**
 * Utilitaires de dates. Les dates « métier » (menus) sont manipulées au format
 * ISO local `AAAA-MM-JJ` pour éviter tout décalage de fuseau horaire.
 */

/** Formate une date JS en `AAAA-MM-JJ` (heure locale). */
export function toISODate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Convertit `AAAA-MM-JJ` en Date locale (minuit). */
export function fromISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Ajoute `days` jours à une date (retourne une nouvelle instance). */
export function addDays(date, days) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  copy.setDate(copy.getDate() + days)
  return copy
}

/** Lundi de la semaine contenant `date`. */
export function startOfWeek(date = new Date()) {
  const day = date.getDay() // 0 = dimanche
  const diff = day === 0 ? -6 : 1 - day
  return addDays(date, diff)
}

/** Les 7 jours (lundi → dimanche) de la semaine commençant à `monday`, au format ISO. */
export function weekDays(monday) {
  return Array.from({ length: 7 }, (_, i) => toISODate(addDays(monday, i)))
}

/** Libellé lisible en français, ex. « lun. 5 oct. ». */
export function formatDayLabel(iso, options = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return fromISODate(iso).toLocaleDateString('fr-FR', options)
}

/** Vrai si la date ISO est aujourd'hui ou dans le futur. */
export function isTodayOrFuture(iso, today = new Date()) {
  return iso >= toISODate(today)
}

const parisDateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Paris',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hourCycle: 'h23',
})

/** Jeudi à 14 h, heure de Paris, précédant la semaine du repas. */
export function reservationDeadline(menuDate) {
  const thursday = addDays(startOfWeek(fromISODate(menuDate)), -4)
  const wallTime = Date.UTC(thursday.getFullYear(), thursday.getMonth(), thursday.getDate(), 14)
  const parts = Object.fromEntries(
    parisDateTime.formatToParts(new Date(wallTime)).map(({ type, value }) => [type, value]),
  )
  const parisTime = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  )
  return new Date(wallTime - (parisTime - wallTime))
}

export function isReservationOpen(menuDate, now = new Date()) {
  return now.getTime() < reservationDeadline(menuDate).getTime()
}

export function formatReservationDeadline(menuDate) {
  return reservationDeadline(menuDate).toLocaleDateString('fr-FR', {
    timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }) + ' à 14 h (heure de Paris)'
}
