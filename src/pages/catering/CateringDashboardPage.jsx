import { useCallback, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { WeekNavigator } from '../../components/WeekNavigator'
import { Alert, Button, Card, EmptyState, PageHeader, Select, Spinner, StatCard } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { SERVICES, SERVICE_LABELS } from '../../lib/constants'
import { quarterHourAttendance, passagePercent } from '../../lib/catering'
import { addDays, formatDayLabel, startOfWeek, toISODate, weekDays } from '../../lib/dates'
import { errorMessage } from '../../lib/errors'
import { fetchCateringOverview } from '../../services/catering'

const percentLabel = (passed, reserved) => {
  const rate = passagePercent(passed, reserved)
  return rate === null ? 'Non disponible' : `${rate} %`
}

export default function CateringDashboardPage() {
  const [monday, setMonday] = useState(() => startOfWeek(new Date()))
  const [dayIndex, setDayIndex] = useState(0)
  const [service, setService] = useState('dejeuner')
  const days = useMemo(() => weekDays(monday), [monday])
  const load = useCallback(async () => {
    const overview = await fetchCateringOverview(toISODate(monday), toISODate(addDays(monday, 6)))
    return { ...overview, updatedAt: new Date() }
  }, [monday])
  const { data, error, loading, reload } = useAsync(load)
  const rows = useMemo(() => days.map((day) => {
    const row = data?.services.find((entry) => entry.day === day && entry.service === service)
    return { day, reserved: row?.reserved ?? 0, passed: row?.passed ?? 0, unchecked: row?.unchecked ?? 0 }
  }), [data, days, service])
  const selected = data?.services.find((row) => row.day === days[dayIndex] && row.service === service)
  const slots = quarterHourAttendance(data?.quarter_hours ?? [], days[dayIndex], service)
  const outsideHours = (data?.quarter_hours ?? [])
    .filter((slot) => slot.day === days[dayIndex] && slot.service === service
      && !slots.some((visible) => visible.slot === slot.slot))
    .reduce((total, slot) => total + slot.passed, 0)

  return (
    <>
      <PageHeader
        title="Restauration"
        subtitle="Toutes les compagnies — données globales, sans détail individuel"
        actions={<WeekNavigator monday={monday} onChange={setMonday} />}
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Select label="Service" value={service} onChange={(event) => setService(event.target.value)}
          options={SERVICES.map((value) => ({ value, label: SERVICE_LABELS[value] }))} />
        <Select label="Jour" value={dayIndex} onChange={(event) => setDayIndex(Number(event.target.value))}
          options={days.map((day, index) => ({ value: index, label: formatDayLabel(day) }))} />
        <Button onClick={reload} loading={loading}>Actualiser</Button>
      </div>
      <Alert tone="error">{errorMessage(error)}</Alert>
      {loading && !data ? <Spinner /> : data && (
        <div className="space-y-6">
          <p className="text-sm text-steel-600">Dernière actualisation : {data.updatedAt.toLocaleTimeString('fr-FR')}</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Réservés (jour / service)" value={selected?.reserved ?? 0} />
            <StatCard label="Passages" value={selected?.passed ?? 0} tone="olive" />
            <StatCard label="Pourcentage de passage"
              value={percentLabel(selected?.passed ?? 0, selected?.reserved ?? 0)} hint="Présents / réservations actives" />
            <StatCard label="Non pointés" value={selected?.unchecked ?? 0} tone="khaki" />
          </div>
          <Card title="Réservations et passages de la semaine">
            <div className="overflow-x-auto">
              <table aria-label="Bilan global hebdomadaire" className="min-w-full text-sm">
                <thead className="text-left text-xs tracking-wider text-steel-600 uppercase">
                  <tr>{['Jour', 'Réservés', 'Passages', 'Pourcentage de passage', 'Non pointés'].map((label) => (
                    <th key={label} className="py-2 pr-4">{label}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-steel-100">
                  {rows.map((row) => (
                    <tr key={row.day}>
                      <th scope="row" className="py-2 pr-4 text-left">{formatDayLabel(row.day)}</th>
                      <td className="py-2 pr-4">{row.reserved}</td>
                      <td className="py-2 pr-4">{row.passed}</td>
                      <td className="py-2 pr-4">{percentLabel(row.passed, row.reserved)}</td>
                      <td className="py-2 pr-4">{row.unchecked}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card title="Fréquentation par tranche de 15 minutes">
            <p className="mb-3 text-sm text-steel-600">
              {formatDayLabel(days[dayIndex])} — {SERVICE_LABELS[service]} : {slots[0].slot} à {slots.at(-1).end}. Heure de Paris.
              Les passages QR utilisent l'heure du scan ; les pointages ADU utilisent l'heure de saisie.
              Ces derniers ne permettent pas de connaître l'heure réelle d'arrivée.
            </p>
            <Alert tone="warning">
              {((selected?.unknown_time ?? 0) + (selected?.other_day ?? 0)) > 0
                ? `${selected.unknown_time} passage(s) sans heure connue et ${selected.other_day} pointage(s) saisis un autre jour : inclus dans le pourcentage, exclus du graphique horaire.`
                : null}
            </Alert>
            <Alert tone="warning">
              {outsideHours > 0
                ? `${outsideHours} passage(s) hors horaires du service : inclus dans le pourcentage, exclus du graphique horaire.`
                : null}
            </Alert>
            {(selected?.passed ?? 0) === 0 ? <EmptyState>Aucun passage pointé pour ce service.</EmptyState> : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={slots}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e6e8e3" />
                    <XAxis dataKey="slot" tick={{ fontSize: 12 }} interval={0} />
                    <YAxis allowDecimals={false} />
                    <Tooltip labelFormatter={(label) => `${label} – ${slots.find((slot) => slot.slot === label)?.end}`} />
                    <Bar dataKey="passed" name="Passages" fill="#4b5320" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold">Voir les chiffres par tranche</summary>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                {slots.map((slot) => <p key={slot.slot}>{slot.slot} – {slot.end} : {slot.passed} passage(s)</p>)}
              </div>
            </details>
          </Card>
        </div>
      )}
    </>
  )
}
