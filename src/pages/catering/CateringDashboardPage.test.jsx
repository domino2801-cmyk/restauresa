import { fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import { fetchCateringOverview } from '../../services/catering'
import CateringDashboardPage from './CateringDashboardPage'

vi.mock('../../services/catering', () => ({ fetchCateringOverview: vi.fn() }))
vi.mock('recharts', () => ({
  Bar: () => null, BarChart: () => null, CartesianGrid: () => null,
  ResponsiveContainer: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null,
}))

beforeEach(() => {
  vi.clearAllMocks()
  fetchCateringOverview.mockImplementation(async (start) => ({
    services: [
      { day: start, service: 'dejeuner', reserved: 10, passed: 4, unchecked: 5, unknown_time: 1, other_day: 1 },
      { day: start, service: 'diner', reserved: 8, passed: 2, unchecked: 6, unknown_time: 0, other_day: 0 },
    ],
    half_hours: [{ day: start, service: 'dejeuner', slot: '12:30', passed: 2 }],
  }))
})

it('affiche les totaux globaux sans noms et filtre les tranches par service', async () => {
  render(<CateringDashboardPage />)
  const table = await screen.findByRole('table', { name: 'Bilan global hebdomadaire' })
  expect(within(table).getByText('40 %')).toBeInTheDocument()
  expect(screen.getByText('12:30 : 2 passage(s)')).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('1 passage(s) sans heure connue et 1 pointage(s)')
  fireEvent.change(screen.getByLabelText('Service'), { target: { value: 'diner' } })
  expect(within(table).getByText('25 %')).toBeInTheDocument()
  expect(screen.getByText('12:30 : 0 passage(s)')).toBeInTheDocument()
  expect(screen.queryByText(/sans heure connue/)).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Jour'), { target: { value: '1' } })
  expect(screen.getByText('Aucun passage pointé pour ce service.')).toBeInTheDocument()
})

it('recharge la semaine et permet une actualisation manuelle', async () => {
  render(<CateringDashboardPage />)
  await screen.findByRole('table', { name: 'Bilan global hebdomadaire' })
  const first = fetchCateringOverview.mock.calls[0][0]
  fireEvent.click(screen.getByRole('button', { name: 'Semaine suivante' }))
  await waitFor(() => expect(fetchCateringOverview).toHaveBeenCalledTimes(2))
  expect(fetchCateringOverview.mock.calls[1][0]).not.toBe(first)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Actualiser' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }))
  await waitFor(() => expect(fetchCateringOverview).toHaveBeenCalledTimes(3))
})

it('affiche explicitement les erreurs serveur', async () => {
  fetchCateringOverview.mockRejectedValueOnce(new Error('Accès réservé à la restauration'))
  render(<CateringDashboardPage />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Accès réservé à la restauration')
})
