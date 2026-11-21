import { useCallback, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { WeekNavigator } from '../../components/WeekNavigator'
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Spinner, StatCard } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useAuth } from '../../hooks/useAuth'
import { HEADCOUNT_STATUS_LABELS, ROLES, SERVICES, SERVICE_LABELS } from '../../lib/constants'
import { addDays, formatDayLabel, startOfWeek, toISODate, weekDays } from '../../lib/dates'
import { errorMessage } from '../../lib/errors'
import { formatOrganizationName } from '../../lib/organization'
import { activeReservations, attendanceRate, attendanceTotals, companyAttendanceByDay, companyAttendanceBySection, groupBySection, percent, reservationRate } from '../../lib/stats'
import { fetchMenus } from '../../services/meals'
import { fetchCompanyMembers } from '../../services/profiles'
import { fetchHeadcounts, fetchReservationsForMenus, reviewHeadcount } from '../../services/reservations'

const STATUS_TONES = { submitted: 'khaki', approved: 'olive', rejected: 'red' }
const euro = (value) => value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

/** Interface CDU : supervision, indicateurs clés et revue des effectifs. */
export default function CduDashboardPage({ companyContext } = {}) {
  const { profile: account } = useAuth()
  const profile = account.role === ROLES.ADMIN && companyContext ? { ...account, ...companyContext } : account
  const companyId = profile.company_id
  const [monday, setMonday] = useState(() => startOfWeek(new Date()))
  const [actionError, setActionError] = useState(null)
  const [busy, setBusy] = useState(null)
  const days = useMemo(() => weekDays(monday), [monday])

  const load = useCallback(async () => {
    if (!companyId) return null
    const [members, menus] = await Promise.all([
      fetchCompanyMembers(companyId),
      fetchMenus(toISODate(monday), toISODate(addDays(monday, 6))),
    ])
    const menuIds = menus.map((m) => m.id)
    const [reservations, headcounts] = await Promise.all([
      fetchReservationsForMenus(menuIds),
      fetchHeadcounts(companyId, menuIds),
    ])
    const validated = members.filter((m) => m.is_validated)
    const memberIds = new Set(validated.map((m) => m.id))
    return {
      members: validated,
      menus,
      reservations: reservations.filter((r) => memberIds.has(r.user_id)),
      headcounts,
      today: new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(new Date()),
    }
  }, [companyId, monday])

  const { data, error, loading, reload } = useAsync(load)

  const kpis = useMemo(() => {
    if (!data) return null
    const active = activeReservations(data.reservations)

    const dailyAttendance = companyAttendanceByDay(days, data.menus, data.reservations, data.today)
    const weeklyTotals = attendanceTotals(dailyAttendance)
    const sectionAttendance = companyAttendanceBySection(days, data.menus, data.reservations, data.members, data.today)
    const perDay = dailyAttendance.map((row) => ({
      label: formatDayLabel(row.day),
      'Effectif prévu': row.planned,
      'Effectif passé': row.future ? null : row.attended,
    }))

    const sectionRates = groupBySection(data.members, new Set(active.map((r) => r.user_id))).map((s) => {
      const ids = new Set(s.members.map((m) => m.id))
      const count = active.filter((r) => ids.has(r.user_id)).length
      return { section: formatOrganizationName(s.section), Taux: percent(count, s.total * data.menus.length) }
    })

    const headcountByMenu = new Map(data.headcounts.map((h) => [h.menu_id, h]))
    const review = [...data.menus]
      .sort((a, b) => a.menu_date.localeCompare(b.menu_date) || SERVICES.indexOf(a.service) - SERVICES.indexOf(b.service))
      .map((menu) => {
        const current = active.filter((r) => r.menu_id === menu.id).length
        const headcount = headcountByMenu.get(menu.id)
        const count = headcount?.reserved_count ?? current
        const cost = menu.meal ? count * Number(menu.meal.unit_price) : null
        return { menu, current, headcount, cost, unpriced: cost === null ? count : 0 }
      })

    return {
      reservationRate: reservationRate(data.reservations, data.members.length, data.menus.length),
      attendanceRate: attendanceRate(data.reservations),
      totalCost: review.reduce((sum, r) => sum + (r.cost ?? 0), 0),
      unpriced: review.reduce((sum, r) => sum + r.unpriced, 0),
      pending: data.headcounts.filter((h) => h.status === 'submitted').length,
      perDay,
      dailyAttendance,
      attendanceTotals: weeklyTotals,
      sectionAttendance,
      sectionRates,
      review,
    }
  }, [data, days])

  const decide = async (headcount, status) => {
    let comment = null
    if (status === 'rejected') {
      comment = window.prompt('Motif du rejet (transmis à l’ADU) :') ?? null
      if (comment === null) return
    }
    setBusy(headcount.id)
    setActionError(null)
    try {
      await reviewHeadcount(headcount.id, status, comment)
      await reload()
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  if (!companyId) {
    return <Alert tone="warning">Aucune compagnie ne vous est affectée. Contactez un administrateur.</Alert>
  }

  return (
    <>
      <PageHeader
        title={`Supervision — ${formatOrganizationName(profile.company?.name)}`}
        subtitle={formatOrganizationName(profile.regiment?.name)}
        actions={<WeekNavigator monday={monday} onChange={setMonday} />}
      />
      <Alert tone="error" className="mb-4">
        {actionError ?? errorMessage(error)}
      </Alert>
      {loading && !kpis ? (
        <Spinner />
      ) : (
        kpis && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <StatCard label="Effectif" value={data.members.length} />
              <StatCard label="Taux de réservation" value={`${kpis.reservationRate} %`} tone="olive" hint="Sur la semaine" />
              <StatCard label="Taux de présence" value={`${kpis.attendanceRate} %`} tone="khaki" hint="Repas pointés" />
              <StatCard label="Coût estimé" value={euro(kpis.totalCost)} hint={kpis.unpriced ? `Partiel : ${kpis.unpriced} repas sans plat publié` : 'Sur la semaine'} />
              <StatCard label="À approuver" value={kpis.pending} tone={kpis.pending ? 'red' : 'olive'} />
              <StatCard
                label="Perte financière estimée"
                value={euro(kpis.attendanceTotals.loss)}
                tone="red"
                hint={kpis.attendanceTotals.unpriced
                  ? `Partiel : ${kpis.attendanceTotals.unpriced} absences sans prix`
                  : 'Absences pointées, hors repas futurs'}
              />
            </div>

            <Card title="Bilan quotidien de la compagnie">
              <p className="mb-3 text-sm text-steel-600">
                Effectif prévu : repas réservés. Effectif passé : présences pointées.
                Perte estimée : absences pointées × prix du repas, hors jours futurs.
                Les pointages manquants sont exclus de la perte ; le jour en cours reste provisoire.
                Un personnel réservant plusieurs services est compté une fois par repas.
              </p>
              {kpis.attendanceTotals.unpriced > 0 && (
                <Alert tone="warning">
                  Estimation partielle : {kpis.attendanceTotals.unpriced} absence(s) sans prix de repas renseigné.
                </Alert>
              )}
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-xs tracking-wider text-steel-600 uppercase">
                    <tr>
                      {['Jour', 'Effectif prévu', 'Effectif passé', 'Absences pointées', 'Pointages manquants', 'Perte estimée'].map((label) => (
                        <th key={label} className="py-2 pr-4">{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-steel-100">
                    {kpis.dailyAttendance.map((row) => (
                      <tr key={row.day}>
                        <td className="py-2 pr-4 whitespace-nowrap">{formatDayLabel(row.day)}</td>
                        <td className="py-2 pr-4">{row.planned}</td>
                        <td className="py-2 pr-4">{row.future ? 'À venir' : row.attended}</td>
                        <td className="py-2 pr-4">{row.future ? '—' : row.absent}</td>
                        <td className="py-2 pr-4">{row.future ? '—' : row.unchecked}</td>
                        <td className="py-2 pr-4 whitespace-nowrap">
                          {row.future ? '—' : `${euro(row.loss)}${row.unpriced ? ' (partiel)' : ''}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-steel-200 font-semibold">
                    <tr>
                      <th className="py-2 pr-4 text-left">Total semaine</th>
                      <td className="py-2 pr-4">{kpis.attendanceTotals.planned}</td>
                      <td className="py-2 pr-4">{kpis.attendanceTotals.attended}</td>
                      <td className="py-2 pr-4">{kpis.attendanceTotals.absent}</td>
                      <td className="py-2 pr-4">{kpis.attendanceTotals.unchecked}</td>
                      <td className="py-2 pr-4">{euro(kpis.attendanceTotals.loss)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>

            <Card title="Repas non consommés par section">
              <p className="mb-3 text-sm text-steel-600">
                Bilan de la semaine sélectionnée, classé par nombre de repas non consommés décroissant.
                Seules les absences explicitement pointées sont comptées, hors jours futurs.
                Le taux de non-consommation porte sur les repas pointés (présences et absences).
                Les réservations incluent toute la semaine ; les pointages manquants restent exclus des pertes.
                Le rattachement utilisé est la section actuelle du personnel.
              </p>
              {kpis.sectionAttendance.length === 0 ? (
                <EmptyState>Aucun membre.</EmptyState>
              ) : (
                <div className="overflow-x-auto">
                  <table aria-label="Bilan des repas par section" className="min-w-full text-sm">
                    <thead className="text-left text-xs tracking-wider text-steel-600 uppercase">
                      <tr>
                        {['Section', 'Réservés (semaine)', 'Consommés', 'Non consommés', 'Taux de non-consommation', 'Non pointés', 'Perte estimée'].map((label) => (
                          <th key={label} className="py-2 pr-4">{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-steel-100">
                      {kpis.sectionAttendance.map((row) => (
                        <tr key={row.section}>
                          <th scope="row" className="py-2 pr-4 text-left font-medium">{formatOrganizationName(row.section)}</th>
                          <td className="py-2 pr-4">{row.planned}</td>
                          <td className="py-2 pr-4">{row.attended}</td>
                          <td className="py-2 pr-4">{row.absent}</td>
                          <td className="py-2 pr-4">{row.absenceRate === null ? 'Non disponible' : `${row.absenceRate} %`}</td>
                          <td className="py-2 pr-4">{row.unchecked}</td>
                          <td className="py-2 pr-4 whitespace-nowrap">
                            {euro(row.loss)}
                            {row.unpriced > 0 && <span className="block text-xs text-steel-600">Partiel : {row.unpriced} absence(s) sans prix</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Effectifs prévus et passés par jour">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={kpis.perDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e6e8e3" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Effectif prévu" fill="#0b1f3a" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Effectif passé" fill="#4b5320" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card title="Taux de réservation par SECT (%)">
                {kpis.sectionRates.length === 0 ? (
                  <EmptyState>Aucun membre.</EmptyState>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={kpis.sectionRates} layout="vertical" margin={{ left: 24 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e6e8e3" />
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                        <YAxis type="category" dataKey="section" width={110} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="Taux" fill="#c3b091" radius={[0, 3, 3, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
            </div>

            <Card title="Revue des effectifs">
              {kpis.review.length === 0 ? (
                <EmptyState>Aucun service disponible pour cette semaine.</EmptyState>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-xs tracking-wider text-steel-600 uppercase">
                      <tr>
                        <th className="py-2 pr-4">Date</th>
                        <th className="py-2 pr-4">Service</th>
                        <th className="py-2 pr-4">Repas</th>
                        <th className="py-2 pr-4 text-right">Réservés</th>
                        <th className="py-2 pr-4 text-right">Transmis</th>
                        <th className="py-2 pr-4 text-right">Coût</th>
                        <th className="py-2 pr-4">Statut</th>
                        <th className="py-2">Décision</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-steel-100">
                      {kpis.review.map(({ menu, current, headcount, cost }) => (
                        <tr key={menu.id}>
                          <td className="py-2 pr-4 whitespace-nowrap">{formatDayLabel(menu.menu_date)}</td>
                          <td className="py-2 pr-4">{SERVICE_LABELS[menu.service]}</td>
                          <td className="py-2 pr-4">{menu.meal?.name ?? 'Repas de service'}</td>
                          <td className="py-2 pr-4 text-right">{current}</td>
                          <td className="py-2 pr-4 text-right">
                            {headcount ? `${headcount.reserved_count} / ${headcount.total_members}` : '—'}
                          </td>
                          <td className="py-2 pr-4 text-right whitespace-nowrap">{cost === null ? 'Non renseigné' : euro(cost)}</td>
                          <td className="py-2 pr-4">
                            {headcount ? (
                              <Badge tone={STATUS_TONES[headcount.status]}>{HEADCOUNT_STATUS_LABELS[headcount.status]}</Badge>
                            ) : (
                              <Badge>Non transmis</Badge>
                            )}
                          </td>
                          <td className="py-2">
                            {headcount && (
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={headcount.status === 'approved'}
                                  loading={busy === headcount.id}
                                  onClick={() => decide(headcount, 'approved')}
                                >
                                  Approuver
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={headcount.status === 'rejected' || busy === headcount.id}
                                  onClick={() => decide(headcount, 'rejected')}
                                >
                                  Rejeter
                                </Button>
                              </div>
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
