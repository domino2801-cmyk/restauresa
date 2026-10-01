import { sendTestEmail } from './email'

const invoke = vi.fn()
vi.mock('../lib/supabase', () => ({ supabase: { functions: { invoke: (...args) => invoke(...args) } } }))

describe('sendTestEmail', () => {
  beforeEach(() => invoke.mockReset())

  it('appelle la fonction send-test-email avec le destinataire', async () => {
    invoke.mockResolvedValue({ data: { id: 'e1', to: 'a@b.fr' }, error: null })
    await expect(sendTestEmail(' a@b.fr ')).resolves.toEqual({ id: 'e1', to: 'a@b.fr' })
    expect(invoke).toHaveBeenCalledWith('send-test-email', { body: { to: 'a@b.fr' } })
  })

  it('laisse le serveur choisir le destinataire par défaut', async () => {
    invoke.mockResolvedValue({ data: { id: 'e2', to: 'admin@b.fr' }, error: null })
    await sendTestEmail('')
    expect(invoke).toHaveBeenCalledWith('send-test-email', { body: {} })
  })

  it('refuse une adresse invalide sans appeler le serveur', async () => {
    await expect(sendTestEmail('pas-un-email')).rejects.toThrow('Adresse email invalide.')
    expect(invoke).not.toHaveBeenCalled()
  })

  it("remonte le message d'erreur de la fonction", async () => {
    const context = { json: () => Promise.resolve({ error: 'Accès réservé aux administrateurs.' }) }
    invoke.mockResolvedValue({ data: null, error: { message: 'non-2xx', context } })
    await expect(sendTestEmail('a@b.fr')).rejects.toThrow('Accès réservé aux administrateurs.')
  })

  it('utilise un message générique si la réponse est illisible', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'network' } })
    await expect(sendTestEmail('a@b.fr')).rejects.toThrow("Échec de l'envoi de l'email de test.")
  })
})
