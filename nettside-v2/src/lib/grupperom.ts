import type { Aktiviteter, Grupper, Oppgaver, Tildelinger } from '@/payload-types'
import { bemanningForOppgave, erLederIGruppe, erMedlemIGruppe, relId, type OppgaveBemanning } from '@/lib/bemanning'
import { beregnDekning, type Dekning } from '@/lib/dekning'
import { isoTilOslo } from '@/lib/tid'

/** Alle i gruppen (medlem, leder, nestleder) kan åpne grupperommet. Andre kan ikke. */
export function kanSeGrupperom(gruppe: Grupper, personId: number): boolean {
  return erMedlemIGruppe(gruppe, personId)
}

export type GruppeAktivitet = {
  aktivitet: Aktiviteter
  /** Oppgavene som tilhører denne gruppen på arrangementet. */
  oppgaver: OppgaveBemanning[]
  dekning: Dekning | null
  /** Personen er satt opp (bekreftet eller forespurt) på minst én av gruppens oppgaver her. */
  mine: boolean
  /** Gruppen eier arrangementet. */
  eier: boolean
}

/**
 * Arrangementer gruppen deltar i: de gruppen eier, og de der gruppen har oppgaver (også i andres arrangementer).
 * Sortert på dato.
 */
export function aktiviteterForGruppe(
  gruppeId: number,
  personId: number,
  aktiviteter: Aktiviteter[],
  oppgaver: Oppgaver[],
  tildelinger: Tildelinger[],
): GruppeAktivitet[] {
  const gruppeOppgaver = oppgaver.filter((o) => relId(o.gruppe) === gruppeId && o.status !== 'cancelled')
  const utenAvlyste = gruppeOppgaver
  const resultat: GruppeAktivitet[] = []
  for (const a of aktiviteter) {
    const eier = relId(a.gruppe) === gruppeId
    const mine = utenAvlyste.filter((o) => relId(o.aktivitet) === a.id)
    if (!eier && mine.length === 0) continue
    const ids = new Set(mine.map((o) => o.id))
    const tilds = tildelinger.filter((t) => ids.has(relId(t.oppgave) ?? -1))
    const bem = mine.map((o) => bemanningForOppgave(o, tilds))
    resultat.push({
      aktivitet: a,
      oppgaver: bem,
      dekning: beregnDekning(mine, tilds),
      mine: bem.some((b) => b.tilds.some((t) => relId(t.person) === personId && (t.svar === 'confirmed' || t.svar === 'pending'))),
      eier,
    })
  }
  return resultat.sort((x, y) => new Date(x.aktivitet.start).getTime() - new Date(y.aktivitet.start).getTime())
}

export type AktivitetFilter = 'alle' | 'mine' | 'mangler'

/** Filter: alle, bare de personen er satt opp på, eller de som trenger oppfølging (forfall/mangler). */
export function filtrerGruppeAktiviteter(liste: GruppeAktivitet[], filter: AktivitetFilter, periode?: string): GruppeAktivitet[] {
  return liste.filter((g) => {
    if (filter === 'mine' && !g.mine) return false
    if (filter === 'mangler' && !((g.dekning?.oppfolging ?? 0) > 0)) return false
    if (periode && isoTilOslo(g.aktivitet.start).dato.slice(0, 7) !== periode) return false
    return true
  })
}

/** Måneder (YYYY-MM) arrangementene ligger i, til periodevalget. */
export function perioderIListe(liste: GruppeAktivitet[]): string[] {
  return Array.from(new Set(liste.map((g) => isoTilOslo(g.aktivitet.start).dato.slice(0, 7)))).sort()
}

export type Medlemsrolle = 'Leder' | 'Nestleder' | 'Medlem'

/** Alle personer i gruppen med rolle (en person får høyeste rolle). Leder først, så nestleder, så medlemmer på navn. */
export function medlemmerMedRolle(gruppe: Grupper): { id: number; rolle: Medlemsrolle }[] {
  const ut = new Map<number, Medlemsrolle>()
  const legg = (liste: unknown, rolle: Medlemsrolle) => {
    if (!Array.isArray(liste)) return
    for (const p of liste) {
      const id = relId(p)
      if (id !== undefined && !ut.has(id)) ut.set(id, rolle)
    }
  }
  legg(gruppe.ledere, 'Leder')
  legg(gruppe.varaledere, 'Nestleder')
  legg(gruppe.medlemmer, 'Medlem')
  return Array.from(ut, ([id, rolle]) => ({ id, rolle }))
}

/** Ser personen kontaktinfo (telefon, e-post) til de andre? Bare leder/nestleder i gruppen, og admin. */
export function kanSeKontaktinfo(gruppe: Grupper, personId: number, erAdmin: boolean): boolean {
  return erAdmin || erLederIGruppe(gruppe, personId)
}
