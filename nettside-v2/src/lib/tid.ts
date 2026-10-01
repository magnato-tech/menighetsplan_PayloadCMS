// Tid i norsk tidssone. Vercel kjører i UTC, så klokkeslett må regnes om eksplisitt.
const TZ = 'Europe/Oslo'

function delerOslo(ts: number) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const p = Object.fromEntries(f.formatToParts(new Date(ts)).map((x) => [x.type, x.value]))
  return {
    dato: `${p.year}-${p.month}-${p.day}`,
    tid: `${p.hour}:${p.minute}`,
    lokalSomUtc: Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute)),
  }
}

/** ISO-tidspunkt (UTC) til dato (YYYY-MM-DD) og klokkeslett (HH:MM) i Oslo-tid. */
export function isoTilOslo(iso: string): { dato: string; tid: string } {
  const d = delerOslo(new Date(iso).getTime())
  return { dato: d.dato, tid: d.tid }
}

/** Dato (YYYY-MM-DD) og klokkeslett (HH:MM) i Oslo-tid til ISO-tidspunkt (UTC). */
export function osloTilIso(dato: string, tid: string): string {
  const [y, m, d] = dato.split('-').map(Number)
  const [hh, mm] = (tid || '00:00').split(':').map(Number)
  const onsket = Date.UTC(y, m - 1, d, hh, mm)
  let ts = onsket
  for (let i = 0; i < 3; i++) {
    ts += onsket - delerOslo(ts).lokalSomUtc
  }
  return new Date(ts).toISOString()
}

/** Klokkeslett (HH:MM) i Oslo-tid fra et ISO-tidspunkt. */
export function klokkeslettOslo(iso: string): string {
  return isoTilOslo(iso).tid
}

/** Kort norsk datoformat i Oslo-tid, f.eks. «ons. 26. aug. 2026 kl. 20:00». */
export function datoTidOslo(iso: string): string {
  const d = new Date(iso)
  const dato = d.toLocaleDateString('nb-NO', {
    timeZone: TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return `${dato} kl. ${klokkeslettOslo(iso)}`
}
