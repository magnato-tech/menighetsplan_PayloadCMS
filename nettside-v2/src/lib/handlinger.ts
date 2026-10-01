'use server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { revalidatePath } from 'next/cache'
import { erMedlemIGruppe, relId } from '@/lib/bemanning'
import { meldForfallKjerne, settTildeling, svarForesporselKjerne } from '@/lib/bemanningKjerne'

/**
 * Et medlem tar en ledig oppgave i sin egen tjenestegruppe. Avvises hvis personen ikke er med i gruppen,
 * eller oppgaven ikke har ledige plasser. Oppgavens status beregnes fra tildelingene.
 * NB: personen identifiseres av «Vis som» på Min side, ikke av ekte innlogging ennå.
 */
export async function taOppgave(formData: FormData) {
  const oppgaveId = Number(formData.get('oppgaveId'))
  const personId = Number(formData.get('personId'))
  if (!oppgaveId || !personId) return

  const payload = await getPayload({ config: await config })
  const oppgave = await payload.findByID({ collection: 'oppgaver', id: oppgaveId, depth: 0, overrideAccess: true })
  const gruppeId = relId(oppgave.gruppe)
  const gruppe = gruppeId ? await payload.findByID({ collection: 'grupper', id: gruppeId, depth: 0, overrideAccess: true }) : null
  if (!gruppe || !erMedlemIGruppe(gruppe, personId)) return

  await settTildeling(payload, oppgaveId, personId, 'confirmed')
  revalidatePath('/min-side')
  revalidatePath('/admin-oversikt')
}

/** En person med bekreftet oppgave melder forfall. Oppgaven blir ledig for gruppens medlemmer og synlig for leder og admin. */
export async function meldForfall(formData: FormData) {
  const tildelingId = Number(formData.get('tildelingId'))
  if (!tildelingId) return

  const payload = await getPayload({ config: await config })
  const tildeling = await payload.findByID({ collection: 'tildelinger', id: tildelingId, depth: 0, overrideAccess: true })
  const oppgaveId = relId(tildeling.oppgave)
  const personId = relId(tildeling.person)
  if (!oppgaveId || !personId) return

  await meldForfallKjerne(payload, oppgaveId, personId)
  revalidatePath('/min-side')
  revalidatePath('/admin-oversikt')
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

/** Svar på en oppgave du er forespurt til: «ja» bekrefter, «nei» avslår. Bare personen forespørselen gjelder kan svare. */
export async function svarTildeling(formData: FormData) {
  const tildelingId = Number(formData.get('tildelingId'))
  const personId = Number(formData.get('personId'))
  const svar = formData.get('status') === 'confirmed' ? 'confirmed' : 'declined'
  if (!tildelingId || !personId) return

  const payload = await getPayload({ config: await config })
  await svarForesporselKjerne(payload, tildelingId, personId, svar)
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
