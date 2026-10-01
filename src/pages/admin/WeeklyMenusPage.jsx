import { useCallback, useMemo, useState } from 'react'
import { WeekNavigator } from '../../components/WeekNavigator'
import { Alert, Card, PageHeader, Select, Spinner } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { SERVICES, SERVICE_LABELS } from '../../lib/constants'
import { addDays, formatDayLabel, startOfWeek, toISODate, weekDays } from '../../lib/dates'
import { errorMessage } from '../../lib/errors'
import { fetchMeals, fetchMenus, setMenu } from '../../services/meals'

/** Planification des menus de la semaine (un repas par service et par jour). */
export default function WeeklyMenusPage() {
  const [monday, setMonday] = useState(() => startOfWeek(new Date()))
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(null)
  const days = useMemo(() => weekDays(monday), [monday])

  const load = useCallback(async () => {
    const [meals, menus] = await Promise.all([
      fetchMeals(),
      fetchMenus(toISODate(monday), toISODate(addDays(monday, 6))),
    ])
    return { meals, menus }
  }, [monday])

  const { data, error: loadError, loading, reload } = useAsync(load)

  const menuIndex = useMemo(
    () => new Map((data?.menus ?? []).map((m) => [`${m.menu_date}|${m.service}`, m])),
    [data],
  )

  const optionsFor = (current) =>
    (data?.meals ?? [])
      .filter((meal) => meal.is_active || meal.id === current)
      .map((meal) => ({ value: meal.id, label: meal.name }))

  const change = async (day, service, mealId) => {
    const key = `${day}|${service}`
    setSaving(key)
    setError(null)
    try {
      await setMenu(day, service, mealId)
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
        subtitle="Sélectionnez le repas servi pour chaque service."
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
                {SERVICES.map((service) => {
                  const key = `${day}|${service}`
                  const current = menuIndex.get(key)?.meal_id ?? ''
                  return (
                    <Select
                      key={service}
                      label={SERVICE_LABELS[service]}
                      value={current}
                      placeholder="— Aucun —"
                      options={optionsFor(current)}
                      disabled={saving === key}
                      onChange={(e) => change(day, service, e.target.value)}
                    />
                  )
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
