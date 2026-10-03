import { halfHourAttendance, passagePercent } from './catering'

it('calcule le pourcentage des réservations actives et distingue une absence de données', () => {
  expect(passagePercent(2, 3)).toBe(67)
  expect(passagePercent(0, 5)).toBe(0)
  expect(passagePercent(0, 0)).toBeNull()
})

it('génère les 48 tranches sans mélanger les jours et services', () => {
  const slots = halfHourAttendance([
    { day: '2026-10-01', service: 'dejeuner', slot: '12:30', passed: 3 },
    { day: '2026-10-02', service: 'dejeuner', slot: '12:30', passed: 8 },
    { day: '2026-10-01', service: 'diner', slot: '12:30', passed: 5 },
  ], '2026-10-01', 'dejeuner')
  expect(slots).toHaveLength(48)
  expect(slots[0]).toEqual({ slot: '00:00', passed: 0 })
  expect(slots[25]).toEqual({ slot: '12:30', passed: 3 })
  expect(slots[47]).toEqual({ slot: '23:30', passed: 0 })
})
