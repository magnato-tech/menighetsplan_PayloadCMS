import type { Payload } from 'payload'

/**
 * Setter oppgavens lagrede status ut fra tildelingene, slik at den ikke kommer ut av synk:
 * - nok bekreftede (antallTrengs) → confirmed
 * - minst én venter på svar → assigned
 * - noen har trukket seg og oppgaven mangler fortsatt folk → vacant («trenger vikar»)
 * - ellers → open
 * Avlyste oppgaver røres ikke.
 */
export async function oppdaterOppgaveStatus(payload: Payload, oppgaveId: number) {
  const oppgave = await payload.findByID({ collection: 'oppgaver', id: oppgaveId, depth: 0, overrideAccess: true })
  if (oppgave.status === 'cancelled') return

  const { docs } = await payload.find({
    collection: 'tildelinger',
    where: { oppgave: { equals: oppgaveId } },
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })
  const bekreftet = new Set(docs.filter((t) => t.svar === 'confirmed').map((t) => String(t.person))).size
  const venter = docs.some((t) => t.svar === 'pending')
  const trukket = docs.some((t) => t.svar === 'withdrawn')
  const behov = oppgave.antallTrengs ?? 1

  let status: 'open' | 'assigned' | 'confirmed' | 'vacant'
  if (bekreftet >= behov) status = 'confirmed'
  else if (venter) status = 'assigned'
  else if (trukket) status = 'vacant'
  else status = 'open'

  if (oppgave.status !== status) {
    await payload.update({ collection: 'oppgaver', id: oppgaveId, data: { status }, overrideAccess: true })
  }
}
