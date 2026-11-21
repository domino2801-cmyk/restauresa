import { useState } from 'react'
import { Alert, Badge, Button, Card, EmptyState, Input, PageHeader, Spinner } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { errorMessage } from '../../lib/errors'
import { deleteMeal, fetchMeals, saveMeal } from '../../services/meals'

const EMPTY_MEAL = { id: null, name: '', description: '', category: '', unit_price: '', is_active: true }

/** Gestion du catalogue des repas. */
export default function MealsPage() {
  const { data: meals, error: loadError, loading, reload } = useAsync(fetchMeals)
  const [form, setForm] = useState(EMPTY_MEAL)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const setField = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    if (!form.name.trim()) {
      setError('Le nom du repas est obligatoire.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await saveMeal(form)
      setForm(EMPTY_MEAL)
      await reload()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const act = async (action) => {
    setError(null)
    try {
      await action()
      await reload()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <>
      <PageHeader title="Catalogue des repas" />
      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <Card title={form.id ? 'Modifier le repas' : 'Nouveau repas'}>
          <form onSubmit={submit} className="space-y-3">
            <Input label="Nom" required value={form.name} onChange={setField('name')} />
            <Input label="Description" value={form.description ?? ''} onChange={setField('description')} />
            <Input label="Catégorie" value={form.category ?? ''} onChange={setField('category')} />
            <Input
              label="Coût unitaire (€)"
              type="number"
              min="0"
              step="0.01"
              value={form.unit_price}
              onChange={setField('unit_price')}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="h-4 w-4 accent-olive-700"
              />
              Disponible
            </label>
            <div className="flex gap-2">
              <Button type="submit" loading={saving}>
                {form.id ? 'Mettre à jour' : 'Ajouter'}
              </Button>
              {form.id && (
                <Button variant="outline" onClick={() => setForm(EMPTY_MEAL)}>
                  Annuler
                </Button>
              )}
            </div>
          </form>
        </Card>
        <Card title={`Repas (${meals?.length ?? 0})`}>
          <Alert tone="error" className="mb-3">
            {error ?? errorMessage(loadError)}
          </Alert>
          {loading && !meals ? (
            <Spinner />
          ) : meals.length === 0 ? (
            <EmptyState>Aucun repas dans le catalogue.</EmptyState>
          ) : (
            <ul className="divide-y divide-steel-100">
              {meals.map((meal) => (
                <li key={meal.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-navy-900">
                      {meal.name}{' '}
                      {!meal.is_active && <Badge tone="red">Inactif</Badge>}
                    </p>
                    <p className="text-xs text-steel-600">
                      {[meal.category, meal.description].filter(Boolean).join(' — ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-olive-700">
                      {Number(meal.unit_price).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => setForm({ ...meal, unit_price: String(meal.unit_price) })}>
                      Modifier
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Supprimer ${meal.name}`}
                      onClick={() => window.confirm(`Supprimer « ${meal.name} » ?`) && act(() => deleteMeal(meal.id))}
                    >
                      ✕
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
