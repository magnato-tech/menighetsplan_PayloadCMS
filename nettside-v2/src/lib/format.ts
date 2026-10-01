export function fmtDatoTid(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('nb-NO', {
    timeZone: 'Europe/Oslo',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
