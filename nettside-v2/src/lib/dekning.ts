import type { Oppgaver, Tildelinger } from '@/payload-types'

export type Dekning = {
  /** «Dekket», «Mangler N» (N = manglende personer) eller «Forfall». */
  label: string
  klasse: 'tag-dekket' | 'tag-mangler' | 'tag-forfall'
  /** Antall oppgaver som er fullt bemannet. */
  dekkede: number
  /** Antall oppgaver (uten avlyste). */
  totalt: number
  /** Antall oppgaver som krever oppfølging (forfall eller for få bekreftede). */
  oppfolging: number
}

function relId(rel: unknown): number | undefined {
  if (typeof rel === 'object' && rel !== null && 'id' in rel) return (rel as { id: number }).id
  return typeof rel === 'number' ? rel : undefined
}

/**
 * Bemanningsstatus for et arrangement, regnet fra bekreftede personer mot bemanningsbehovet.
 * - En oppgave er dekket når antall bekreftede personer er minst antallTrengs.
 *   «Venter på svar» teller ikke som dekket.
 * - Forfall: noen har meldt forfall og oppgaven er ikke dekket igjen.
 * - Avlyste oppgaver ignoreres. Ingen oppgaver gir null.
 */
export function beregnDekning(oppgaver: Oppgaver[], tildelinger: Tildelinger[]): Dekning | null {
  const aktive = oppgaver.filter((o) => o.status !== 'cancelled')
  if (aktive.length === 0) return null

  let dekkede = 0
  let forfall = false
  let manglerPersoner = 0
  for (const o of aktive) {
    const mine = tildelinger.filter((t) => relId(t.oppgave) === o.id)
    const bekreftet = new Set(mine.filter((t) => t.svar === 'confirmed').map((t) => relId(t.person))).size
    const behov = o.antallTrengs ?? 1
    if (bekreftet >= behov) {
      dekkede++
    } else {
      manglerPersoner += behov - bekreftet
      if (mine.some((t) => t.svar === 'withdrawn')) forfall = true
    }
  }
  const totalt = aktive.length
  const oppfolging = totalt - dekkede
  if (forfall) return { label: 'Forfall', klasse: 'tag-forfall', dekkede, totalt, oppfolging }
  if (oppfolging > 0) return { label: `Mangler ${manglerPersoner}`, klasse: 'tag-mangler', dekkede, totalt, oppfolging }
  return { label: 'Dekket', klasse: 'tag-dekket', dekkede, totalt, oppfolging }
}
