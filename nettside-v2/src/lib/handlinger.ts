'use server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { revalidatePath } from 'next/cache'
import { oppdaterOppgaveStatus } from '@/lib/oppgaveStatus'

export async function taOppgave(formData: FormData) {
  const oppgaveId = Number(formData.get('oppgaveId'))
  const personId = Number(formData.get('personId'))

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  // Opprett en Tildeling (svar: 'confirmed') for personId på oppgaveId
  await payload.create({
    collection: 'tildelinger',
    data: {
      oppgave: oppgaveId,
      person: personId,
      svar: 'confirmed',
    },
  })

  // Sett oppgavens status til 'confirmed'
  await payload.update({
    collection: 'oppgaver',
    id: oppgaveId,
    data: {
      status: 'confirmed',
    },
  })

  revalidatePath('/min-side')
}

export async function meldForfall(formData: FormData) {
  const tildelingId = Number(formData.get('tildelingId'))
  const oppgaveId = Number(formData.get('oppgaveId'))

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  // Sett tildelingens svar til 'withdrawn'
  await payload.update({
    collection: 'tildelinger',
    id: tildelingId,
    data: {
      svar: 'withdrawn',
    },
  })

  // Sett oppgavens status til 'vacant' (slik at den dukker opp som "trenger vikar" igjen)
  await payload.update({
    collection: 'oppgaver',
    id: oppgaveId,
    data: {
      status: 'vacant',
    },
  })

  revalidatePath('/min-side')
}

export async function svarInnkalling(formData: FormData) {
  const aktivitetId = Number(formData.get('aktivitetId'))
  const personId = Number(formData.get('personId'))
  const status = formData.get('status') as 'attending' | 'declined'

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  // Finn om det finnes en Oppmøte-post for denne aktivitet+person fra før
  const { docs: eksisterende } = await payload.find({
    collection: 'oppmoter',
    where: {
      and: [
        { aktivitet: { equals: aktivitetId } },
        { person: { equals: personId } },
      ],
    },
    limit: 1,
  })

  if (eksisterende.length > 0) {
    // Oppdater eksisterende
    await payload.update({
      collection: 'oppmoter',
      id: eksisterende[0].id,
      data: { status },
    })
  } else {
    // Opprett ny
    await payload.create({
      collection: 'oppmoter',
      data: {
        aktivitet: aktivitetId,
        person: personId,
        status,
      },
    })
  }

  revalidatePath('/min-side')
}

/** Svar på en oppgave admin har forespurt: «ja» bekrefter, «nei» avslår. Oppgavestatus oppdateres ut fra tildelingene. */
export async function svarTildeling(formData: FormData) {
  const tildelingId = Number(formData.get('tildelingId'))
  const svar = formData.get('status') === 'confirmed' ? 'confirmed' : 'declined'
  if (!tildelingId) return

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const tildeling = await payload.findByID({ collection: 'tildelinger', id: tildelingId, depth: 0, overrideAccess: true })
  await payload.update({ collection: 'tildelinger', id: tildelingId, data: { svar }, overrideAccess: true })
  const oppgaveId = typeof tildeling.oppgave === 'number' ? tildeling.oppgave : tildeling.oppgave.id
  await oppdaterOppgaveStatus(payload, oppgaveId)

  revalidatePath('/min-side')
  revalidatePath('/admin-oversikt')
}

export async function sendMelding(formData: FormData) {
  const gruppeId = Number(formData.get('gruppeId'))
  const avsenderId = Number(formData.get('avsenderId'))
  const innhold = formData.get('innhold') as string

  if (!innhold || !innhold.trim()) return

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  // Opprett en ny Gruppemelding
  await payload.create({
    collection: 'gruppemeldinger',
    data: {
      gruppe: gruppeId,
      avsender: avsenderId,
      innhold: innhold.trim(),
    },
  })

  revalidatePath(`/min-side/gruppe/${gruppeId}`)
}
