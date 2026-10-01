import type { Aktiviteter, Oppgaver, Tildelinger } from '@/payload-types'

export type StatusKlasse = 'tag-dekket' | 'tag-mangler' | 'tag-forfall'
export interface AktivitetStatus {
  label: string
  klasse: StatusKlasse
}

function relId(rel: unknown): number | string | undefined {
  if (typeof rel === 'object' && rel !== null && 'id' in rel) {
    return (rel as { id: number | string }).id
  }
  return rel as number | string | undefined
}

/**
 * Utleder status for en aktivitet fra dens oppgavers status og tildelingers svar:
 * - "Forfall": minst én tildeling på en av aktivitetens oppgaver har svar "withdrawn"
 * - "Mangler N": N oppgaver er fortsatt "open"/"vacant"
 * - "Dekket": alle oppgaver er bemannet
 * - null: aktiviteten har ingen oppgaver knyttet til seg
 */
export function statusForAktivitet(
  aktivitetId: number | string,
  alleOppgaver: Oppgaver[],
  alleTildelinger: Tildelinger[],
): AktivitetStatus | null {
  const oppgaver = alleOppgaver.filter((o) => relId(o.aktivitet) === aktivitetId)
  if (oppgaver.length === 0) return null

  const harTrukket = alleTildelinger.some(
    (t) => oppgaver.some((o) => o.id === relId(t.oppgave)) && t.svar === 'withdrawn',
  )
  if (harTrukket) return { label: 'Forfall', klasse: 'tag-forfall' }

  const antallLedige = oppgaver.filter((o) => o.status === 'vacant' || o.status === 'open').length
  if (antallLedige > 0) return { label: `Mangler ${antallLedige}`, klasse: 'tag-mangler' }

  return { label: 'Dekket', klasse: 'tag-dekket' }
}

/** Grupperer aktiviteter per måned+år ("September 2026"), med stor forbokstav. */
export function grupperPerManed(aktiviteter: Aktiviteter[]): Record<string, Aktiviteter[]> {
  const grupper: Record<string, Aktiviteter[]> = {}
  for (const a of aktiviteter) {
    const nokkel = formaterManedAr(a.start)
    if (!grupper[nokkel]) grupper[nokkel] = []
    grupper[nokkel].push(a)
  }
  return grupper
}

function formaterManedAr(iso: string): string {
  const maaned = new Date(iso).toLocaleString('nb-NO', { timeZone: 'Europe/Oslo', month: 'long', year: 'numeric' })
  return maaned.charAt(0).toUpperCase() + maaned.slice(1)
}

/** Sorterer månedsnøkler fra grupperPerManed kronologisk (basert på første aktivitet i hver gruppe). */
export function sorterManedsnokler(gruppert: Record<string, Aktiviteter[]>): string[] {
  return Object.keys(gruppert).sort((a, b) => {
    const datoA = new Date(gruppert[a][0].start).getTime()
    const datoB = new Date(gruppert[b][0].start).getTime()
    return datoA - datoB
  })
}
