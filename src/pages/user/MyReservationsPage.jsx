import { useCallback, useMemo, useState } from 'react'
import { WeekNavigator } from '../../components/WeekNavigator'
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Spinner } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../hooks/useAuth'
import { SERVICES, SERVICE_LABELS } from '../../lib/constants'
import { addDays, formatDayLabel, isTodayOrFuture, startOfWeek, toISODate, weekDays } from '../../lib/dates'
import { errorMessage } from '../../lib/errors'
import { fetchMenus } from '../../services/meals'
import { cancelReservation, fetchReservationsForMenus, reserveMeal } from '../../services/reservations'

/** Réservation des repas de la semaine pour l'utilisateur connecté (tous rôles). */
export default function MyReservationsPage() {
  const { profile } = useAuth()
  const [monday, setMonday] = useState(() => startOfWeek(new Date()))
  const [pending, setPending] = useState(null)
  const [actionError, setActionError] = useState(null)
  const days = useMemo(() => weekDays(monday), [monday])

  const load = useCallback(async () => {
    const menus = await fetchMenus(toISODate(monday), toISODate(addDays(monday, 6)))
    const reservations = await fetchReservationsForMenus(menus.map((m) => m.id))
    return { menus, reservations: reservations.filter((r) => r.user_id === profile.id) }
  }, [monday, profile.id])

  const { data, error, loading, reload } = useAsync(load)

  const menuIndex = useMemo(() => {
    const index = new Map()
    for (const menu of data?.menus ?? []) index.set(`${menu.menu_date}|${menu.service}`, menu)
    return index
  }, [data])

  const reservationByMenu = useMemo(
    () => new Map((data?.reservations ?? []).map((r) => [r.menu_id, r])),
    [data],
  )

  const reservedCount = (data?.reservations ?? []).filter((r) => r.status === 'reserved').length

  const toggle = async (menu) => {
    const reservation = reservationByMenu.get(menu.id)
    setPending(menu.id)
    setActionError(null)
    try {
      if (reservation?.status === 'reserved') await cancelReservation(reservation.id)
      else await reserveMeal(profile.id, menu.id)
      await reload()
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setPending(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Mes repas"
        subtitle={`${reservedCount} repas réservé${reservedCount > 1 ? 's' : ''} cette semaine`}
        actions={<WeekNavigator monday={monday} onChange={setMonday} />}
      />
      <Alert tone="error" className="mb-4">
        {actionError ?? errorMessage(error)}
      </Alert>
      {loading && !data ? (
        <Spinner />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {days.map((day) => {
            const editable = isTodayOrFuture(day)
            return (
              <Card key={day} title={formatDayLabel(day, { weekday: 'long', day: 'numeric', month: 'long' })}>
                <ul className="divide-y divide-steel-100">
                  {SERVICES.map((service) => {
                    const menu = menuIndex.get(`${day}|${service}`)
                    const reserved = menu && reservationByMenu.get(menu.id)?.status === 'reserved'
                    return (
                      <li key={service} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold tracking-wider text-olive-700 uppercase">
                            {SERVICE_LABELS[service]}
                          </p>
                          {menu ? (
                            <p className="truncate text-sm text-steel-900">{menu.meal?.name}</p>
                          ) : (
                            <p className="text-sm text-steel-400 italic">Aucun menu</p>
                          )}
                        </div>
                        {menu &&
                          (editable ? (
                            <Button
                              size="sm"
                              variant={reserved ? 'outline' : 'secondary'}
                              loading={pending === menu.id}
                              onClick={() => toggle(menu)}
                              aria-pressed={reserved}
                            >
                              {reserved ? 'Annuler' : 'Réserver'}
                            </Button>
                          ) : (
                            <Badge tone={reserved ? 'olive' : 'steel'}>{reserved ? 'Réservé' : '—'}</Badge>
                          ))}
                      </li>
                    )
                  })}
                </ul>
              </Card>
            )
          })}
        </div>
      )}
      {data && data.menus.length === 0 && <EmptyState>Aucun menu publié pour cette semaine.</EmptyState>}
    </>
  )
}
