import { attendanceRate, attendanceTotals, companyAttendanceByDay, companyAttendanceBySection, countByDay, groupBySection, percent, reservationRate, sortMembers } from './stats'

const members = [
  { id: 'a', full_name: 'Martin', section: { name: '2e Section' } },
  { id: 'b', full_name: 'Durand', section: { name: '1re Section' } },
  { id: 'c', full_name: 'Bernard', section: { name: '2e Section' } },
  { id: 'd', full_name: 'Petit', section: null },
]

describe('stats', () => {
  it('classe les sections par absences et conserve les mêmes totaux que le bilan quotidien', () => {
    const days = ['2026-10-01', '2026-10-02', '2026-10-03']
    const menus = [
      { id: 'lunch', menu_date: days[0], meal: { unit_price: '8.50' } },
      { id: 'dinner', menu_date: days[0], meal: null },
      { id: 'future', menu_date: days[2], meal: { unit_price: 20 } },
    ]
    const reservations = [
      { user_id: 'a', menu_id: 'lunch', status: 'reserved', attended: false },
      { user_id: 'c', menu_id: 'dinner', status: 'reserved', attended: false },
      { user_id: 'c', menu_id: 'lunch', status: 'reserved', attended: true },
      { user_id: 'b', menu_id: 'lunch', status: 'reserved', attended: null },
      { user_id: 'b', menu_id: 'future', status: 'reserved', attended: false },
      { user_id: 'd', menu_id: 'lunch', status: 'reserved', attended: true },
      { user_id: 'a', menu_id: 'dinner', status: 'cancelled', attended: false },
    ]
    const sections = companyAttendanceBySection(days, menus, reservations, members, days[1])
    expect(sections).toEqual([
      { section: '2e Section', planned: 3, attended: 1, absent: 2, unchecked: 0, loss: 8.5, unpriced: 1, absenceRate: 67 },
      { section: '1re Section', planned: 2, attended: 0, absent: 0, unchecked: 1, loss: 0, unpriced: 0, absenceRate: null },
      { section: 'Sans section', planned: 1, attended: 1, absent: 0, unchecked: 0, loss: 0, unpriced: 0, absenceRate: 0 },
    ])
    expect(attendanceTotals(sections)).toEqual(attendanceTotals(companyAttendanceByDay(days, menus, reservations, days[1])))
  })

  it('ignore les personnels hors compagnie et conserve les sections sans réservation', () => {
    const menus = [{ id: 'lunch', menu_date: '2026-10-01', meal: { unit_price: 10 } }]
    const outside = [{ user_id: 'outside', menu_id: 'lunch', status: 'reserved', attended: false }]
    const sections = companyAttendanceBySection(['2026-10-01'], menus, outside, members, '2026-10-02')
    expect(sections.map((row) => row.section)).toEqual(['1re Section', '2e Section', 'Sans section'])
    expect(sections.every((row) => row.planned === 0 && row.loss === 0 && row.absenceRate === null)).toBe(true)
    expect(companyAttendanceBySection(['2026-10-01'], menus, outside, [], '2026-10-02')).toEqual([])
  })

  it('valorise les absences explicites au prix de chaque service sans compter les annulations ou les futurs', () => {
    const menus = [
      { id: 'lunch', menu_date: '2026-10-01', meal: { unit_price: '8.50' } },
      { id: 'dinner', menu_date: '2026-10-01', meal: { unit_price: 12 } },
      { id: 'future', menu_date: '2026-10-03', meal: { unit_price: 20 } },
    ]
    const reservations = [
      { menu_id: 'lunch', status: 'reserved', attended: true },
      { menu_id: 'lunch', status: 'reserved', attended: false },
      { menu_id: 'dinner', status: 'reserved', attended: false },
      { menu_id: 'lunch', status: 'reserved', attended: null },
      { menu_id: 'lunch', status: 'reserved' },
      { menu_id: 'dinner', status: 'cancelled', attended: false },
      { menu_id: 'future', status: 'reserved', attended: false },
      { menu_id: 'unknown', status: 'reserved', attended: false },
    ]
    expect(companyAttendanceByDay(['2026-10-01', '2026-10-02', '2026-10-03'], menus, reservations, '2026-10-02'))
      .toEqual([
        { day: '2026-10-01', planned: 5, attended: 1, absent: 2, unchecked: 2, loss: 20.5, unpriced: 0, future: false },
        { day: '2026-10-02', planned: 0, attended: 0, absent: 0, unchecked: 0, loss: 0, unpriced: 0, future: false },
        { day: '2026-10-03', planned: 1, attended: 0, absent: 0, unchecked: 0, loss: 0, unpriced: 0, future: true },
      ])
  })

  it('signale les prix absents ou invalides mais accepte les repas gratuits et les pointages du jour', () => {
    const prices = [null, undefined, '', 'invalid', 0, '7.25']
    const menus = prices.map((price, id) => ({ id, menu_date: '2026-10-02', meal: { unit_price: price } }))
    menus.push({ id: 'unpublished', menu_date: '2026-10-02', meal: null })
    const reservations = menus.map((menu) => ({ menu_id: menu.id, status: 'reserved', attended: false }))
    expect(companyAttendanceByDay(['2026-10-02'], menus, reservations, '2026-10-02')[0])
      .toMatchObject({ planned: 7, absent: 7, unpriced: 5, loss: 7.25 })
  })

  it('calcule un pourcentage arrondi et gère le zéro', () => {
    expect(percent(1, 3)).toBe(33)
    expect(percent(5, 0)).toBe(0)
  })

  it('calcule le taux de réservation en ignorant les annulations', () => {
    const reservations = [{ status: 'reserved' }, { status: 'reserved' }, { status: 'cancelled' }]
    expect(reservationRate(reservations, 2, 2)).toBe(50)
  })

  it('calcule le taux de présence sur les seuls repas pointés', () => {
    const reservations = [
      { status: 'reserved', attended: true },
      { status: 'reserved', attended: false },
      { status: 'reserved', attended: null },
      { status: 'cancelled', attended: true },
    ]
    expect(attendanceRate(reservations)).toBe(50)
  })

  it('regroupe par section, trie et compte les réservations', () => {
    const groups = groupBySection(members, new Set(['a', 'b']))
    expect(groups.map((g) => g.section)).toEqual(['1re Section', '2e Section', 'Sans section'])
    expect(groups[1]).toMatchObject({ reserved: 1, total: 2 })
    expect(groups[1].members.map((m) => m.full_name)).toEqual(['Bernard', 'Martin'])
  })

  it('compte les réservations actives par jour', () => {
    const res = [
      { status: 'reserved', menu: { menu_date: '2026-10-01' } },
      { status: 'reserved', menu: { menu_date: '2026-10-01' } },
      { status: 'cancelled', menu: { menu_date: '2026-10-02' } },
      { status: 'reserved', menu: { menu_date: '2026-11-01' } },
    ]
    expect(countByDay(['2026-10-01', '2026-10-02'], res)).toEqual([
      { day: '2026-10-01', count: 2 },
      { day: '2026-10-02', count: 0 },
    ])
  })

  it('trie les membres par section, nom ou statut', () => {
    const rows = members.map((m) => ({ ...m, hasReserved: m.id === 'c' }))
    expect(sortMembers(rows, 'section').map((m) => m.id)).toEqual(['b', 'c', 'a', 'd'])
    expect(sortMembers(rows, 'name').map((m) => m.id)).toEqual(['c', 'b', 'a', 'd'])
    expect(sortMembers(rows, 'status')[0].id).toBe('c')
  })
})
