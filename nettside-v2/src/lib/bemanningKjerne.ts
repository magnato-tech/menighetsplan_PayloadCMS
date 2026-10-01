import type { Payload } from 'payload'
import { bemanningForOppgave, erLederIGruppe, erMedlemIGruppe, relId } from '@/lib/bemanning'
import { oppdaterOppgaveStatus } from '@/lib/oppgaveStatus'

export type Resultat = { ok: true; melding: string } | { ok: false; melding: string }

/**
 * Setter en person på en oppgave. 'confirmed' = personen har sagt ja (muntlig avtalt, eller tar den selv).
 * 'pending' = forespørsel som personen svarer på.
 * Avviser hvis oppgaven er fullt bemannet/avlyst, eller personen allerede er på den.
 * Gjenbruker en eldre tildeling (avslått/tilbaketrukket) i stedet for å lage dobbelt.
 */
export async function settTildeling(
  payload: Payload,
  oppgaveId: number,
  personId: number,
  svar: 'pending' | 'confirmed',
): Promise<Resultat> {
  const oppgave = await payload.findByID({ collection: 'oppgaver', id: oppgaveId, depth: 0, overrideAccess: true })
  if (oppgave.status === 'cancelled') return { ok: false, melding: 'Oppgaven er avlyst.' }

  const { docs: alle } = await payload.find({
    collection: 'tildelinger',
    where: { oppgave: { equals: oppgaveId } },
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })
  const b = bemanningForOppgave(oppgave, alle)
  const min = alle.filter((t) => relId(t.person) === personId)

  if (min.some((t) => t.svar === 'confirmed')) return { ok: false, melding: 'Personen er allerede bekreftet på denne oppgaven.' }
  const minPending = min.find((t) => t.svar === 'pending')
  if (minPending && svar === 'pending') return { ok: false, melding: 'Personen er allerede forespurt.' }

  // En ventende forespørsel til samme person kan bekreftes uten å ta en ny plass.
  const trengerNyPlass = !minPending
  if (trengerNyPlass && b.ledigePlasser <= 0) return { ok: false, melding: 'Oppgaven har ingen ledige plasser.' }

  const gjenbruk = minPending ?? min[0]
  if (gjenbruk) {
    await payload.update({ collection: 'tildelinger', id: gjenbruk.id, data: { svar }, overrideAccess: true })
  } else {
    await payload.create({ collection: 'tildelinger', data: { oppgave: oppgaveId, person: personId, svar }, overrideAccess: true })
  }
  await oppdaterOppgaveStatus(payload, oppgaveId)
  return {
    ok: true,
    melding: svar === 'confirmed' ? 'Personen står som bekreftet på oppgaven.' : 'Forespørselen er sendt. Personen svarer på Min side.',
  }
}

/** Personen melder forfall på en bekreftet oppgave. Oppgaven blir ledig for gruppens medlemmer. */
export async function meldForfallKjerne(payload: Payload, oppgaveId: number, personId: number): Promise<Resultat> {
  const { docs } = await payload.find({
    collection: 'tildelinger',
    where: { and: [{ oppgave: { equals: oppgaveId } }, { person: { equals: personId } }, { svar: { equals: 'confirmed' } }] },
    limit: 5,
    depth: 0,
    overrideAccess: true,
  })
  if (docs.length === 0) return { ok: false, melding: 'Personen er ikke bekreftet på denne oppgaven.' }
  for (const t of docs) await payload.update({ collection: 'tildelinger', id: t.id, data: { svar: 'withdrawn' }, overrideAccess: true })
  await oppdaterOppgaveStatus(payload, oppgaveId)
  return { ok: true, melding: 'Forfall er meldt. Gruppen og gruppelederen kan se at oppgaven trenger noen.' }
}

/** Svar på en forespørsel: ja bekrefter, nei avslår. Bare personen forespørselen gjelder kan svare. */
export async function svarForesporselKjerne(
  payload: Payload,
  tildelingId: number,
  personId: number,
  svar: 'confirmed' | 'declined',
): Promise<Resultat> {
  const t = await payload.findByID({ collection: 'tildelinger', id: tildelingId, depth: 0, overrideAccess: true })
  if (relId(t.person) !== personId) return { ok: false, melding: 'Forespørselen gjelder en annen person.' }
  if (t.svar !== 'pending') return { ok: false, melding: 'Forespørselen er allerede besvart.' }
  await payload.update({ collection: 'tildelinger', id: tildelingId, data: { svar }, overrideAccess: true })
  const oppgaveId = relId(t.oppgave)
  if (oppgaveId) await oppdaterOppgaveStatus(payload, oppgaveId)
  return { ok: true, melding: svar === 'confirmed' ? 'Du har tatt oppgaven.' : 'Du har avslått oppgaven.' }
}

export async function fjernTildelingKjerne(payload: Payload, tildelingId: number, oppgaveId: number) {
  await payload.delete({ collection: 'tildelinger', id: tildelingId, overrideAccess: true })
  await oppdaterOppgaveStatus(payload, oppgaveId)
}

/**
 * Sjekker at en gruppeleder kan håndtere en oppgave og en person: lederen må lede (eller være nestleder i) oppgavens gruppe,
 * og personen må være med i gruppen. NB: lederen identifiseres av id fra Min side («Vis som»), ikke av ekte innlogging ennå.
 */
export async function sjekkLederRett(
  payload: Payload,
  lederId: number,
  oppgaveId: number,
  personId?: number,
): Promise<Resultat> {
  const oppgave = await payload.findByID({ collection: 'oppgaver', id: oppgaveId, depth: 0, overrideAccess: true })
  const gruppeId = relId(oppgave.gruppe)
  if (!gruppeId) return { ok: false, melding: 'Oppgaven mangler gruppe.' }
  const gruppe = await payload.findByID({ collection: 'grupper', id: gruppeId, depth: 0, overrideAccess: true })
  if (!erLederIGruppe(gruppe, lederId)) return { ok: false, melding: 'Bare leder eller nestleder i gruppen kan gjøre dette.' }
  if (personId !== undefined && !erMedlemIGruppe(gruppe, personId)) {
    return { ok: false, melding: 'Personen er ikke med i tjenestegruppen.' }
  }
  return { ok: true, melding: 'ok' }
}
