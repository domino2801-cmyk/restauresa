import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveMealSelections, setAttendance, setCompanyReservation } from '../../services/reservations'
import { fetchCompanyMembers } from '../../services/profiles'
import AduDashboardPage from './AduDashboardPage'

let reservations
let headcounts
let account
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ profile: account }),
}))
vi.mock('../../services/profiles', () => ({
  fetchCompanyMembers: vi.fn(async () => [
    { id: 'adu', full_name: 'ADU Test', is_validated: true },
    { id: 'member', full_name: 'Client Test', is_validated: true },
    { id: 'pending', full_name: 'Personnel en attente', is_validated: false },
  ]),
}))
vi.mock('../../services/meals', () => ({
  fetchMenus: vi.fn(async (date) => [{ id: 'menu', menu_date: date, service: 'dejeuner', meal: { name: 'Menu' } }]),
}))
vi.mock('../../services/reservations', () => ({
  fetchReservationsForMenus: vi.fn(async () => reservations),
  fetchHeadcounts: vi.fn(async () => headcounts),
  submitHeadcount: vi.fn(),
  setAttendance: vi.fn(async () => {}),
  saveMealSelections: vi.fn(async () => {}),
  setCompanyReservation: vi.fn(async (userId, menuId, reserved) => {
    reservations = [
      ...reservations.filter((r) => r.user_id !== userId),
      { id: `r-${userId}`, user_id: userId, menu_id: menuId, status: reserved ? 'reserved' : 'cancelled' },
    ]
  }),
}))

beforeEach(() => {
  account = { id: 'adu', role: 'adu', company_id: 'cie-1', company: { name: '3ème CIE' } }
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-02T08:00:00Z'))
  reservations = [{ id: 'r-member', user_id: 'member', menu_id: 'menu', status: 'reserved', attended: false }]
  headcounts = []
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
})

async function openMonday() {
  render(<AduDashboardPage />)
  fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-05' } })
  return screen.findByRole('checkbox', { name: 'Réserver Déjeuner pour Client Test' })
}

describe('réservations ADU', () => {
  it('utilise la compagnie sélectionnée et les droits de correction administrateur après clôture', async () => {
    account = { id: 'admin', role: 'admin', company_id: 'own-company' }
    render(<AduDashboardPage companyContext={{ company_id: 'selected-company', company: { name: '2 CIE' } }} />)
    const client = await screen.findByRole('checkbox', { name: 'Réserver Déjeuner pour Client Test' })
    expect(fetchCompanyMembers).toHaveBeenCalledWith('selected-company')
    expect(client).toBeEnabled()
    expect(screen.getByText(/Mode administrateur/)).toBeInTheDocument()
    fireEvent.click(client)
    await waitFor(() => expect(saveMealSelections).toHaveBeenCalledWith('member', [{ menuId: 'menu', reserved: false }]))
    expect(setCompanyReservation).not.toHaveBeenCalled()
  })

  it('ignore une compagnie fournie au compte ADU', async () => {
    render(<AduDashboardPage companyContext={{ company_id: 'outside-company' }} />)
    await screen.findByRole('checkbox', { name: 'Réserver Déjeuner pour Client Test' })
    expect(fetchCompanyMembers).toHaveBeenCalledWith('cie-1')
    expect(fetchCompanyMembers).not.toHaveBeenCalledWith('outside-company')
  })
  it('permet de réserver ou annuler pour tous les personnels de sa CIE, y compris soi-même', async () => {
    const client = await openMonday()
    expect(client).toBeEnabled()
    expect(client).toBeChecked()
    fireEvent.click(client)
    await waitFor(() => expect(setCompanyReservation).toHaveBeenCalledWith('member', 'menu', false))
    await waitFor(() => expect(client).not.toBeChecked())
    fireEvent.click(screen.getByRole('checkbox', { name: 'Réserver Déjeuner pour Personnel en attente' }))
    await waitFor(() => expect(setCompanyReservation).toHaveBeenCalledWith('pending', 'menu', true))
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Réserver Déjeuner pour ADU Test' })).toBeEnabled())
    fireEvent.click(screen.getByRole('checkbox', { name: 'Réserver Déjeuner pour ADU Test' }))
    await waitFor(() => expect(setCompanyReservation).toHaveBeenCalledWith('adu', 'menu', true))
  })

  it('ferme à J-2 à 14 h mais conserve le pointage de présence', async () => {
    vi.setSystemTime(new Date('2026-10-03T12:00:00Z'))
    expect(await openMonday()).toBeDisabled()
    expect(screen.getByText(/Modifications ADU clôturées depuis le samedi 3 octobre 2026 à 14 h/)).toBeInTheDocument()
    const present = screen.getByLabelText('Présent')
    expect(present).toBeEnabled()
    fireEvent.click(present)
    await waitFor(() => expect(setAttendance).toHaveBeenCalledWith('r-member', true))
    expect(setCompanyReservation).not.toHaveBeenCalled()
  })

  it('signale une erreur du serveur sans afficher une modification réussie', async () => {
    setCompanyReservation.mockRejectedValueOnce(new Error('Accès refusé'))
    const client = await openMonday()
    fireEvent.click(client)
    await screen.findByText('Accès refusé')
    expect(client).toBeChecked()
    expect(client).toBeEnabled()
  })

  it('refuse un changement si l’échéance passe juste avant le clic', async () => {
    const client = await openMonday()
    vi.setSystemTime(new Date('2026-10-03T12:00:00Z'))
    fireEvent.click(client)
    expect(screen.getByText(/échéance de J-2 à 14 h.*dépassée/)).toBeInTheDocument()
    expect(setCompanyReservation).not.toHaveBeenCalled()
  })

  it('verrouille la page restée ouverte à l’échéance', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-03T11:59:59Z'))
    await act(async () => { render(<AduDashboardPage />) })
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-05' } })
    })
    const client = screen.getByRole('checkbox', { name: 'Réserver Déjeuner pour Client Test' })
    expect(client).toBeEnabled()
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(client).toBeDisabled()
  })

  it('signale qu’un effectif approuvé doit être revu après une modification', async () => {
    headcounts = [{ menu_id: 'menu', status: 'approved', reserved_count: 1, total_members: 3 }]
    fireEvent.click(await openMonday())
    await screen.findByText(/l’effectif approuvé ne correspond plus au tableau/)
    expect(screen.getByRole('button', { name: "Mettre à jour l'effectif" })).toBeDisabled()
  })
})
