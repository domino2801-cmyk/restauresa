import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { fetchMeals, fetchMenus, setMenu } from '../../services/meals'
import WeeklyMenusPage from './WeeklyMenusPage'

vi.mock('../../services/meals', () => ({
  fetchMeals: vi.fn(),
  fetchMenus: vi.fn(),
  setMenu: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  fetchMeals.mockResolvedValue([
    { id: 'meal-lunch', name: 'Plat du midi', is_active: true },
    { id: 'meal-old', name: 'Ancien plat', is_active: false },
  ])
  fetchMenus.mockImplementation(async (start) => [
    { menu_date: start, service: 'dejeuner', meal_id: 'meal-old' },
    { menu_date: start, service: 'petit_dejeuner', meal_id: 'meal-lunch' },
    { menu_date: start, service: 'diner', meal_id: 'meal-lunch' },
  ])
  setMenu.mockResolvedValue(undefined)
})

it('affiche uniquement sept déjeuners sans proposer PDJ ou dîner', async () => {
  render(<WeeklyMenusPage />)
  const selects = await screen.findAllByRole('combobox', { name: 'Déjeuner' })
  expect(selects).toHaveLength(7)
  expect(screen.queryByRole('combobox', { name: 'Petit-déjeuner' })).not.toBeInTheDocument()
  expect(screen.queryByRole('combobox', { name: 'Dîner' })).not.toBeInTheDocument()
  expect(selects[0]).toHaveValue('meal-old')
  expect(setMenu).not.toHaveBeenCalled()
})

it('publie et retire uniquement le plat du midi sans toucher aux autres services', async () => {
  render(<WeeklyMenusPage />)
  const selects = await screen.findAllByRole('combobox', { name: 'Déjeuner' })
  const start = fetchMenus.mock.calls[0][0]
  fireEvent.change(selects[0], { target: { value: 'meal-lunch' } })
  await waitFor(() => expect(setMenu).toHaveBeenCalledWith(start, 'dejeuner', 'meal-lunch'))
  await waitFor(() => expect(selects[0]).toBeEnabled())
  fireEvent.change(selects[0], { target: { value: '' } })
  await waitFor(() => expect(setMenu).toHaveBeenLastCalledWith(start, 'dejeuner', ''))
  expect(setMenu.mock.calls.every((call) => call[1] === 'dejeuner')).toBe(true)
})

it('affiche les erreurs d’enregistrement', async () => {
  setMenu.mockRejectedValueOnce(new Error('Publication impossible'))
  render(<WeeklyMenusPage />)
  const selects = await screen.findAllByRole('combobox', { name: 'Déjeuner' })
  fireEvent.change(selects[0], { target: { value: 'meal-lunch' } })
  expect(await screen.findByRole('alert')).toHaveTextContent('Publication impossible')
})
