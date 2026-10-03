import { fireEvent, render, screen, within } from '@testing-library/react'
import { fetchMenus } from '../../services/meals'
import { fetchCompanyMembers } from '../../services/profiles'
import { fetchHeadcounts, fetchReservationsForMenus } from '../../services/reservations'
import CduDashboardPage from './CduDashboardPage'

let account
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ profile: account }),
}))
vi.mock('../../services/meals', () => ({ fetchMenus: vi.fn() }))
vi.mock('../../services/profiles', () => ({ fetchCompanyMembers: vi.fn() }))
vi.mock('../../services/reservations', () => ({
  fetchHeadcounts: vi.fn(),
  fetchReservationsForMenus: vi.fn(),
  reviewHeadcount: vi.fn(),
}))
vi.mock('recharts', () => ({
  Bar: () => null,
  BarChart: () => null,
  CartesianGrid: () => null,
  Legend: () => null,
  ResponsiveContainer: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}))

beforeEach(() => {
  account = { role: 'cdu', company_id: 'company-1', company: { name: '1 CIE' } }
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-02T12:00:00Z'))
  fetchCompanyMembers.mockResolvedValue([
    { id: 'member-1', full_name: 'Martin', is_validated: true, section: { name: '1re Section' } },
    { id: 'member-2', full_name: 'Durand', is_validated: true, section: { name: '2e Section' } },
    { id: 'member-3', full_name: 'Petit', is_validated: true },
  ])
  fetchMenus.mockImplementation(async (start) => [
    { id: `menu-${start}`, menu_date: start, service: 'dejeuner', meal: { name: 'Déjeuner', unit_price: '8.50' } },
  ])
  fetchReservationsForMenus.mockImplementation(async ([menuId]) => [
    { user_id: 'member-1', menu_id: menuId, status: 'reserved', attended: true },
    { user_id: 'member-2', menu_id: menuId, status: 'reserved', attended: false },
    { user_id: 'member-3', menu_id: menuId, status: 'reserved', attended: null },
    { user_id: 'other-company', menu_id: menuId, status: 'reserved', attended: false },
    { user_id: 'member-1', menu_id: menuId, status: 'cancelled', attended: false },
  ])
  fetchHeadcounts.mockResolvedValue([])
})

afterEach(() => vi.useRealTimers())

it('charge la compagnie sélectionnée par l’administrateur plutôt que celle du compte', async () => {
  account = { role: 'admin', company_id: 'own-company' }
  render(<CduDashboardPage companyContext={{ company_id: 'selected-company', company: { name: '2 CIE' } }} />)
  await screen.findByRole('columnheader', { name: 'Pointages manquants' })
  expect(fetchCompanyMembers).toHaveBeenCalledWith('selected-company')
  expect(fetchHeadcounts).toHaveBeenCalledWith('selected-company', expect.any(Array))
  expect(fetchCompanyMembers).not.toHaveBeenCalledWith('own-company')
})

it('ignore une compagnie fournie au compte CDU', async () => {
  render(<CduDashboardPage companyContext={{ company_id: 'outside-company' }} />)
  await screen.findByRole('columnheader', { name: 'Pointages manquants' })
  expect(fetchCompanyMembers).toHaveBeenCalledWith('company-1')
  expect(fetchCompanyMembers).not.toHaveBeenCalledWith('outside-company')
})
it('affiche sept jours, les totaux de sa compagnie et la perte au prix du repas', async () => {
  render(<CduDashboardPage />)
  const table = (await screen.findByRole('columnheader', { name: 'Pointages manquants' })).closest('table')
  const rows = within(table).getAllByRole('row')
  expect(rows).toHaveLength(9)
  expect(within(rows[1]).getAllByRole('cell').map((cell) => cell.textContent))
    .toEqual(['lun. 28 sept.', '3', '1', '1', '1', '8,50\u00a0€'])
  expect(within(rows[6]).getByText('À venir')).toBeInTheDocument()
  expect(within(rows[8]).getAllByRole('cell').map((cell) => cell.textContent))
    .toEqual(['3', '1', '1', '1', '8,50\u00a0€'])
  expect(fetchCompanyMembers).toHaveBeenCalledWith('company-1')
})

it('recharge la semaine suivante sans valoriser ses absences futures', async () => {
  render(<CduDashboardPage />)
  await screen.findByRole('columnheader', { name: 'Pointages manquants' })
  fireEvent.click(screen.getByRole('button', { name: 'Semaine suivante' }))
  await screen.findByText('lun. 5 oct.', { selector: 'td' })
  const table = screen.getByRole('columnheader', { name: 'Pointages manquants' }).closest('table')
  const rows = within(table).getAllByRole('row')
  expect(within(rows[1]).getAllByRole('cell').map((cell) => cell.textContent))
    .toEqual(['lun. 5 oct.', '3', 'À venir', '—', '—', '—'])
  expect(within(rows[8]).getAllByRole('cell').map((cell) => cell.textContent))
    .toEqual(['3', '0', '0', '0', '0,00\u00a0€'])
  const sectionTable = screen.getByRole('table', { name: 'Bilan des repas par section' })
  expect(within(sectionTable).getAllByText('Non disponible')).toHaveLength(3)
})

it('signale une estimation partielle lorsque le prix du repas manque', async () => {
  fetchMenus.mockImplementation(async (start) => [
    { id: `menu-${start}`, menu_date: start, service: 'dejeuner', meal: null },
  ])
  render(<CduDashboardPage />)
  expect(await screen.findByText(/Estimation partielle : 1 absence\(s\) sans prix/)).toHaveAttribute('role', 'status')
  const table = screen.getByRole('columnheader', { name: 'Pointages manquants' }).closest('table')
  expect(within(table).getByText(/0,00\s€ \(partiel\)/)).toBeInTheDocument()
  const sectionTable = screen.getByRole('table', { name: 'Bilan des repas par section' })
  expect(within(sectionTable).getByText('Partiel : 1 absence(s) sans prix')).toBeInTheDocument()
})

it('classe les sections par repas non consommés sans inclure les pointages manquants', async () => {
  render(<CduDashboardPage />)
  const table = await screen.findByRole('table', { name: 'Bilan des repas par section' })
  const rows = within(table).getAllByRole('row').slice(1)
  expect(rows.map((row) => within(row).getByRole('rowheader').textContent))
    .toEqual(['2e SECT', '1re SECT', 'Sans SECT'])
  expect(within(rows[0]).getAllByRole('cell').map((cell) => cell.textContent))
    .toEqual(['1', '0', '1', '100 %', '0', '8,50\u00a0€'])
  expect(within(rows[1]).getAllByRole('cell').map((cell) => cell.textContent))
    .toEqual(['1', '1', '0', '0 %', '0', '0,00\u00a0€'])
  expect(within(rows[2]).getAllByRole('cell').map((cell) => cell.textContent))
    .toEqual(['1', '0', '0', 'Non disponible', '1', '0,00\u00a0€'])
})
