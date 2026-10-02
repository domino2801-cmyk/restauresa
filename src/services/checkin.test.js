import { checkInMeal, getEstablishmentQr, rotateEstablishmentQr } from './checkin'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('../lib/supabase', () => ({ supabase: { rpc } }))
beforeEach(() => { vi.clearAllMocks() })

it('charge le QR réservé aux administrateurs', async () => {
  rpc.mockResolvedValue({ data: 'restauresa:attendance:token', error: null })
  expect(await getEstablishmentQr()).toBe('restauresa:attendance:token')
  expect(rpc).toHaveBeenCalledWith('get_establishment_qr')
})

it('envoie uniquement le code scanné et le service au serveur', async () => {
  rpc.mockResolvedValue({ error: null })
  await checkInMeal('scanned', 'dejeuner')
  expect(rpc).toHaveBeenCalledWith('check_in_meal', { qr_content: 'scanned', selected_service: 'dejeuner' })
})

it('remonte les erreurs du serveur', async () => {
  rpc.mockResolvedValue({ error: new Error('Passage déjà validé') })
  await expect(checkInMeal('scanned', 'dejeuner')).rejects.toThrow('Passage déjà validé')
  await expect(getEstablishmentQr()).rejects.toThrow('Passage déjà validé')
  await expect(rotateEstablishmentQr()).rejects.toThrow('Passage déjà validé')
})

it('renouvelle le code uniquement par RPC serveur', async () => {
  rpc.mockResolvedValue({ data: 'restauresa:attendance:new', error: null })
  expect(await rotateEstablishmentQr()).toBe('restauresa:attendance:new')
  expect(rpc).toHaveBeenCalledWith('rotate_establishment_qr')
})
