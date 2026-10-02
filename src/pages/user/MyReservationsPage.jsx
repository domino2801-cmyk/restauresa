import { useCallback, useMemo, useState } from 'react'
import { WeekNavigator } from '../../components/WeekNavigator'
import { Alert, Card, EmptyState, PageHeader, Spinner } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../hooks/useAuth'
import { SERVICES, SERVICE_LABELS, SERVICE_SHORT_LABELS } from '../../lib/constants'
import { addDays, formatDayLabel, isTodayOrFuture, startOfWeek, toISODate, weekDays } from '../../lib/dates'
import { errorMessage } from '../../lib/errors'
import { formatOrganizationName } from '../../lib/organization'
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
        subtitle={[
          profile.regiment?.name,
          profile.company?.name,
          profile.section?.name,
        ]
          .filter(Boolean)
          .map(formatOrganizationName)
          .concat(`${reservedCount} repas réservé${reservedCount > 1 ? 's' : ''} cette semaine`)
          .join(' · ')}
        actions={<WeekNavigator monday={monday} onChange={setMonday} />}
      />
      <Alert tone="error" className="mb-4">
        {actionError ?? errorMessage(error)}
      </Alert>
      {loading && !data ? (
        <Spinner />
      ) : (
        <Card title="Réservations de la semaine">
          <div className="-mx-2 overflow-x-auto px-2">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b border-steel-200 text-left text-xs tracking-wider text-steel-600 uppercase">
                  <th scope="col" className="py-3 pr-3">Jour</th>
                  {SERVICES.map((service) => (
                    <th key={service} scope="col" className="px-3 py-3 text-center">
                      <span title={SERVICE_LABELS[service]}>{SERVICE_SHORT_LABELS[service]}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-steel-100">
                {days.map((day) => {
                  const editable = isTodayOrFuture(day)
                  const dayLabel = formatDayLabel(day, { weekday: 'long', day: 'numeric', month: 'long' })
                  return (
                    <tr key={day}>
                      <th scope="row" className="py-2 pr-3 text-left font-medium text-steel-900">
                        <time dateTime={day}>{dayLabel}</time>
                      </th>
                      {SERVICES.map((service) => {
                        const menu = menuIndex.get(`${day}|${service}`)
                        const reservation = menu && reservationByMenu.get(menu.id)
                        const reserved = reservation?.status === 'reserved'
                        const available = Boolean(menu && editable)
                        const label = `${SERVICE_LABELS[service]} ${dayLabel}${
                          !menu ? ' — aucun menu publié' : !editable ? ' — réservation fermée' : ''
                        }`
                        return (
                          <td key={service} className="px-3 py-1 text-center">
                            {menu ? (
                              <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-md hover:bg-olive-50 has-[:disabled]:cursor-not-allowed has-[:disabled]:hover:bg-transparent">
                                <input
                                  type="checkbox"
                                  className="size-5 accent-olive-700 disabled:cursor-not-allowed"
                                  checked={Boolean(reserved)}
                                  disabled={!available || pending === menu.id}
                                  aria-label={label}
                                  onChange={() => toggle(menu)}
                                />
                              </label>
                            ) : (
                              <span
                                className="flex min-h-12 items-center justify-center text-steel-400"
                                aria-label={label}
                                title="Aucun menu publié"
                              >
                                —
                              </span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-steel-600">Cochez ou décochez un repas pour réserver ou annuler.</p>
        </Card>
      )}
      {data && data.menus.length === 0 && <EmptyState>Aucun menu publié pour cette semaine.</EmptyState>}
    </>
  )
}
