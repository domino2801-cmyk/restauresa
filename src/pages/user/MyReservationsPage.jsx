import { useCallback, useEffect, useMemo, useState } from 'react'
import { WeekNavigator } from '../../components/WeekNavigator'
import { Alert, Button, Card, PageHeader, Spinner } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../hooks/useAuth'
import { SERVICES, SERVICE_LABELS, SERVICE_SHORT_LABELS } from '../../lib/constants'
import { addDays, formatDayLabel, formatReservationDeadline, isReservationOpen, reservationDeadline, startOfWeek, toISODate, weekDays } from '../../lib/dates'
import { errorMessage } from '../../lib/errors'
import { formatOrganizationName } from '../../lib/organization'
import { fetchMenus } from '../../services/meals'
import { fetchReservationsForMenus, saveMealSelections } from '../../services/reservations'

/** Réservation des repas de la semaine pour l'utilisateur connecté (tous rôles). */
export default function MyReservationsPage() {
  const { profile } = useAuth()
  const [monday, setMonday] = useState(() => startOfWeek(new Date()))
  const [includeWeekend, setIncludeWeekend] = useState(false)
  const [pending, setPending] = useState(false)
  const [drafts, setDrafts] = useState({})
  const [confirmed, setConfirmed] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [now, setNow] = useState(() => new Date())
  const days = useMemo(() => weekDays(monday), [monday])
  const weekKey = toISODate(monday)
  const deadline = reservationDeadline(weekKey).getTime()
  const bookingOpen = now.getTime() < deadline
  const draft = drafts[weekKey] ?? {}
  const visibleDays = includeWeekend ? days : days.slice(0, 5)

  useEffect(() => {
    const refresh = () => setNow(new Date())
    const delay = deadline - Date.now()
    const timer = delay > 0 && delay <= 2147483647 ? setTimeout(refresh, delay) : null
    const interval = setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    refresh()
    return () => {
      clearTimeout(timer)
      clearInterval(interval)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [deadline])

  const load = useCallback(async () => {
    const menus = await fetchMenus(toISODate(monday), toISODate(addDays(monday, 6)))
    const reservations = await fetchReservationsForMenus(menus.map((m) => m.id))
    return { weekKey: toISODate(monday), menus, reservations: reservations.filter((r) => r.user_id === profile.id) }
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
  const ready = data?.weekKey === weekKey && !loading && !error
  const defaultLunch = (menu) => menu.service === 'dejeuner' && days.slice(0, 4).includes(menu.menu_date)
  const isSelected = (menu) => {
    const reservation = reservationByMenu.get(menu.id)
    if (!bookingOpen) return reservation?.status === 'reserved'
    return draft[menu.id] ?? (reservation
      ? reservation.status === 'reserved'
      : defaultLunch(menu))
  }
  const changes = ready && bookingOpen ? data.menus
    .filter((menu) => {
      const reservation = reservationByMenu.get(menu.id)
      return isSelected(menu) !== (reservation?.status === 'reserved') || (!reservation && defaultLunch(menu))
    })
    .map((menu) => ({ menuId: menu.id, reserved: isSelected(menu) })) : []
  const reservationsDone = ready && changes.length === 0 && (confirmed || data.reservations.length > 0)

  const toggle = (menu) => {
    if (!isReservationOpen(menu.menu_date)) {
      setNow(() => new Date())
      setActionError('Réservations clôturées : aucune réservation, modification ou annulation n’est possible.')
      return
    }
    setDrafts((current) => ({
      ...current,
      [weekKey]: { ...current[weekKey], [menu.id]: !isSelected(menu) },
    }))
    setConfirmed(false)
    setActionError(null)
  }

  const confirm = async () => {
    if (!isReservationOpen(weekKey)) {
      setNow(() => new Date())
      setActionError('Réservations clôturées : vos choix non confirmés n’ont pas été enregistrés.')
      return
    }
    setPending(true)
    setConfirmed(false)
    setActionError(null)
    try {
      await saveMealSelections(profile.id, changes)
      setConfirmed(true)
      await reload()
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setPending(false)
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
        actions={
          <fieldset disabled={pending}>
            <WeekNavigator monday={monday} onChange={(nextMonday) => {
              setMonday(nextMonday)
              setConfirmed(false)
              setActionError(null)
            }} />
          </fieldset>
        }
      />
      <Alert tone="error" className="mb-4">
        {actionError ?? errorMessage(error)}
      </Alert>
      <Alert tone="success" className="mb-4">
        {reservationsDone ? 'Réservations effectuées.' : null}
      </Alert>
      <Alert tone={bookingOpen ? 'info' : 'warning'} className="mb-4">
        {bookingOpen
          ? reservationsDone ? null : `Confirmez vos repas avant le ${formatReservationDeadline(weekKey)}.`
          : `Réservations clôturées depuis le ${formatReservationDeadline(weekKey)}. Aucune réservation, modification ou annulation n’est possible. Seuls les repas enregistrés sont affichés cochés.`}
      </Alert>
      {loading || (data && data.weekKey !== weekKey) ? (
        <Spinner />
      ) : (
        <Card title="Réservations de la semaine">
          <label className="mb-3 flex min-h-12 cursor-pointer items-center gap-3 text-sm text-steel-900">
            <input
              type="checkbox"
              className="size-5 accent-olive-700"
              checked={includeWeekend}
              onChange={(event) => setIncludeWeekend(event.target.checked)}
            />
            Week-end
          </label>
          <div>
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col />
                {SERVICES.map((service) => (
                  <col key={service} className="w-11 sm:w-20" />
                ))}
              </colgroup>
              <thead>
                <tr className="border-b border-steel-200 text-left text-xs tracking-wider text-steel-600 uppercase">
                  <th scope="col" className="py-3 pr-3">Jour</th>
                  {SERVICES.map((service) => (
                    <th key={service} scope="col" className="px-0 py-3 text-center sm:px-3">
                      <span title={SERVICE_LABELS[service]}>{SERVICE_SHORT_LABELS[service]}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-steel-100">
                {visibleDays.map((day) => {
                  const editable = bookingOpen
                  const dayLabel = formatDayLabel(day, { weekday: 'long', day: 'numeric', month: 'long' })
                  return (
                    <tr key={day}>
                      <th scope="row" className="py-2 pr-2 text-left font-medium break-words text-steel-900 sm:pr-3">
                        <time dateTime={day}>{dayLabel}</time>
                      </th>
                      {SERVICES.map((service) => {
                        const menu = menuIndex.get(`${day}|${service}`)
                        const available = Boolean(menu && editable)
                        const label = `${SERVICE_LABELS[service]} ${dayLabel}${
                          !menu ? ' — service indisponible' : !editable ? ' — réservation fermée' : ''
                        }`
                        return (
                          <td key={service} className="px-0 py-1 text-center sm:px-3">
                              <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-md hover:bg-olive-50 has-[:disabled]:cursor-not-allowed has-[:disabled]:hover:bg-transparent">
                                <input
                                  type="checkbox"
                                  className="size-5 accent-olive-700 disabled:cursor-not-allowed"
                                  checked={menu ? isSelected(menu) : false}
                                  disabled={!available || pending || !ready}
                                  aria-label={label}
                                  onChange={() => toggle(menu)}
                                />
                              </label>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-steel-600">
            Avant la clôture, les DEJ du lundi au jeudi sont précochés, même si les plats ne sont pas encore publiés.
            Cochez ou décochez vos repas, puis confirmez pour enregistrer vos réservations ou annulations.
          </p>
          <p className="mt-1 text-xs text-steel-600">
            Cochez « Week-end » pour afficher samedi et dimanche. Masquer ces jours ne supprime pas leurs réservations.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button className="w-full whitespace-normal sm:w-auto" loading={pending} disabled={!ready || changes.length === 0} onClick={confirm}>
              Confirmer mes réservations
            </Button>
            {changes.length > 0 && (
              <p role="status" className="text-sm text-steel-600">Choix non enregistrés : confirmation nécessaire.</p>
            )}
          </div>
        </Card>
      )}
    </>
  )
}
