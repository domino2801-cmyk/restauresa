import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext } from '../../contexts/auth-context'
import { AppLayout } from './AppLayout'

it.each([
  ['admin', ['Administration', 'Restauration', 'ADU', 'CDU', 'Mes repas', 'Scanner mon passage']],
  ['adu', ['Ma compagnie', 'Mes repas', 'Scanner mon passage']],
  ['cdu', ['Supervision', 'Mes repas', 'Scanner mon passage']],
  ['restauration', ['Restauration', 'Mes repas', 'Scanner mon passage']],
  ['user', ['Mes repas', 'Scanner mon passage']],
])('affiche les onglets attendus pour le rôle %s', (role, labels) => {
  render(
    <AuthContext.Provider value={{ profile: { role, full_name: 'Test' }, signOut: vi.fn() }}>
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(labels)
  if (role === 'admin') {
    expect(screen.getByRole('link', { name: 'ADU' })).toHaveAttribute('href', '/adu')
    expect(screen.getByRole('link', { name: 'CDU' })).toHaveAttribute('href', '/cdu')
  }
})
