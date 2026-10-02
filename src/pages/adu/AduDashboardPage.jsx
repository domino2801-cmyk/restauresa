import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Card, EmptyState, Input, PageHeader, Select, Spinner, StatCard } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../hooks/useAuth'
import { HEADCOUNT_STATUS_LABELS, SERVICES, SERVICE_LABELS } from '../../lib/constants'
import { downloadCSV, toCSV } from '../../lib/csv'
import { aduReservationDeadline, formatAduReservationDeadline, formatDayLabel, isAduReservationOpen, toISODate } from '../../lib/dates'
import { errorMessage } from '../../lib/errors'
import { formatOrganizationName } from '../../lib/organization'
import { groupBySection, percent, sortMembers } from '../../lib/stats'
import { fetchMenus } from '../../services/meals'
import { fetchCompanyMembers } from '../../services/profiles'
import {
  fetchHeadcounts,
  fetchReservationsForMenus,
  setAttendance,
  setCompanyReservation,
  submitHeadcount,
} from '../../services/reservations'

const SORT_OPTIONS = [
  { value: 'section', label: 'Trier par section' },
  { value: 'name', label: 'Trier par nom' },
  { value: 'status', label: 'Trier par statut' },
]
const FILTER_OPTIONS = [
  { value: 'all', label: 'Tous' },
  { value: 'reserved', label: 'Ayant réservé' },
  { value: 'missing', label: "N'ayant pas réservé" },
]
const STATUS_TONES = { submitted: 'khaki', approved: 'olive', rejected: 'red' }

/** Interface ADU : suivi des réservations de la compagnie et transmission aux cuisines. */
export default function AduDashboardPage() {
  const { profile } = useAuth()
  const companyId = profile.company_id
  const [date, setDate] = useState(() => toISODate(new Date()))
  const [service, setService] = useState('dejeuner')
  const [sortKey, setSortKey] = useState('section')
  const [filter, setFilter] = useState('all')
  const [actionError, setActionError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [now, setNow] = useState(() => new Date())
  const deadline = aduReservationDeadline(date).getTime()
  const reservationsOpen = now.getTime() < deadline

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
    if (!companyId) return null
    const [members, menus] = await Promise.all([fetchCompanyMembers(companyId), fetchMenus(date, date)])
    const menuIds = menus.map((m) => m.id)
    const [reservations, headcounts] = await Promise.all([
      fetchReservationsForMenus(menuIds),
      fetchHeadcounts(companyId, menuIds),
    ])
    return { date, members, menus, reservations, headcounts }
  }, [companyId, date])

  const { data, error, loading, reload } = useAsync(load)
  const ready = data?.date === date && !loading && !error

  const view = useMemo(() => {
    if (!data || data.date !== date) return null
    const memberIds = new Set(data.members.map((m) => m.id))
    const companyReservations = data.reservations.filter((r) => memberIds.has(r.user_id) && r.status === 'reserved')
    const countFor = (menuId) => companyReservations.filter((r) => r.menu_id === menuId).length

    const menu = data.menus.find((m) => m.service === service)
    const reservationByUser = new Map(
      companyReservations.filter((r) => r.menu_id === menu?.id).map((r) => [r.user_id, r]),
    )
    const rows = data.members.map((m) => ({
      ...m,
      hasReserved: reservationByUser.has(m.id),
      reservation: reservationByUser.get(m.id) ?? null,
    }))
    const filtered = rows.filter((r) =>
      filter === 'reserved' ? r.hasReserved : filter === 'missing' ? !r.hasReserved : true,
    )

    return {
      menu,
      rows: sortMembers(filtered, sortKey),
      reservedCount: reservationByUser.size,
      sections: groupBySection(data.members, new Set(reservationByUser.keys())),
      headcount: data.headcounts.find((h) => h.menu_id === menu?.id),
      perService: SERVICES.map((s) => {
        const m = data.menus.find((x) => x.service === s)
        return { service: s, menu: m, count: m ? countFor(m.id) : null }
      }),
    }
  }, [data, date, service, sortKey, filter])

  const run = async (key, action) => {
    setBusy(key)
    setActionError(null)
    try {
      await action()
      await reload()
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const exportCsv = () => {
    const headers = ['Régiment', 'CIE', 'SECT', 'Nom', 'Date', 'Service', 'Repas', 'Réservé', 'Présent']
    const rows = sortMembers(view.rows, 'section').map((r) => [
      formatOrganizationName(profile.regiment?.name),
      formatOrganizationName(profile.company?.name),
      formatOrganizationName(r.section?.name ?? ''),
      r.full_name,
      date,
      SERVICE_LABELS[service],
      view.menu?.meal?.name ?? '',
      r.hasReserved ? 'Oui' : 'Non',
      r.reservation?.attended === true ? 'Oui' : r.reservation?.attended === false ? 'Non' : '',
    ])
    downloadCSV(`effectifs_${date}_${service}.csv`, toCSV(headers, rows))
  }

  const changeReservation = (row, reserved) => {
    if (!isAduReservationOpen(date)) {
      setNow(() => new Date())
      setActionError('Modifications ADU clôturées : échéance de J-2 à 14 h (heure de Paris) dépassée.')
      return
    }
    return run(`booking-${row.id}`, () => setCompanyReservation(row.id, view.menu.id, reserved))
  }

  if (!companyId) {
    return <Alert tone="warning">Aucune compagnie ne vous est affectée. Contactez un administrateur.</Alert>
  }

  return (
    <>
      <PageHeader
        title={`CIE — ${formatOrganizationName(profile.company?.name)}`}
        subtitle={formatOrganizationName(profile.regiment?.name)}
        actions={
          <fieldset disabled={busy !== null} className="grid w-full grid-cols-2 gap-2 sm:w-auto">
            <Input aria-label="Date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
            <Select
              aria-label="Service"
              value={service}
              options={SERVICES.map((s) => ({ value: s, label: SERVICE_LABELS[s] }))}
              onChange={(e) => setService(e.target.value)}
            />
          </fieldset>
        }
      />
      <Alert tone="error" className="mb-4">
        {actionError ?? errorMessage(error)}
      </Alert>

      {loading && !view ? (
        <Spinner />
      ) : (
        view && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Effectif" value={data.members.length} />
              <StatCard label="Ont réservé" value={view.reservedCount} tone="olive" />
              <StatCard label="Sans réservation" value={data.members.length - view.reservedCount} tone="khaki" />
              <StatCard
                label="Taux"
                value={`${percent(view.reservedCount, data.members.length)} %`}
                hint={view.menu?.meal?.name ?? 'Plat non publié'}
              />
            </div>

            <Card title={`Effectifs du ${formatDayLabel(date, { weekday: 'long', day: 'numeric', month: 'long' })}`}>
              <div className="grid gap-3 sm:grid-cols-3">
                {view.perService.map(({ service: s, menu, count }) => (
                  <button
                    key={s}
                    type="button"
                    disabled={busy !== null}
                    onClick={() => setService(s)}
                    className={`rounded-md border p-3 text-left ${
                      s === service ? 'border-navy-900 bg-navy-50' : 'border-steel-200 hover:bg-steel-50'
                    }`}
                  >
                    <p className="text-xs font-semibold tracking-wider text-olive-700 uppercase">{SERVICE_LABELS[s]}</p>
                    <p className="text-2xl font-bold text-navy-900">{count ?? '—'}</p>
                    <p className="truncate text-xs text-steel-600">{menu?.meal?.name ?? 'Plat non publié'}</p>
                  </button>
                ))}
              </div>
            </Card>

            <Card
              title="Transmission aux cuisines"
              actions={
                view.headcount && (
                  <Badge tone={STATUS_TONES[view.headcount.status]}>
                    {HEADCOUNT_STATUS_LABELS[view.headcount.status]}
                  </Badge>
                )
              }
            >
              <Alert tone="warning" className="mb-3">
                {view.headcount && (
                  view.headcount.reserved_count !== view.reservedCount
                  || view.headcount.total_members !== data.members.length
                ) ? (
                  view.headcount.status === 'approved'
                    ? 'Les réservations ont changé : l’effectif approuvé ne correspond plus au tableau. Faites revoir cet effectif par le CDU.'
                    : 'Les réservations ont changé : mettez à jour l’effectif transmis aux cuisines.'
                ) : null}
              </Alert>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-steel-700">
                  {view.headcount
                    ? `Effectif transmis : ${view.headcount.reserved_count} / ${view.headcount.total_members}` +
                      (view.headcount.comment ? ` — « ${view.headcount.comment} »` : '')
                    : "L'effectif de ce service n'a pas encore été transmis."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={exportCsv} disabled={!view.menu}>
                    Exporter (CSV)
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={!ready || !view.menu || view.headcount?.status === 'approved' || busy !== null}
                    loading={busy === 'submit'}
                    onClick={() =>
                      run('submit', () =>
                        submitHeadcount({
                          companyId,
                          menuId: view.menu.id,
                          reservedCount: view.reservedCount,
                          totalMembers: data.members.length,
                        }),
                      )
                    }
                  >
                    {view.headcount ? "Mettre à jour l'effectif" : "Valider l'effectif"}
                  </Button>
                </div>
              </div>
            </Card>

            <Card title="Synthèse par section">
              {view.sections.length === 0 ? (
                <EmptyState>Aucun membre.</EmptyState>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {view.sections.map((s) => (
                    <div key={s.section} className="rounded-md border border-steel-200 p-3">
                      <p className="text-sm font-semibold text-navy-900">{s.section}</p>
                      <p className="text-xs text-steel-600">
                        {s.reserved} / {s.total} — {percent(s.reserved, s.total)} %
                      </p>
                      <div className="mt-2 h-1.5 rounded bg-steel-100">
                        <div className="h-1.5 rounded bg-olive-700" style={{ width: `${percent(s.reserved, s.total)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card
              title="Qui a réservé ?"
              actions={
                <>
                  <Select aria-label="Filtre" value={filter} options={FILTER_OPTIONS} onChange={(e) => setFilter(e.target.value)} />
                  <Select aria-label="Tri" value={sortKey} options={SORT_OPTIONS} onChange={(e) => setSortKey(e.target.value)} />
                </>
              }
            >
              <Alert tone={reservationsOpen ? 'info' : 'warning'} className="mb-3">
                {reservationsOpen
                  ? `Vous pouvez réserver ou annuler les repas de tous les personnels de votre CIE jusqu’au ${formatAduReservationDeadline(date)} (J-2). Chaque case est enregistrée immédiatement.`
                  : `Modifications ADU clôturées depuis le ${formatAduReservationDeadline(date)} (J-2). Le pointage de présence reste disponible.`}
              </Alert>
              {!view.menu ? (
                <EmptyState>Service indisponible.</EmptyState>
              ) : view.rows.length === 0 ? (
                <EmptyState>Aucun militaire ne correspond au filtre.</EmptyState>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-xs tracking-wider text-steel-600 uppercase">
                      <tr>
                        <th className="py-2 pr-4">Section</th>
                        <th className="py-2 pr-4">Nom</th>
                        <th className="py-2 pr-4">Statut</th>
                        <th className="py-2 pr-4">Réservation</th>
                        <th className="py-2">Présence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-steel-100">
                      {view.rows.map((row) => (
                        <tr key={row.id}>
                          <td className="py-2 pr-4 text-steel-600">{formatOrganizationName(row.section?.name ?? '—')}</td>
                          <td className="py-2 pr-4 font-medium">{row.full_name}</td>
                          <td className="py-2 pr-4">
                            {row.hasReserved ? <Badge tone="olive">Réservé</Badge> : <Badge tone="steel">Non réservé</Badge>}
                          </td>
                          <td className="py-2 pr-4">
                            <input
                              type="checkbox"
                              className="size-5 accent-olive-700 disabled:cursor-not-allowed"
                              aria-label={`Réserver ${SERVICE_LABELS[service]} pour ${row.full_name}`}
                              checked={row.hasReserved}
                              disabled={!ready || !reservationsOpen || busy !== null}
                              onChange={(event) => changeReservation(row, event.target.checked)}
                            />
                          </td>
                          <td className="py-2">
                            {row.reservation && (
                              <label className="inline-flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 accent-olive-700"
                                  checked={row.reservation.attended === true}
                                  disabled={!ready || busy !== null}
                                  onChange={(e) =>
                                    run(row.reservation.id, () => setAttendance(row.reservation.id, e.target.checked))
                                  }
                                />
                                <span className="text-xs text-steel-600">Présent</span>
                              </label>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )
      )}
    </>
  )
}
