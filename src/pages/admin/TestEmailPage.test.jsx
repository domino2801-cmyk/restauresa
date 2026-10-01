import { fireEvent, render, screen } from '@testing-library/react'
import TestEmailPage from './TestEmailPage'

const sendMock = vi.fn()
vi.mock('../../services/email', () => ({ sendTestEmail: (...args) => sendMock(...args) }))

describe('TestEmailPage', () => {
  it('envoie un email de test et affiche la confirmation', async () => {
    sendMock.mockResolvedValue({ id: 'e1', to: 'a@b.fr' })
    render(<TestEmailPage />)
    fireEvent.change(screen.getByLabelText('Destinataire'), { target: { value: 'a@b.fr' } })
    fireEvent.click(screen.getByRole('button', { name: "Envoyer l'email de test" }))
    expect(await screen.findByText('Email de test envoyé à a@b.fr.')).toBeInTheDocument()
    expect(sendMock).toHaveBeenLastCalledWith('a@b.fr')
  })

  it("affiche l'erreur renvoyée par le serveur", async () => {
    sendMock.mockImplementation(async () => {
      throw new Error('Accès réservé aux administrateurs.')
    })
    render(<TestEmailPage />)
    fireEvent.click(screen.getByRole('button', { name: "Envoyer l'email de test" }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Accès réservé aux administrateurs.')
  })

  it('désactive l’envoi pour une adresse invalide', () => {
    render(<TestEmailPage />)
    fireEvent.change(screen.getByLabelText('Destinataire'), { target: { value: 'invalide' } })
    expect(screen.getByText('Adresse email invalide.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: "Envoyer l'email de test" })).toBeDisabled()
  })
})
