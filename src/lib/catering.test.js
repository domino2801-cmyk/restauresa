import { quarterHourAttendance, passagePercent } from './catering'

it('calcule le pourcentage des réservations actives et distingue une absence de données', () => {
  expect(passagePercent(2, 3)).toBe(67)
  expect(passagePercent(0, 5)).toBe(0)
  expect(passagePercent(0, 0)).toBeNull()
})

it('génère les huit tranches du déjeuner sans mélanger les jours, services ou horaires', () => {
  const slots = quarterHourAttendance([
    { day: '2026-10-01', service: 'dejeuner', slot: '12:30', passed: 3 },
    { day: '2026-10-01', service: 'dejeuner', slot: '12:45', passed: 2 },
    { day: '2026-10-01', service: 'dejeuner', slot: '11:15', passed: 6 },
    { day: '2026-10-01', service: 'dejeuner', slot: '13:30', passed: 7 },
    { day: '2026-10-02', service: 'dejeuner', slot: '12:30', passed: 8 },
    { day: '2026-10-01', service: 'diner', slot: '12:30', passed: 5 },
  ], '2026-10-01', 'dejeuner')
  expect(slots).toEqual([
    { slot: '11:30', end: '11:45', passed: 0 },
    { slot: '11:45', end: '12:00', passed: 0 },
    { slot: '12:00', end: '12:15', passed: 0 },
    { slot: '12:15', end: '12:30', passed: 0 },
    { slot: '12:30', end: '12:45', passed: 3 },
    { slot: '12:45', end: '13:00', passed: 2 },
    { slot: '13:00', end: '13:15', passed: 0 },
    { slot: '13:15', end: '13:30', passed: 0 },
  ])
})

it.each([
  ['petit_dejeuner', ['06:30', '06:45', '07:00', '07:15'], '07:30'],
  ['diner', ['17:45', '18:00', '18:15', '18:30', '18:45'], '19:00'],
])('limite les tranches de %s à ses horaires', (service, expected, end) => {
  const slots = quarterHourAttendance([], '2026-10-01', service)
  expect(slots.map((slot) => slot.slot)).toEqual(expected)
  expect(slots.at(-1).end).toBe(end)
  expect(slots.every((slot) => slot.passed === 0)).toBe(true)
})

it('signale un service inconnu', () => {
  expect(() => quarterHourAttendance([], '2026-10-01', 'unknown')).toThrow('Service de restauration inconnu')
})
