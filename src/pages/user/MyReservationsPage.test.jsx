import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatDayLabel, startOfWeek, weekDays } from '../../lib/dates'
import { cancelReservation, reserveMeal } from '../../services/reservations'
import MyReservationsPage from './MyReservationsPage'

const days = weekDays(startOfWeek(new Date()))
const menuDate = days[4]
const fridayLabel = formatDayLabel(menuDate, { weekday: 'long', day: 'numeric', month: 'long' })
const mondayLabel = formatDayLabel(days[0], { weekday: 'long', day: 'numeric', month: 'long' })
const menus = [
  { id: 'pdj', menu_date: menuDate, service: 'petit_dejeuner', meal_name: 'Omelette' },
  { id: 'dej', menu_date: menuDate, service: 'dejeuner', meal_name: 'Poulet rôti' },
  { id: 'din', menu_date: menuDate, service: 'diner', meal_name: 'Soupe' },
]

let reservations

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    profile: {
      id: 'user-1',
      regiment: { name: "1er régiment d'infanterie" },
      company: { name: '1re compagnie' },
      section: { name: 'Section 1' },
    },
  }),
}))

vi.mock('../../services/meals', () => ({
  fetchMenus: vi.fn(async () => menus),
}))

vi.mock('../../services/reservations', () => ({
  fetchReservationsForMenus: vi.fn(async () => reservations),
  reserveMeal: vi.fn(async (userId, menuId) => {
    reservations = [...reservations, { id: `reservation-${menuId}`, user_id: userId, menu_id: menuId, status: 'reserved' }]
  }),
  cancelReservation: vi.fn(async (reservationId) => {
    reservations = reservations.map((reservation) =>
      reservation.id === reservationId ? { ...reservation, status: 'cancelled' } : reservation,
    )
  }),
}))

beforeEach(() => {
  reservations = [{ id: 'reservation-pdj', user_id: 'user-1', menu_id: 'pdj', status: 'reserved' }]
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('MyReservationsPage', () => {
  it('affiche les trois services en cases à cocher sans afficher les plats', async () => {
    render(<MyReservationsPage />)

    const breakfast = await screen.findByRole('checkbox', { name: `Petit-déjeuner ${fridayLabel}` })
    expect(breakfast).toBeChecked()
    expect(screen.getByRole('checkbox', { name: `Déjeuner ${fridayLabel}` })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: `Dîner ${fridayLabel}` })).not.toBeChecked()
    expect(screen.getByText('PDJ')).toBeInTheDocument()
    expect(screen.getByText('DEJ')).toBeInTheDocument()
    expect(screen.getByText('DIN')).toBeInTheDocument()
    expect(screen.queryByText('Omelette')).not.toBeInTheDocument()
    expect(screen.queryByText('Poulet rôti')).not.toBeInTheDocument()
    expect(screen.queryByText('Soupe')).not.toBeInTheDocument()
    expect(screen.getByText(/1er RI · 1re CIE · SECT 1/)).toBeInTheDocument()
  })

  it('réserve et annule au changement de case', async () => {
    render(<MyReservationsPage />)

    const lunch = await screen.findByRole('checkbox', { name: `Déjeuner ${fridayLabel}` })
    fireEvent.click(lunch)

    await waitFor(() => expect(reserveMeal).toHaveBeenCalledWith('user-1', 'dej'))
    await waitFor(() => expect(lunch).toBeChecked())
    expect(cancelReservation).not.toHaveBeenCalled()

    const breakfast = screen.getByRole('checkbox', { name: `Petit-déjeuner ${fridayLabel}` })
    fireEvent.click(breakfast)
    await waitFor(() => expect(cancelReservation).toHaveBeenCalledWith('reservation-pdj'))
  })

  it('désactive les jours sans menu avec un indicateur accessible', async () => {
    render(<MyReservationsPage />)

    const absentMeal = await screen.findByLabelText(`Petit-déjeuner ${mondayLabel} — aucun menu publié`)
    expect(absentMeal).toHaveTextContent('—')
    expect(screen.queryByRole('checkbox', { name: `Petit-déjeuner ${mondayLabel}` })).not.toBeInTheDocument()
  })
})
