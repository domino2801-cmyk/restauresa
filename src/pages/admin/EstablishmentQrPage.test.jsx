import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { getEstablishmentQr, rotateEstablishmentQr } from '../../services/checkin'
import EstablishmentQrPage from './EstablishmentQrPage'

vi.mock('../../services/checkin', () => ({ getEstablishmentQr: vi.fn(), rotateEstablishmentQr: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  getEstablishmentQr.mockResolvedValue('restauresa:attendance:00000000-0000-0000-0000-000000000001')
  rotateEstablishmentQr.mockResolvedValue('restauresa:attendance:00000000-0000-0000-0000-000000000002')
})
afterEach(() => { vi.restoreAllMocks() })

it('génère une image QR téléchargeable à partir du code serveur', async () => {
  getEstablishmentQr.mockResolvedValue('restauresa:attendance:00000000-0000-0000-0000-000000000001')
  render(<EstablishmentQrPage />)
  const image = await screen.findByRole('img', { name: 'QR code établissement pour valider le passage' })
  expect(image.getAttribute('src')).toMatch(/^data:image\/png;base64,/)
  expect(screen.getByRole('link', { name: 'Télécharger le QR code' })).toHaveAttribute('href', image.getAttribute('src'))
})

it('remplace l’image et le téléchargement après confirmation du renouvellement', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  render(<EstablishmentQrPage />)
  const image = await screen.findByRole('img')
  const previous = image.getAttribute('src')
  fireEvent.click(screen.getByRole('button', { name: 'Générer un nouveau QR code' }))
  await screen.findByText(/Nouveau QR code généré/)
  await waitFor(() => expect(screen.getByRole('img').getAttribute('src')).not.toBe(previous))
  expect(rotateEstablishmentQr).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('link', { name: 'Télécharger le QR code' })).toHaveAttribute('href', screen.getByRole('img').getAttribute('src'))
})

it('ne renouvelle pas le code si la confirmation est annulée', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(false)
  render(<EstablishmentQrPage />)
  const image = await screen.findByRole('img')
  const previous = image.getAttribute('src')
  fireEvent.click(screen.getByRole('button', { name: 'Générer un nouveau QR code' }))
  expect(rotateEstablishmentQr).not.toHaveBeenCalled()
  expect(image).toHaveAttribute('src', previous)
})

it('masque le code en cas d’erreur de renouvellement et permet de recharger le code actif', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  rotateEstablishmentQr.mockRejectedValueOnce(new Error('Connexion interrompue'))
  render(<EstablishmentQrPage />)
  await screen.findByRole('img')
  fireEvent.click(screen.getByRole('button', { name: 'Générer un nouveau QR code' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Connexion interrompue')
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  expect(screen.queryByText(/Nouveau QR code généré/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Recharger le QR actuel' }))
  await screen.findByRole('img')
  expect(getEstablishmentQr).toHaveBeenCalledTimes(2)
})

it('affiche une erreur si le code établissement ne peut pas être chargé', async () => {
  getEstablishmentQr.mockRejectedValue(new Error('Accès réservé aux administrateurs'))
  render(<EstablishmentQrPage />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Accès réservé')
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
})
