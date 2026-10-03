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
    quarter_hours: [{ day: start, service: 'dejeuner', slot: '12:30', passed: 2 }],
  }))
})

it('affiche les totaux globaux sans noms et filtre les tranches par service', async () => {
  render(<CateringDashboardPage />)
  const table = await screen.findByRole('table', { name: 'Bilan global hebdomadaire' })
  expect(within(table).getByText('40 %')).toBeInTheDocument()
  expect(screen.getByText('Fréquentation par tranche de 15 minutes')).toBeInTheDocument()
  expect(screen.getByText('12:30 – 12:45 : 2 passage(s)')).toBeInTheDocument()
  expect(screen.getByText(/Déjeuner : 11:30 à 13:30/)).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('1 passage(s) sans heure connue et 1 pointage(s)')
  fireEvent.change(screen.getByLabelText('Service'), { target: { value: 'diner' } })
  expect(within(table).getByText('25 %')).toBeInTheDocument()
  expect(screen.queryByText(/12:30 – 12:45/)).not.toBeInTheDocument()
  expect(screen.getByText('17:45 – 18:00 : 0 passage(s)')).toBeInTheDocument()
  expect(screen.getByText('18:45 – 19:00 : 0 passage(s)')).toBeInTheDocument()
  expect(screen.getByText(/Dîner : 17:45 à 19:00/)).toBeInTheDocument()
  expect(screen.queryByText(/sans heure connue/)).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Service'), { target: { value: 'petit_dejeuner' } })
  expect(screen.getByText('06:30 – 06:45 : 0 passage(s)')).toBeInTheDocument()
  expect(screen.getByText('07:15 – 07:30 : 0 passage(s)')).toBeInTheDocument()
  expect(screen.getByText(/Petit-déjeuner : 06:30 à 07:30/)).toBeInTheDocument()
  expect(screen.queryByText(/07:30 –/)).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Jour'), { target: { value: '1' } })
  expect(screen.getByText('Aucun passage pointé pour ce service.')).toBeInTheDocument()
})

it('signale les passages hors horaires sans les retirer des totaux', async () => {
  fetchCateringOverview.mockImplementationOnce(async (start) => ({
    services: [{ day: start, service: 'dejeuner', reserved: 10, passed: 5, unchecked: 5 }],
    quarter_hours: [
      { day: start, service: 'dejeuner', slot: '11:15', passed: 1 },
      { day: start, service: 'dejeuner', slot: '11:30', passed: 2 },
      { day: start, service: 'dejeuner', slot: '13:30', passed: 2 },
      { day: start, service: 'diner', slot: '20:00', passed: 8 },
      { day: '2000-01-01', service: 'dejeuner', slot: '14:00', passed: 9 },
    ],
  }))
  render(<CateringDashboardPage />)
  const table = await screen.findByRole('table', { name: 'Bilan global hebdomadaire' })
  expect(within(table).getByText('50 %')).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('3 passage(s) hors horaires du service')
  expect(screen.getByText('11:30 – 11:45 : 2 passage(s)')).toBeInTheDocument()
  expect(screen.queryByText(/11:15 –|13:30 –/)).not.toBeInTheDocument()
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
