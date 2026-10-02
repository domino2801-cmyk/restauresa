import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { checkInMeal } from '../../services/checkin'
import MealCheckinPage from './MealCheckinPage'

const camera = vi.hoisted(() => ({ start: vi.fn(), destroy: vi.fn(), callback: null }))
vi.mock('qr-scanner', () => ({
  default: class {
    constructor(video, callback) { camera.callback = callback }
    start = camera.start
    destroy = camera.destroy
  },
}))
vi.mock('../../services/checkin', () => ({ checkInMeal: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks()
  camera.start.mockResolvedValue(undefined)
  checkInMeal.mockResolvedValue(undefined)
})

it('scanne le service choisi et arrête la caméra après succès', async () => {
  render(<MealCheckinPage />)
  fireEvent.change(screen.getByRole('combobox', { name: 'Service' }), { target: { value: 'diner' } })
  fireEvent.click(screen.getByRole('button', { name: 'Scanner le QR code' }))
  await act(async () => { camera.callback({ data: 'restauresa:attendance:token' }) })
  expect(checkInMeal).toHaveBeenCalledWith('restauresa:attendance:token', 'diner')
  expect(await screen.findByText('Passage validé — Dîner du jour.')).toBeInTheDocument()
  expect(camera.destroy).toHaveBeenCalled()
})

it('affiche une erreur serveur sans annoncer un passage validé', async () => {
  checkInMeal.mockRejectedValueOnce(new Error('Aucune réservation confirmée pour ce repas du jour'))
  render(<MealCheckinPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Scanner le QR code' }))
  await act(async () => { camera.callback({ data: 'wrong' }) })
  expect(await screen.findByRole('alert')).toHaveTextContent('Aucune réservation')
  expect(screen.queryByText(/Passage validé/)).not.toBeInTheDocument()
})

it('affiche le refus caméra et permet de réessayer', async () => {
  camera.start.mockRejectedValueOnce(new Error('Permission denied'))
  render(<MealCheckinPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Scanner le QR code' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Caméra indisponible')
  expect(screen.getByRole('button', { name: 'Scanner le QR code' })).toBeEnabled()
})

it('arrête la caméra en quittant la page et ignore un résultat tardif', async () => {
  const { unmount } = render(<MealCheckinPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Scanner le QR code' }))
  await waitFor(() => expect(camera.start).toHaveBeenCalled())
  unmount()
  camera.callback({ data: 'late' })
  expect(camera.destroy).toHaveBeenCalled()
  expect(checkInMeal).not.toHaveBeenCalled()
})

it('arrête la caméra lorsque l’application passe en arrière-plan', async () => {
  render(<MealCheckinPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Scanner le QR code' }))
  await waitFor(() => expect(camera.start).toHaveBeenCalled())
  const original = Object.getOwnPropertyDescriptor(document, 'hidden')
  Object.defineProperty(document, 'hidden', { configurable: true, value: true })
  try {
    fireEvent(document, new Event('visibilitychange'))
    expect(camera.destroy).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Scanner le QR code' })).toBeEnabled()
  } finally {
    if (original) Object.defineProperty(document, 'hidden', original)
    else delete document.hidden
  }
})
