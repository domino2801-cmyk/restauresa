export function passagePercent(passed, reserved) {
  return reserved ? Math.round(passed / reserved * 100) : null
}

export function halfHourAttendance(slots, day, service) {
  const counts = new Map(slots.filter((slot) => slot.day === day && slot.service === service)
    .map((slot) => [slot.slot, slot.passed]))
  return Array.from({ length: 48 }, (_, index) => {
    const slot = `${String(Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`
    return { slot, passed: counts.get(slot) ?? 0 }
  })
}
