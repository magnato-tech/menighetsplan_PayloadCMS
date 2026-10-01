import type { Grupper, Oppgaver, Tildelinger } from '@/payload-types'

/**
 * Felles regler for bemanning. Brukes av Min side (medlem og gruppeleder), admin-oversikten og
 * handlingene, slik at alle regner likt.
 */

export function relId(rel: unknown): number | undefined {
  if (typeof rel === 'object' && rel !== null && 'id' in rel) return (rel as { id: number }).id
  return typeof rel === 'number' ? rel : undefined
}

export type OppgaveBemanning = {
  oppgave: Oppgaver
  tilds: Tildelinger[]
  /** Antall personer som har bekreftet. */
  bekreftet: number
  /** Antall personer som er forespurt og venter på svar. */
  venter: number
  /** Antall personer oppgaven trenger. */
  behov: number
  /** Fullt bemannet: nok bekreftede. */
  dekket: boolean
  /** Noen har meldt forfall, og oppgaven er ikke dekket igjen. */
  forfall: boolean
  /** Plasser som ikke er bekreftet eller forespurt. Disse kan tas av gruppens medlemmer. */
  ledigePlasser: number
}

export function bemanningForOppgave(oppgave: Oppgaver, tildelinger: Tildelinger[]): OppgaveBemanning {
  const tilds = tildelinger.filter((t) => relId(t.oppgave) === oppgave.id)
  const bekreftetSet = new Set(tilds.filter((t) => t.svar === 'confirmed').map((t) => relId(t.person)))
  const venterSet = new Set(
    tilds.filter((t) => t.svar === 'pending').map((t) => relId(t.person)).filter((p) => !bekreftetSet.has(p)),
  )
  const behov = oppgave.antallTrengs ?? 1
  const bekreftet = bekreftetSet.size
  const dekket = bekreftet >= behov
  return {
    oppgave,
    tilds,
    bekreftet,
    venter: venterSet.size,
    behov,
    dekket,
    forfall: !dekket && tilds.some((t) => t.svar === 'withdrawn'),
    ledigePlasser: Math.max(0, behov - bekreftet - venterSet.size),
  }
}

/** Er personen medlem, leder eller nestleder i gruppen? */
export function erMedlemIGruppe(gruppe: Grupper, personId: number): boolean {
  return [gruppe.medlemmer, gruppe.ledere, gruppe.varaledere].some(
    (liste) => Array.isArray(liste) && liste.some((p) => relId(p) === personId),
  )
}

/** Er personen leder eller nestleder i gruppen? */
export function erLederIGruppe(gruppe: Grupper, personId: number): boolean {
  return [gruppe.ledere, gruppe.varaledere].some((liste) => Array.isArray(liste) && liste.some((p) => relId(p) === personId))
}

/** Ledige oppgaver en person kan ta: i en gruppe personen er med i, med ledige plasser, og som personen ikke allerede er på. */
export function ledigeOppgaverForPerson(
  personId: number,
  grupper: Grupper[],
  oppgaver: Oppgaver[],
  tildelinger: Tildelinger[],
): Oppgaver[] {
  const mineGruppeIder = new Set(grupper.filter((g) => erMedlemIGruppe(g, personId)).map((g) => g.id))
  return oppgaver.filter((o) => {
    if (o.status === 'cancelled') return false
    const gruppeId = relId(o.gruppe)
    if (!gruppeId || !mineGruppeIder.has(gruppeId)) return false
    const b = bemanningForOppgave(o, tildelinger)
    if (b.ledigePlasser <= 0) return false
    const allerede = b.tilds.some((t) => relId(t.person) === personId && (t.svar === 'confirmed' || t.svar === 'pending'))
    return !allerede
  })
}

/** Oppgaver i gitte grupper som ikke er fullt bemannet (forfall eller mangler). Det en gruppeleder må følge opp. */
export function oppfolgingForGrupper(gruppeIder: number[], oppgaver: Oppgaver[], tildelinger: Tildelinger[]): OppgaveBemanning[] {
  const sett = new Set(gruppeIder)
  return oppgaver
    .filter((o) => o.status !== 'cancelled' && sett.has(relId(o.gruppe) ?? -1))
    .map((o) => bemanningForOppgave(o, tildelinger))
    .filter((b) => !b.dekket)
}

/** Oppgaver en person har bekreftet, og de personen er forespurt til og ikke har svart på. */
export function oppgaverForPerson(personId: number, oppgaver: Oppgaver[], tildelinger: Tildelinger[]) {
  const mine = tildelinger.filter((t) => relId(t.person) === personId)
  const finn = (svar: Tildelinger['svar']) =>
    mine
      .filter((t) => t.svar === svar)
      .map((t) => ({ tildeling: t, oppgave: oppgaver.find((o) => o.id === relId(t.oppgave)) }))
      .filter((x): x is { tildeling: Tildelinger; oppgave: Oppgaver } => !!x.oppgave && x.oppgave.status !== 'cancelled')
  return { bekreftet: finn('confirmed'), venterPaSvar: finn('pending') }
}
