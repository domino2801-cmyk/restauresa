import { addDays, formatDayLabel, formatReservationDeadline, fromISODate, isReservationOpen, isTodayOrFuture, reservationDeadline, startOfWeek, toISODate, weekDays } from './dates'

describe('dates', () => {
  it('formate et parse les dates ISO locales', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(toISODate(fromISODate('2026-12-31'))).toBe('2026-12-31')
  })

  it('calcule le lundi de la semaine (y compris le dimanche)', () => {
    expect(toISODate(startOfWeek(new Date(2026, 9, 1)))).toBe('2026-09-28') // jeudi
    expect(toISODate(startOfWeek(new Date(2026, 9, 4)))).toBe('2026-09-28') // dimanche
    expect(toISODate(startOfWeek(new Date(2026, 8, 28)))).toBe('2026-09-28') // lundi
  })

  it('liste les 7 jours de la semaine en traversant les mois', () => {
    expect(weekDays(new Date(2026, 8, 28))).toEqual([
      '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
    ])
  })

  it('ajoute des jours sans muter la date', () => {
    const d = new Date(2026, 1, 27)
    expect(toISODate(addDays(d, 2))).toBe('2026-03-01')
    expect(toISODate(d)).toBe('2026-02-27')
  })

  it('compare avec la date du jour', () => {
    const today = new Date(2026, 9, 1)
    expect(isTodayOrFuture('2026-10-01', today)).toBe(true)
    expect(isTodayOrFuture('2026-09-30', today)).toBe(false)
  })

  it('produit un libellé français', () => {
    expect(formatDayLabel('2026-10-01', { weekday: 'long' })).toBe('jeudi')
  })

  it.each([
    ['2026-10-05', '2026-10-01T12:00:00.000Z'],
    ['2026-10-11', '2026-10-01T12:00:00.000Z'],
    ['2026-11-02', '2026-10-29T13:00:00.000Z'],
    ['2026-03-30', '2026-03-26T13:00:00.000Z'],
    ['2026-10-26', '2026-10-22T12:00:00.000Z'],
    ['2026-01-05', '2026-01-01T13:00:00.000Z'],
    ['2026-06-01', '2026-05-28T12:00:00.000Z'],
  ])('calcule l’échéance de %s en tenant compte du fuseau de Paris', (menuDate, expected) => {
    expect(reservationDeadline(menuDate).toISOString()).toBe(expected)
    expect(isReservationOpen(menuDate, new Date(Date.parse(expected) - 1))).toBe(true)
    expect(isReservationOpen(menuDate, new Date(expected))).toBe(false)
    expect(isReservationOpen(menuDate, new Date(Date.parse(expected) + 1))).toBe(false)
  })

  it('reste clôturée pendant la semaine du repas et laisse ouvertes les semaines ultérieures', () => {
    const now = new Date('2026-10-05T08:00:00Z')
    expect(isReservationOpen('2026-10-05', now)).toBe(false)
    expect(isReservationOpen('2026-10-11', now)).toBe(false)
    expect(isReservationOpen('2026-10-12', now)).toBe(true)
    expect(formatReservationDeadline('2026-10-05')).toBe('jeudi 1 octobre 2026 à 14 h (heure de Paris)')
  })
})
