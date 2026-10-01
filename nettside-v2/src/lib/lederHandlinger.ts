'use server'
import { getPayload } from 'payload'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import config from '@/payload.config'
import { fjernTildelingKjerne, settTildeling, sjekkLederRett } from '@/lib/bemanningKjerne'
import { oppdaterOppgaveStatus } from '@/lib/oppgaveStatus'

/**
 * Handlinger for gruppeledere (og nestledere): gripe inn og tildele/forespørre personer på oppgaver i egen gruppe.
 * NB: lederen identifiseres av «Vis som» på Min side (aktorId), ikke av ekte innlogging ennå.
 * Rettigheten sjekkes likevel på serveren mot gruppens ledere og medlemmer.
 */

function tall(formData: FormData, navn: string): number {
  const v = formData.get(navn)
  return typeof v === 'string' ? Number(v.trim()) : NaN
}

function tilbake(formData: FormData, aktivitetId: number, lederId: number, melding: string) {
  revalidatePath('/min-side')
  revalidatePath('/admin-oversikt')
  revalidatePath(`/admin-oversikt/arrangement/${aktivitetId}`)
  revalidatePath(`/min-side/leder/arrangement/${aktivitetId}`)
  // Tilbake dit handlingen ble startet (f.eks. oppgavekortet), ellers til arrangementet.
  const retur = typeof formData.get('returTil') === 'string' ? String(formData.get('returTil')).trim() : ''
  const mal = retur.startsWith('/min-side/oppgave/') && !retur.includes('?') ? retur : `/min-side/leder/arrangement/${aktivitetId}`
  redirect(`${mal}?som=${lederId}&melding=${encodeURIComponent(melding)}`)
}

async function kjor(formData: FormData, svar: 'pending' | 'confirmed') {
  const lederId = tall(formData, 'aktorId')
  const aktivitetId = tall(formData, 'aktivitetId')
  const oppgaveId = tall(formData, 'oppgaveId')
  const personId = tall(formData, 'personId')
  if (![lederId, aktivitetId, oppgaveId, personId].every(Number.isInteger)) throw new Error('Mangler data.')

  const payload = await getPayload({ config: await config })
  const rett = await sjekkLederRett(payload, lederId, oppgaveId, personId)
  if (!rett.ok) tilbake(formData, aktivitetId, lederId, rett.melding)

  const r = await settTildeling(payload, oppgaveId, personId, svar)
  tilbake(formData, aktivitetId, lederId, r.melding)
}

/** Gruppeleder tildeler direkte: avtalt muntlig, personen står som bekreftet. */
export async function lederTildel(formData: FormData) {
  await kjor(formData, 'confirmed')
}

/** Gruppeleder forespør: personen svarer ja eller nei på Min side. */
export async function lederForespor(formData: FormData) {
  await kjor(formData, 'pending')
}

/** Gruppeleder fjerner en person fra en oppgave i egen gruppe. */
export async function lederFjern(formData: FormData) {
  const lederId = tall(formData, 'aktorId')
  const aktivitetId = tall(formData, 'aktivitetId')
  const oppgaveId = tall(formData, 'oppgaveId')
  const tildelingId = tall(formData, 'tildelingId')
  if (![lederId, aktivitetId, oppgaveId, tildelingId].every(Number.isInteger)) throw new Error('Mangler data.')

  const payload = await getPayload({ config: await config })
  const rett = await sjekkLederRett(payload, lederId, oppgaveId)
  if (!rett.ok) tilbake(formData, aktivitetId, lederId, rett.melding)

  await fjernTildelingKjerne(payload, tildelingId, oppgaveId)
  tilbake(formData, aktivitetId, lederId, 'Personen er fjernet fra oppgaven.')
}

async function lederOppgaveEndring(formData: FormData, endre: 'behov' | 'instruks') {
  const lederId = tall(formData, 'aktorId')
  const aktivitetId = tall(formData, 'aktivitetId')
  const oppgaveId = tall(formData, 'oppgaveId')
  if (![lederId, aktivitetId, oppgaveId].every(Number.isInteger)) throw new Error('Mangler data.')

  const payload = await getPayload({ config: await config })
  const rett = await sjekkLederRett(payload, lederId, oppgaveId)
  if (!rett.ok) tilbake(formData, aktivitetId, lederId, rett.melding)

  if (endre === 'behov') {
    await payload.update({
      collection: 'oppgaver',
      id: oppgaveId,
      data: { antallTrengs: Math.max(1, tall(formData, 'antall') || 1) },
      overrideAccess: true,
    })
    await oppdaterOppgaveStatus(payload, oppgaveId)
    tilbake(formData, aktivitetId, lederId, 'Bemanningsbehovet er oppdatert.')
  }
  const instruks = formData.get('instruksjon')
  await payload.update({
    collection: 'oppgaver',
    id: oppgaveId,
    data: { instruksjon: typeof instruks === 'string' && instruks.trim() ? instruks.trim() : null },
    overrideAccess: true,
  })
  tilbake(formData, aktivitetId, lederId, 'Instruksen er lagret.')
}

/** Gruppeleder endrer bemanningsbehovet på en oppgave i egen gruppe. */
export async function lederOppdaterBehov(formData: FormData) {
  await lederOppgaveEndring(formData, 'behov')
}

/** Gruppeleder endrer instruksen for en oppgave i egen gruppe. */
export async function lederOppdaterInstruks(formData: FormData) {
  await lederOppgaveEndring(formData, 'instruks')
}