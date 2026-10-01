import { attendanceRate, countByDay, groupBySection, percent, reservationRate, sortMembers } from './stats'

const members = [
  { id: 'a', full_name: 'Martin', section: { name: '2e Section' } },
  { id: 'b', full_name: 'Durand', section: { name: '1re Section' } },
  { id: 'c', full_name: 'Bernard', section: { name: '2e Section' } },
  { id: 'd', full_name: 'Petit', section: null },
]

describe('stats', () => {
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
