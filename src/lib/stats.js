/**
 * Calculs statistiques purs utilisés par les tableaux de bord
 * (indépendants de Supabase, donc testables unitairement).
 */

const NO_SECTION = 'Sans section'

/** Compare deux noms de section (ordre numérique, « Sans section » en dernier). */
function compareSectionNames(a, b) {
  if (a === b) return 0
  if (a === NO_SECTION) return 1
  if (b === NO_SECTION) return -1
  return a.localeCompare(b, 'fr', { numeric: true })
}

/** Pourcentage arrondi (0 si dénominateur nul). */
export function percent(part, total) {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

/** Réservations actives (non annulées). */
export function activeReservations(reservations) {
  return reservations.filter((r) => r.status === 'reserved')
}

/**
 * Taux de présence : parmi les réservations dont la présence a été pointée,
 * part des militaires effectivement présents.
 */
export function attendanceRate(reservations) {
  const checked = activeReservations(reservations).filter((r) => r.attended !== null && r.attended !== undefined)
  return percent(checked.filter((r) => r.attended).length, checked.length)
}

/**
 * Taux de réservation : nombre de réservations actives rapporté au nombre de
 * repas possibles (effectif × nombre de menus).
 */
export function reservationRate(reservations, memberCount, menuCount) {
  return percent(activeReservations(reservations).length, memberCount * menuCount)
}

/**
 * Regroupe les membres par section et indique, pour un menu donné, qui a réservé.
 * @param {Array<{id:string, full_name:string, section?:{name:string}|null}>} members
 * @param {Set<string>} reservedUserIds
 * @returns {Array<{section:string, members:Array, reserved:number, total:number}>}
 */
export function groupBySection(members, reservedUserIds) {
  const groups = new Map()
  for (const member of members) {
    const key = member.section?.name ?? NO_SECTION
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push({ ...member, hasReserved: reservedUserIds.has(member.id) })
  }
  return [...groups.entries()]
    .sort(([a], [b]) => compareSectionNames(a, b))
    .map(([section, list]) => ({
      section,
      members: list.sort((a, b) => a.full_name.localeCompare(b.full_name, 'fr')),
      reserved: list.filter((m) => m.hasReserved).length,
      total: list.length,
    }))
}

/**
 * Agrège le nombre de réservations actives par jour.
 * @param {string[]} days Dates ISO
 * @param {Array<{status:string, menu:{menu_date:string}}>} reservations
 */
export function countByDay(days, reservations) {
  const counts = Object.fromEntries(days.map((d) => [d, 0]))
  for (const r of activeReservations(reservations)) {
    const day = r.menu?.menu_date
    if (day in counts) counts[day] += 1
  }
  return days.map((day) => ({ day, count: counts[day] }))
}

/** Bilan des repas réservés : seuls les absents explicitement pointés sont valorisés. */
export function companyAttendanceByDay(days, menus, reservations, today) {
  const menuById = new Map(menus.map((menu) => [menu.id, menu]))
  const rows = new Map(days.map((day) => [day, {
    day, planned: 0, attended: 0, absent: 0, unchecked: 0, loss: 0, unpriced: 0, future: day > today,
  }]))
  for (const reservation of activeReservations(reservations)) {
    const menu = menuById.get(reservation.menu_id)
    const row = rows.get(menu?.menu_date)
    if (!row) continue
    row.planned += 1
    if (row.future) continue
    if (reservation.attended === true) {
      row.attended += 1
    } else if (reservation.attended === false) {
      row.absent += 1
      const price = menu.meal?.unit_price
      if (price === null || price === undefined || price === '' || !Number.isFinite(Number(price))) {
        row.unpriced += 1
      } else {
        row.loss += Number(price)
      }
    } else {
      row.unchecked += 1
    }
  }
  return [...rows.values()]
}

export function attendanceTotals(rows) {
  return rows.reduce((totals, row) => ({
    planned: totals.planned + row.planned,
    attended: totals.attended + row.attended,
    absent: totals.absent + row.absent,
    unchecked: totals.unchecked + row.unchecked,
    loss: totals.loss + row.loss,
    unpriced: totals.unpriced + row.unpriced,
  }), { planned: 0, attended: 0, absent: 0, unchecked: 0, loss: 0, unpriced: 0 })
}

/** Même calcul que le bilan quotidien, classé par absences décroissantes. */
export function companyAttendanceBySection(days, menus, reservations, members, today) {
  return groupBySection(members, new Set()).map((group) => {
    const memberIds = new Set(group.members.map((member) => member.id))
    const totals = attendanceTotals(companyAttendanceByDay(
      days, menus, reservations.filter((reservation) => memberIds.has(reservation.user_id)), today,
    ))
    const checked = totals.attended + totals.absent
    return {
      section: group.section,
      ...totals,
      absenceRate: checked ? percent(totals.absent, checked) : null,
    }
  }).sort((a, b) => b.absent - a.absent || compareSectionNames(a.section, b.section))
}

/**
 * Trie une liste de membres annotés (`hasReserved`, `section`) selon la clé :
 * 'section' (puis nom), 'name', ou 'status' (réservés d'abord, puis section et nom).
 */
export function sortMembers(rows, key = 'section') {
  const byName = (a, b) => a.full_name.localeCompare(b.full_name, 'fr')
  const bySection = (a, b) => compareSectionNames(a.section?.name ?? NO_SECTION, b.section?.name ?? NO_SECTION)
  const comparators = {
    name: byName,
    section: (a, b) => bySection(a, b) || byName(a, b),
    status: (a, b) => Number(b.hasReserved) - Number(a.hasReserved) || bySection(a, b) || byName(a, b),
  }
  return [...rows].sort(comparators[key] ?? comparators.section)
}
