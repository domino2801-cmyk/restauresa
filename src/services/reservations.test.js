import { cancelReservation, reserveMeal, saveMealSelections, setCompanyReservation } from './reservations'

const upsert = vi.fn()
const single = vi.fn()
const select = vi.fn(() => ({ single }))
const eq = vi.fn(() => ({ select }))
const update = vi.fn(() => ({ eq }))
const from = vi.fn(() => ({ upsert, update }))
const rpc = vi.fn()
vi.mock('../lib/supabase', () => ({
  supabase: { from: (...args) => from(...args), rpc: (...args) => rpc(...args) },
}))

describe('saveMealSelections', () => {
  beforeEach(() => {
    from.mockClear()
    upsert.mockReset()
    upsert.mockResolvedValue({ error: null })
    single.mockReset()
    single.mockResolvedValue({ data: { id: 'reservation-1' }, error: null })
    rpc.mockReset()
    rpc.mockResolvedValue({ error: null })
  })

  it('enregistre les réservations et refus ensemble avec la clé unique utilisateur/menu', async () => {
    await saveMealSelections('user-1', [
      { menuId: 'monday-dej', reserved: true },
      { menuId: 'tuesday-dej', reserved: false },
    ])
    expect(from).toHaveBeenCalledWith('reservations')
    expect(upsert).toHaveBeenCalledExactlyOnceWith([
      { user_id: 'user-1', menu_id: 'monday-dej', status: 'reserved' },
      { user_id: 'user-1', menu_id: 'tuesday-dej', status: 'cancelled' },
    ], { onConflict: 'user_id,menu_id' })
  })

  it('remonte une erreur de base de données', async () => {
    const error = new Error('Accès refusé.')
    upsert.mockResolvedValue({ error })
    await expect(saveMealSelections('user-1', [{ menuId: 'dej', reserved: true }])).rejects.toThrow(error)
  })

  it('ne fait aucune requête en l’absence de modification', async () => {
    await saveMealSelections('user-1', [])
    expect(from).not.toHaveBeenCalled()
  })

  it('préserve la réservation individuelle', async () => {
    await reserveMeal('user-1', 'dej')
    expect(upsert).toHaveBeenCalledWith([
      { user_id: 'user-1', menu_id: 'dej', status: 'reserved' },
    ], { onConflict: 'user_id,menu_id' })
  })

  it('vérifie que l’annulation a réellement modifié une réservation', async () => {
    await cancelReservation('reservation-1')
    expect(update).toHaveBeenCalledWith({ status: 'cancelled' })
    expect(eq).toHaveBeenCalledWith('id', 'reservation-1')
    expect(select).toHaveBeenCalledWith('id')
    expect(single).toHaveBeenCalledTimes(1)
  })

  it('signale une annulation refusée par la politique de clôture', async () => {
    single.mockResolvedValue({ error: { code: 'PGRST116' } })
    await expect(cancelReservation('reservation-1')).rejects.toThrow(/Annulation impossible.*clôturée/)
  })

  it('utilise le contrôle serveur ADU pour modifier un personnel', async () => {
    await setCompanyReservation('user-2', 'menu-1', false)
    expect(rpc).toHaveBeenCalledWith('set_company_reservation', {
      target_user_id: 'user-2', target_menu_id: 'menu-1', reserve: false,
    })
    rpc.mockResolvedValue({ error: new Error('Modifications ADU clôturées') })
    await expect(setCompanyReservation('user-2', 'menu-1', true)).rejects.toThrow('Modifications ADU clôturées')
  })
})
