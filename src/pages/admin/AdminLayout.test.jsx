import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AdminLayout from './AdminLayout'

it('conserve les onglets de gestion sans email de test', () => {
  render(<MemoryRouter><AdminLayout /></MemoryRouter>)
  expect(screen.getAllByRole('link')).toHaveLength(5)
  expect(screen.getByRole('link', { name: 'Menus de la semaine' })).toHaveAttribute('href', '/admin/menus')
  expect(screen.queryByRole('link', { name: 'Email de test' })).not.toBeInTheDocument()
})
