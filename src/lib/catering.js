export function passagePercent(passed, reserved) {
  return reserved ? Math.round(passed / reserved * 100) : null
}

export function quarterHourAttendance(slots, day, service) {
  const windows = {
    petit_dejeuner: [6 * 60 + 30, 7 * 60 + 30],
    dejeuner: [11 * 60 + 30, 13 * 60 + 30],
    diner: [17 * 60 + 45, 19 * 60],
  }
  const window = windows[service]
  if (!window) throw new Error('Service de restauration inconnu')
  const formatTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
  const counts = new Map(slots.filter((slot) => slot.day === day && slot.service === service)
    .map((slot) => [slot.slot, slot.passed]))
  return Array.from({ length: (window[1] - window[0]) / 15 }, (_, index) => {
    const minutes = window[0] + index * 15
    const slot = formatTime(minutes)
    return { slot, end: formatTime(minutes + 15), passed: counts.get(slot) ?? 0 }
  })
}
