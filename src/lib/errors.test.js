import { errorMessage } from './errors'

it('traduit le refus de sécurité des réservations en français', () => {
  const message = 'new row violates row-level security policy for table "reservations"'
  const expected = 'Impossible d’enregistrer cette réservation : vous ne disposez pas des autorisations nécessaires.'
  expect(errorMessage({ code: '42501', message })).toBe(expected)
  expect(errorMessage(new Error(message))).toBe(expected)
})

it('préserve les autres erreurs et les messages français du serveur', () => {
  expect(errorMessage(new Error('Réservations clôturées : échéance dépassée'))).toBe('Réservations clôturées : échéance dépassée')
  expect(errorMessage({ message: 'new row violates row-level security policy for table "profiles"' }))
    .toBe('new row violates row-level security policy for table "profiles"')
})

it('conserve le comportement en l’absence de message', () => {
  expect(errorMessage(null)).toBeNull()
  expect(errorMessage(undefined)).toBeNull()
  expect(errorMessage({})).toBe('Une erreur est survenue.')
})
