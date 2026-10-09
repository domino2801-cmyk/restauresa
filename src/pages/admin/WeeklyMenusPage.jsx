import { useCallback, useMemo, useState } from 'react'
import { WeekNavigator } from '../../components/WeekNavigator'
import { Alert, Card, PageHeader, Select, Spinner } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { addDays, formatDayLabel, startOfWeek, toISODate, weekDays } from '../../lib/dates'
import { errorMessage } from '../../lib/errors'
import { fetchMeals, fetchMenus, setMenu } from '../../services/meals'

/** Planification des plats du déjeuner pour la semaine. */
export default function WeeklyMenusPage() {
  const [monday, setMonday] = useState(() => startOfWeek(new Date()))
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(null)
  const days = useMemo(() => weekDays(monday), [monday])

  const load = useCallback(async () => {
    const [meals, menus] = await Promise.all([
      fetchMeals({ activeOnly: true }),
      fetchMenus(toISODate(monday), toISODate(addDays(monday, 6))),
    ])
    return { meals, menus }
  }, [monday])

  const { data, error: loadError, loading, reload } = useAsync(load)

  const menuIndex = useMemo(
    () => new Map((data?.menus ?? []).map((m) => [`${m.menu_date}|${m.service}`, m])),
    [data],
  )

  const optionsFor = () =>
    (data?.meals ?? [])
      .filter((meal) => meal.is_active && !meal.is_service)
      .map((meal) => ({ value: meal.id, label: meal.name }))

  const change = async (day, mealId) => {
    setSaving(day)
    setError(null)
    try {
      await setMenu(day, 'dejeuner', mealId)
      await reload()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Menus de la semaine"
        subtitle="Repas de service par défaut pour PDJ / DEJ / DIN. Vous pouvez choisir un autre plat pour le déjeuner."
        actions={<WeekNavigator monday={monday} onChange={setMonday} />}
      />
      <Alert tone="error" className="mb-4">
        {error ?? errorMessage(loadError)}
      </Alert>
      {loading && !data ? (
        <Spinner />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {days.map((day) => (
            <Card key={day} title={formatDayLabel(day, { weekday: 'long', day: 'numeric', month: 'short' })}>
              <div className="space-y-3">
                <Select
                  label="Déjeuner"
                  value={menuIndex.get(`${day}|dejeuner`)?.meal?.is_service ? '' : menuIndex.get(`${day}|dejeuner`)?.meal_id ?? ''}
                  placeholder="Repas de service"
                  options={optionsFor()}
                  disabled={saving === day}
                  onChange={(e) => change(day, e.target.value)}
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
