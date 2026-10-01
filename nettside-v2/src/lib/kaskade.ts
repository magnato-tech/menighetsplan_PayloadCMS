import { APIError } from 'payload'
import type { CollectionBeforeDeleteHook } from 'payload'

/**
 * Opprydding som følger med sletting. Uten dette avviser databasen slettingen med en uforståelig feil
 * («NOT NULL constraint failed») når noe har avhengige poster, fordi tildelinger, oppgaver og meldinger
 * krever at oppgaven, arrangementet eller personen finnes.
 * Alt kjøres i samme transaksjon som slettingen (req), så enten blir alt slettet eller ingenting.
 */

/** Slett en oppgave → dens tildelinger slettes først. */
export const foerOppgaveSlettes: CollectionBeforeDeleteHook = async ({ req, id }) => {
  await req.payload.delete({ collection: 'tildelinger', where: { oppgave: { equals: id } }, req })
}

/** Slett et arrangement → dets oppgaver (med tildelinger) og oppmøter slettes først. */
export const foerAktivitetSlettes: CollectionBeforeDeleteHook = async ({ req, id }) => {
  await req.payload.delete({ collection: 'oppgaver', where: { aktivitet: { equals: id } }, req })
  await req.payload.delete({ collection: 'oppmoter', where: { aktivitet: { equals: id } }, req })
}

/** Slett en person → personens tildelinger, oppmøter og gruppemeldinger slettes først. */
export const foerPersonSlettes: CollectionBeforeDeleteHook = async ({ req, id }) => {
  await req.payload.delete({ collection: 'tildelinger', where: { person: { equals: id } }, req })
  await req.payload.delete({ collection: 'oppmoter', where: { person: { equals: id } }, req })
  await req.payload.delete({ collection: 'gruppemeldinger', where: { avsender: { equals: id } }, req })
}

/**
 * Slett en gruppe → avvises med en tydelig melding hvis gruppen har arrangementer, oppgaver eller meldinger.
 * Dette slettes ikke automatisk, siden det ville fjernet mye uten at noen ba om det.
 */
export const foerGruppeSlettes: CollectionBeforeDeleteHook = async ({ req, id }) => {
  const tell = async (collection: 'aktiviteter' | 'oppgaver' | 'gruppemeldinger') => {
    const r = await req.payload.count({ collection, where: { gruppe: { equals: id } }, req })
    return r.totalDocs
  }
  const [a, o, m] = await Promise.all([tell('aktiviteter'), tell('oppgaver'), tell('gruppemeldinger')])
  if (a + o + m > 0) {
    throw new APIError(
      `Gruppen kan ikke slettes: den har ${a} arrangement(er), ${o} oppgave(r) og ${m} melding(er). Flytt eller slett dem først.`,
      400,
      undefined,
      true,
    )
  }
}
