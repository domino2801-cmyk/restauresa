import { render, screen } from '@testing-library/react'
import { getEstablishmentQr } from '../../services/checkin'
import EstablishmentQrPage from './EstablishmentQrPage'

vi.mock('../../services/checkin', () => ({ getEstablishmentQr: vi.fn() }))

it('génère une image QR téléchargeable à partir du code serveur', async () => {
  getEstablishmentQr.mockResolvedValue('restauresa:attendance:00000000-0000-0000-0000-000000000001')
  render(<EstablishmentQrPage />)
  const image = await screen.findByRole('img', { name: 'QR code établissement pour valider le passage' })
  expect(image.getAttribute('src')).toMatch(/^data:image\/png;base64,/)
  expect(screen.getByRole('link', { name: 'Télécharger le QR code' })).toHaveAttribute('href', image.getAttribute('src'))
})

it('affiche une erreur si le code établissement ne peut pas être chargé', async () => {
  getEstablishmentQr.mockRejectedValue(new Error('Accès réservé aux administrateurs'))
  render(<EstablishmentQrPage />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Accès réservé')
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
})
