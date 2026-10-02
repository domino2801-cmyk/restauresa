import { useCallback, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { WeekNavigator } from '../../components/WeekNavigator'
import { Alert, Card, PageHeader, Spinner, StatCard } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { addDays, formatDayLabel, startOfWeek, toISODate, weekDays } from '../../lib/dates'
import { errorMessage } from '../../lib/errors'
import { formatOrganizationName } from '../../lib/organization'
import { activeReservations, countByDay, percent } from '../../lib/stats'
import { fetchMenus } from '../../services/meals'
import { fetchOrganization } from '../../services/organization'
import { fetchProfiles } from '../../services/profiles'
import { fetchReservationsForMenus } from '../../services/reservations'

/** Vue globale et analytique du système. */
export default function AdminOverviewPage() {
  const [monday, setMonday] = useState(() => startOfWeek(new Date()))
  const days = useMemo(() => weekDays(monday), [monday])

  const load = useCallback(async () => {
    const [profiles, menus, org] = await Promise.all([
      fetchProfiles(),
      fetchMenus(toISODate(monday), toISODate(addDays(monday, 6))),
      fetchOrganization(),
    ])
    const reservations = await fetchReservationsForMenus(menus.map((m) => m.id))
    return { profiles, menus, org, reservations }
  }, [monday])

  const { data, error, loading } = useAsync(load)

  const stats = useMemo(() => {
    if (!data) return null
    const menuById = new Map(data.menus.map((m) => [m.id, m]))
    const withMenu = data.reservations.map((r) => ({ ...r, menu: menuById.get(r.menu_id) }))
    const active = activeReservations(withMenu)
    const validated = data.profiles.filter((p) => p.is_validated)
    const companyOf = new Map(data.profiles.map((p) => [p.id, p.company_id]))

    const byCompany = data.org.companies.map((company) => {
      const members = validated.filter((p) => p.company_id === company.id).length
      const reservations = active.filter((r) => companyOf.get(r.user_id) === company.id).length
      const regiment = data.org.regiments.find((r) => r.id === company.regiment_id)
      return {
        id: company.id,
        name: formatOrganizationName(company.name),
        regiment: formatOrganizationName(regiment?.name ?? ''),
        members,
        reservations,
        rate: percent(reservations, members * data.menus.length),
      }
    })

    const cost = active.reduce((sum, r) => sum + Number(r.menu?.meal?.unit_price ?? 0), 0)

    return {
      totalUsers: data.profiles.length,
      pending: data.profiles.length - validated.length,
      weekReservations: active.length,
      cost,
      perDay: countByDay(days, withMenu).map((d) => ({ ...d, label: formatDayLabel(d.day) })),
      byCompany,
      rate: percent(active.length, validated.length * data.menus.length),
    }
  }, [data, days])

  return (
    <>
      <PageHeader
        title="Vue d'ensemble"
        subtitle="Statistiques globales des réservations"
        actions={<WeekNavigator monday={monday} onChange={setMonday} />}
      />
      <Alert tone="error">{errorMessage(error)}</Alert>
      {loading && !stats ? (
        <Spinner />
      ) : (
        stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <StatCard label="Utilisateurs" value={stats.totalUsers} />
              <StatCard label="À valider" value={stats.pending} tone={stats.pending ? 'red' : 'olive'} />
              <StatCard label="Réservations (sem.)" value={stats.weekReservations} tone="olive" />
              <StatCard label="Taux de réservation" value={`${stats.rate} %`} tone="khaki" />
              <StatCard
                label="Coût estimé (sem.)"
                value={stats.cost.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
              />
            </div>
            <Card title="Réservations par jour">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.perDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e6e8e3" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Réservations" fill="#0b1f3a" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="Par compagnie">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-xs tracking-wider text-steel-600 uppercase">
                    <tr>
                      <th className="py-2 pr-4">Régiment</th>
                      <th className="py-2 pr-4">CIE</th>
                      <th className="py-2 pr-4 text-right">Effectif</th>
                      <th className="py-2 pr-4 text-right">Réservations</th>
                      <th className="py-2 text-right">Taux</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-steel-100">
                    {stats.byCompany.map((row) => (
                      <tr key={row.id}>
                        <td className="py-2 pr-4 text-steel-600">{row.regiment}</td>
                        <td className="py-2 pr-4 font-medium">{row.name}</td>
                        <td className="py-2 pr-4 text-right">{row.members}</td>
                        <td className="py-2 pr-4 text-right">{row.reservations}</td>
                        <td className="py-2 text-right font-semibold">{row.rate} %</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )
      )}
    </>
  )
}
