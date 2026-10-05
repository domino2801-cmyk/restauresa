import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatDayLabel, startOfWeek, weekDays } from '../../lib/dates'
import { fetchMenus } from '../../services/meals'
import { saveMealSelections } from '../../services/reservations'
import MyReservationsPage from './MyReservationsPage'

const days = weekDays(startOfWeek(new Date(2026, 9, 5)))
const menuDate = days[4]
const fridayLabel = formatDayLabel(menuDate, { weekday: 'long', day: 'numeric', month: 'long' })
const mondayLabel = formatDayLabel(days[0], { weekday: 'long', day: 'numeric', month: 'long' })
const saturdayLabel = formatDayLabel(days[5], { weekday: 'long', day: 'numeric', month: 'long' })
const sundayLabel = formatDayLabel(days[6], { weekday: 'long', day: 'numeric', month: 'long' })
const menus = [
  ...days.slice(0, 4).map((day, index) => ({
    id: `default-dej-${index}`, menu_date: day, service: 'dejeuner', meal_id: null, meal: null,
  })),
  { id: 'pdj', menu_date: menuDate, service: 'petit_dejeuner', meal_name: 'Omelette' },
  { id: 'dej', menu_date: menuDate, service: 'dejeuner', meal_name: 'Poulet rôti' },
  { id: 'din', menu_date: menuDate, service: 'diner', meal_name: 'Soupe' },
  { id: 'saturday-dej', menu_date: days[5], service: 'dejeuner', meal_name: 'Riz' },
  { id: 'sunday-din', menu_date: days[6], service: 'diner', meal_name: 'Pâtes' },
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
  fetchMenus: vi.fn(async (start, end) => menus.filter((menu) => menu.menu_date >= start && menu.menu_date <= end)),
}))

vi.mock('../../services/reservations', () => ({
  fetchReservationsForMenus: vi.fn(async () => reservations),
  saveMealSelections: vi.fn(async (userId, selections) => {
    for (const { menuId, reserved } of selections) {
      reservations = [
        ...reservations.filter((reservation) => reservation.menu_id !== menuId),
        { id: `reservation-${menuId}`, user_id: userId, menu_id: menuId, status: reserved ? 'reserved' : 'cancelled' },
      ]
    }
  }),
}))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-28T07:00:00Z'))
  reservations = [{ id: 'reservation-pdj', user_id: 'user-1', menu_id: 'pdj', status: 'reserved' }]
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
})

async function renderReservations() {
  const result = render(<MyReservationsPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Semaine suivante' }))
  await screen.findByText(fridayLabel)
  return result
}

describe('MyReservationsPage', () => {
  it('affiche les trois services en cases à cocher sans afficher les plats', async () => {
    await renderReservations()

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

  it('enregistre les réservations et annulations uniquement après confirmation', async () => {
    await renderReservations()

    const lunch = await screen.findByRole('checkbox', { name: `Déjeuner ${fridayLabel}` })
    fireEvent.click(lunch)

    const breakfast = screen.getByRole('checkbox', { name: `Petit-déjeuner ${fridayLabel}` })
    fireEvent.click(breakfast)
    expect(lunch).toBeChecked()
    expect(breakfast).not.toBeChecked()
    expect(saveMealSelections).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer mes réservations' }))
    await waitFor(() => expect(saveMealSelections).toHaveBeenCalledWith('user-1', [
      { menuId: 'pdj', reserved: false },
      { menuId: 'dej', reserved: true },
    ]))
    await screen.findByText('Réservations effectuées.')
    expect(screen.queryByText(/Confirmez vos repas avant le/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmer mes réservations' })).toBeDisabled()
  })

  it('affiche une case désactivée plutôt qu’un tiret si le service est indisponible', async () => {
    await renderReservations()

    const absentMeal = await screen.findByRole('checkbox', { name: `Petit-déjeuner ${mondayLabel} — service indisponible` })
    expect(absentMeal).toBeDisabled()
    expect(absentMeal).not.toBeChecked()
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })

  it('permet tous les services et le week-end sans aucun plat publié', async () => {
    const withoutDishes = async (start, end) => days
      .filter((day) => day >= start && day <= end)
      .flatMap((day) => ['petit_dejeuner', 'dejeuner', 'diner'].map((service) => ({
        id: `${day}-${service}`, menu_date: day, service, meal_id: null, meal: null,
      })))
    fetchMenus.mockImplementationOnce(withoutDishes).mockImplementationOnce(withoutDishes).mockImplementationOnce(withoutDishes)
    await renderReservations()
    const weekdayMeals = screen.getAllByRole('checkbox').filter((input) => input.closest('tbody'))
    expect(weekdayMeals).toHaveLength(15)
    for (const input of weekdayMeals) expect(input).toBeEnabled()
    expect(weekdayMeals.filter((input) => input.checked)).toHaveLength(0)
    fireEvent.click(screen.getByRole('checkbox', { name: `Petit-déjeuner ${mondayLabel}` }))
    fireEvent.click(screen.getByRole('checkbox', { name: `Dîner ${fridayLabel}` }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Week-end' }))
    fireEvent.click(screen.getByRole('checkbox', { name: `Déjeuner ${saturdayLabel}` }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer mes réservations' }))
    await waitFor(() => expect(saveMealSelections).toHaveBeenCalledWith('user-1', [
      { menuId: `${days[0]}-petit_dejeuner`, reserved: true },
      { menuId: `${days[4]}-diner`, reserved: true },
      { menuId: `${days[5]}-dejeuner`, reserved: true },
    ]))
    await screen.findByText('Réservations effectuées.')
  })

  it('affiche lundi à vendredi par défaut et le week-end uniquement si la case est cochée', async () => {
    await renderReservations()

    const weekend = await screen.findByRole('checkbox', { name: 'Week-end' })
    expect(weekend).not.toBeChecked()
    expect(screen.getAllByRole('row')).toHaveLength(6)
    expect(screen.queryByText(saturdayLabel)).not.toBeInTheDocument()
    expect(screen.queryByText(sundayLabel)).not.toBeInTheDocument()

    fireEvent.click(weekend)
    expect(screen.getAllByRole('row')).toHaveLength(8)
    expect(screen.getByText(saturdayLabel)).toBeInTheDocument()
    expect(screen.getByText(sundayLabel)).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: `Déjeuner ${saturdayLabel}` })).toBeEnabled()
    expect(screen.getByRole('checkbox', { name: `Dîner ${sundayLabel}` })).toBeEnabled()

    fireEvent.click(weekend)
    expect(screen.getAllByRole('row')).toHaveLength(6)
    expect(saveMealSelections).not.toHaveBeenCalled()
  })

  it('conserve les réservations du week-end lorsqu’il est masqué', async () => {
    await renderReservations()

    const weekend = await screen.findByRole('checkbox', { name: 'Week-end' })
    fireEvent.click(weekend)
    fireEvent.click(screen.getByRole('checkbox', { name: `Déjeuner ${saturdayLabel}` }))
    expect(saveMealSelections).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer mes réservations' }))
    await waitFor(() => expect(saveMealSelections).toHaveBeenCalledWith('user-1', expect.arrayContaining([
      { menuId: 'saturday-dej', reserved: true },
    ])))
    await waitFor(() => expect(screen.getByRole('checkbox', { name: `Déjeuner ${saturdayLabel}` })).toBeChecked())

    fireEvent.click(weekend)
    expect(screen.queryByText(saturdayLabel)).not.toBeInTheDocument()
    expect(screen.getByText(/2 repas réservés cette semaine/)).toBeInTheDocument()
    expect(saveMealSelections).toHaveBeenCalledTimes(1)

    fireEvent.click(weekend)
    const saturdayLunch = screen.getByRole('checkbox', { name: `Déjeuner ${saturdayLabel}` })
    expect(saturdayLunch).toBeChecked()
    fireEvent.click(saturdayLunch)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer mes réservations' }))
    await waitFor(() => expect(saveMealSelections).toHaveBeenLastCalledWith('user-1', [
      { menuId: 'saturday-dej', reserved: false },
    ]))
    await waitFor(() => expect(saturdayLunch).not.toBeChecked())
  })

  it('laisse les DEJ du lundi au jeudi décochés par défaut sans les enregistrer', async () => {
    await renderReservations()
    await screen.findByRole('checkbox', { name: `Déjeuner ${mondayLabel}` })
    for (const day of days.slice(0, 4)) {
      const label = formatDayLabel(day, { weekday: 'long', day: 'numeric', month: 'long' })
      expect(screen.getByRole('checkbox', { name: `Déjeuner ${label}` })).not.toBeChecked()
    }
    expect(screen.getByRole('checkbox', { name: `Déjeuner ${fridayLabel}` })).not.toBeChecked()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Week-end' }))
    expect(screen.getByRole('checkbox', { name: `Déjeuner ${saturdayLabel}` })).not.toBeChecked()
    expect(screen.getByText(/1 repas réservé cette semaine/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmer mes réservations' })).toBeDisabled()
    expect(saveMealSelections).not.toHaveBeenCalled()
  })

  it('respecte les DEJ déjà réservés ou annulés et enregistre uniquement les choix explicites', async () => {
    reservations.push(
      { id: 'reservation-default-dej-0', user_id: 'user-1', menu_id: 'default-dej-0', status: 'reserved' },
      { id: 'reservation-default-dej-3', user_id: 'user-1', menu_id: 'default-dej-3', status: 'cancelled' },
    )
    await renderReservations()
    expect(screen.getByRole('checkbox', { name: `Déjeuner ${mondayLabel}` })).toBeChecked()
    const thursdayLabel = formatDayLabel(days[3], { weekday: 'long', day: 'numeric', month: 'long' })
    expect(screen.getByRole('checkbox', { name: `Déjeuner ${thursdayLabel}` })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Confirmer mes réservations' })).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: `Déjeuner ${thursdayLabel}` }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer mes réservations' }))
    await waitFor(() => expect(saveMealSelections).toHaveBeenCalledWith('user-1', [
      { menuId: 'default-dej-3', reserved: true },
    ]))
  })

  it('enregistre un DEJ explicitement sélectionné et le conserve après rechargement', async () => {
    reservations = []
    const { unmount } = await renderReservations()
    expect(screen.getByRole('button', { name: 'Confirmer mes réservations' })).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: `Déjeuner ${mondayLabel}` }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer mes réservations' }))
    await screen.findByText('Réservations effectuées.')
    expect(saveMealSelections).toHaveBeenCalledWith('user-1', [
      { menuId: 'default-dej-0', reserved: true },
    ])
    unmount()
    await renderReservations()
    expect(screen.getByRole('checkbox', { name: `Déjeuner ${mondayLabel}` })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Confirmer mes réservations' })).toBeDisabled()
  })

  it('conserve un DEJ décoché après confirmation et rechargement', async () => {
    reservations.push({
      id: 'reservation-default-dej-0', user_id: 'user-1', menu_id: 'default-dej-0', status: 'reserved',
    })
    const { unmount } = await renderReservations()
    const mondayLunch = await screen.findByRole('checkbox', { name: `Déjeuner ${mondayLabel}` })
    fireEvent.click(mondayLunch)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer mes réservations' }))
    await screen.findByText('Réservations effectuées.')
    expect(saveMealSelections).toHaveBeenCalledWith('user-1', expect.arrayContaining([
      { menuId: 'default-dej-0', reserved: false },
    ]))
    unmount()
    await renderReservations()
    expect(await screen.findByRole('checkbox', { name: `Déjeuner ${mondayLabel}` })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Confirmer mes réservations' })).toBeDisabled()
    expect(screen.getByText('Réservations effectuées.')).toBeInTheDocument()
    expect(screen.queryByText(/Confirmez vos repas avant le/)).not.toBeInTheDocument()
  })

  it('réaffiche le rappel si les choix sont modifiés après confirmation', async () => {
    await renderReservations()
    fireEvent.click(await screen.findByRole('checkbox', { name: `Déjeuner ${mondayLabel}` }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer mes réservations' }))
    await screen.findByText('Réservations effectuées.')
    expect(screen.queryByText(/Confirmez vos repas avant le/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: `Déjeuner ${fridayLabel}` }))
    expect(screen.queryByText('Réservations effectuées.')).not.toBeInTheDocument()
    expect(screen.getByText(/Confirmez vos repas avant le/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer mes réservations' }))
    await screen.findByText('Réservations effectuées.')
    expect(screen.queryByText(/Confirmez vos repas avant le/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Semaine suivante' }))
    expect(screen.queryByText('Réservations effectuées.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Semaine précédente' }))
    await screen.findByText('Réservations effectuées.')
  })

  it('affiche les erreurs et conserve les choix pour réessayer', async () => {
    saveMealSelections.mockRejectedValueOnce(new Error('Enregistrement impossible.'))
    await renderReservations()
    fireEvent.click(await screen.findByRole('checkbox', { name: `Déjeuner ${mondayLabel}` }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer mes réservations' }))
    await screen.findByText('Enregistrement impossible.')
    expect(screen.queryByText('Réservations effectuées.')).not.toBeInTheDocument()
    expect(screen.getByText(/Confirmez vos repas avant le/)).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: `Déjeuner ${mondayLabel}` })).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer mes réservations' }))
    await screen.findByText('Réservations effectuées.')
    expect(saveMealSelections).toHaveBeenCalledTimes(2)
  })

  it('conserve les brouillons par semaine sans les appliquer à une autre semaine', async () => {
    await renderReservations()
    fireEvent.click(await screen.findByRole('checkbox', { name: `Déjeuner ${mondayLabel}` }))
    fireEvent.click(screen.getByRole('button', { name: 'Semaine suivante' }))
    await waitFor(() => expect(screen.getByRole('checkbox', {
      name: 'Déjeuner lundi 12 octobre — service indisponible',
    })).toBeDisabled())
    expect(screen.getByRole('button', { name: 'Confirmer mes réservations' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Semaine précédente' }))
    expect(await screen.findByRole('checkbox', { name: `Déjeuner ${mondayLabel}` })).toBeChecked()
    expect(saveMealSelections).not.toHaveBeenCalled()
  })

  it.each([
    '2026-10-01T12:00:00Z',
    '2026-10-02T19:30:00Z',
  ])('bloque les réservations et annulations après clôture à %s', async (now) => {
    vi.setSystemTime(new Date(now))
    await renderReservations()
    const breakfast = screen.getByRole('checkbox', { name: `Petit-déjeuner ${fridayLabel} — réservation fermée` })
    expect(breakfast).toBeChecked()
    expect(breakfast).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: `Déjeuner ${mondayLabel} — réservation fermée` })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Confirmer mes réservations' })).toBeDisabled()
    expect(screen.getByText(/Réservations clôturées depuis le jeudi 1 octobre 2026 à 14 h/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Week-end' }))
    expect(screen.getByRole('checkbox', { name: `Déjeuner ${saturdayLabel} — réservation fermée` })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: `Dîner ${sundayLabel} — réservation fermée` })).toBeDisabled()
    expect(saveMealSelections).not.toHaveBeenCalled()
  })

  it('permet de confirmer juste avant jeudi 14 h', async () => {
    vi.setSystemTime(new Date('2026-10-01T11:59:59.999Z'))
    await renderReservations()
    expect(screen.getByRole('checkbox', { name: `Déjeuner ${mondayLabel}` })).toBeEnabled()
    fireEvent.click(screen.getByRole('checkbox', { name: `Déjeuner ${mondayLabel}` }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer mes réservations' }))
    await screen.findByText('Réservations effectuées.')
    expect(saveMealSelections).toHaveBeenCalledTimes(1)
  })

  it('refuse la confirmation d’un brouillon si l’échéance vient de passer', async () => {
    await renderReservations()
    fireEvent.click(screen.getByRole('checkbox', { name: `Déjeuner ${fridayLabel}` }))
    vi.setSystemTime(new Date('2026-10-01T12:00:00Z'))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer mes réservations' }))
    expect(screen.getByText(/vos choix non confirmés n’ont pas été enregistrés/)).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: `Déjeuner ${fridayLabel} — réservation fermée` })).not.toBeChecked()
    expect(saveMealSelections).not.toHaveBeenCalled()
  })

  it('verrouille une page laissée ouverte exactement à l’échéance', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-01T11:59:59Z'))
    await act(async () => { render(<MyReservationsPage />) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Semaine suivante' })) })
    expect(screen.getByRole('checkbox', { name: `Déjeuner ${mondayLabel}` })).toBeEnabled()
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(screen.getByRole('checkbox', { name: `Déjeuner ${mondayLabel} — réservation fermée` })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Confirmer mes réservations' })).toBeDisabled()
    expect(saveMealSelections).not.toHaveBeenCalled()
  })
})
