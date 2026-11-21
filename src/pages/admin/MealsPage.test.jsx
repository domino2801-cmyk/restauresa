import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { deleteMeal, fetchMeals, saveMeal } from '../../services/meals'
import MealsPage from './MealsPage'

vi.mock('../../services/meals', () => ({
  fetchMeals: vi.fn(),
  saveMeal: vi.fn(),
  deleteMeal: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  fetchMeals.mockResolvedValue([
    { id: 'service', name: 'Repas de service', is_active: true, is_service: true, unit_price: 0 },
    { id: 'dish', name: 'Plat disponible', is_active: true, unit_price: 5 },
  ])
  saveMeal.mockResolvedValue(undefined)
})

it('charge uniquement les repas disponibles et protège le repas de service', async () => {
  render(<MealsPage />)
  await screen.findByText('Repas de service')
  expect(fetchMeals).toHaveBeenCalledWith({ activeOnly: true })
  expect(screen.getAllByRole('button', { name: 'Modifier' })).toHaveLength(1)
  expect(screen.queryByRole('button', { name: 'Supprimer Repas de service' })).not.toBeInTheDocument()
  expect(deleteMeal).not.toHaveBeenCalled()
})

it('retire du catalogue visible un repas désactivé', async () => {
  render(<MealsPage />)
  fireEvent.click(await screen.findByRole('button', { name: 'Modifier' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Disponible' }))
  fetchMeals.mockResolvedValue([
    { id: 'service', name: 'Repas de service', is_active: true, is_service: true, unit_price: 0 },
  ])
  fireEvent.click(screen.getByRole('button', { name: 'Mettre à jour' }))
  await waitFor(() => expect(saveMeal).toHaveBeenCalledWith(expect.objectContaining({ id: 'dish', is_active: false })))
  await waitFor(() => expect(screen.queryByText('Plat disponible')).not.toBeInTheDocument())
})
