import { fetchMeals, fetchMenus, setMenu } from './meals'

const rpc = vi.fn()
const upsert = vi.fn()
const order = vi.fn()
const lte = vi.fn(() => ({ order }))
const gte = vi.fn(() => ({ lte }))
const eq = vi.fn(() => ({ gte }))
const select = vi.fn(() => ({ eq, order }))
const from = vi.fn(() => ({ select, upsert }))
vi.mock('../lib/supabase', () => ({
  supabase: { rpc: (...args) => rpc(...args), from: (...args) => from(...args) },
}))

beforeEach(() => {
  vi.clearAllMocks()
  rpc.mockResolvedValue({ error: null })
  upsert.mockResolvedValue({ error: null })
  order.mockResolvedValue({ data: [{ id: 'service-1', meal: { name: 'Repas de service' } }], error: null })
})

describe('services de repas par défaut', () => {
  it('crée les services manquants puis charge uniquement les plats disponibles', async () => {
    expect(await fetchMenus('2026-10-12', '2026-10-18')).toEqual([{ id: 'service-1', meal: { name: 'Repas de service' } }])
    expect(rpc).toHaveBeenCalledWith('ensure_meal_services', {
      from_date: '2026-10-12', to_date: '2026-10-18',
    })
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(from.mock.invocationCallOrder[0])
    expect(select).toHaveBeenCalledWith(expect.stringContaining('meal:meals!inner'))
    expect(eq).toHaveBeenCalledWith('meal.is_active', true)
  })

  it('filtre le catalogue disponible côté requête', async () => {
    const catalogueEq = vi.fn().mockResolvedValue({ data: [], error: null })
    const catalogueSelect = vi.fn(() => ({ order: () => ({ eq: catalogueEq }) }))
    from.mockReturnValueOnce({ select: catalogueSelect })
    await fetchMeals({ activeOnly: true })
    expect(catalogueEq).toHaveBeenCalledWith('is_active', true)
    expect(catalogueSelect).toHaveBeenCalledWith(expect.stringContaining('is_service'))
  })

  it('remonte une erreur de création sans fournir une grille incomplète', async () => {
    rpc.mockResolvedValueOnce({ error: new Error('Services indisponibles') })
    await expect(fetchMenus('2026-10-12', '2026-10-18')).rejects.toThrow('Services indisponibles')
    expect(from).not.toHaveBeenCalled()
  })

  it('remonte une erreur de lecture', async () => {
    order.mockResolvedValueOnce({ error: new Error('Lecture impossible') })
    await expect(fetchMenus('2026-10-12', '2026-10-18')).rejects.toThrow('Lecture impossible')
  })

  it.each(['', 'meal-1'])('retire ou publie un plat sans supprimer le service : %s', async (mealId) => {
    await setMenu('2026-10-12', 'dejeuner', mealId)
    expect(upsert).toHaveBeenCalledWith({
      menu_date: '2026-10-12', service: 'dejeuner', meal_id: mealId || null,
    }, { onConflict: 'menu_date,service' })
  })
})
