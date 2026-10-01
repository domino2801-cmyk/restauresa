import { addDays, formatDayLabel, startOfWeek, toISODate } from '../lib/dates'
import { Button } from './ui'

/** Navigation semaine précédente / courante / suivante. `monday` : Date du lundi. */
export function WeekNavigator({ monday, onChange }) {
  const sunday = addDays(monday, 6)
  const label = `${formatDayLabel(toISODate(monday), { day: 'numeric', month: 'short' })} → ${formatDayLabel(
    toISODate(sunday),
    { day: 'numeric', month: 'short', year: 'numeric' },
  )}`
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" aria-label="Semaine précédente" onClick={() => onChange(addDays(monday, -7))}>
        ‹
      </Button>
      <Button variant="ghost" size="sm" onClick={() => onChange(startOfWeek(new Date()))}>
        {label}
      </Button>
      <Button variant="outline" size="sm" aria-label="Semaine suivante" onClick={() => onChange(addDays(monday, 7))}>
        ›
      </Button>
    </div>
  )
}
