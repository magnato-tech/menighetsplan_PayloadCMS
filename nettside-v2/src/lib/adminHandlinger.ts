'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { hentAdmin } from '@/lib/adminAuth'
import { oppdaterOppgaveStatus } from '@/lib/oppgaveStatus'
import { osloTilIso } from '@/lib/tid'

function tekst(formData: FormData, navn: string): string {
  const v = formData.get(navn)
  return typeof v === 'string' ? v.trim() : ''
}

function tall(formData: FormData, navn: string): number {
  return Number(tekst(formData, navn))
}

async function krevAdmin() {
  const admin = await hentAdmin()
  if (!admin) throw new Error('Krever innlogging som admin.')
  return admin
}

function tilArrangement(id: number, melding?: string) {
  revalidatePath(`/admin-oversikt/arrangement/${id}`)
  revalidatePath('/admin-oversikt')
  revalidatePath('/kalender')
  revalidatePath('/')
  const q = melding ? `?melding=${encodeURIComponent(melding)}` : ''
  redirect(`/admin-oversikt/arrangement/${id}${q}`)
}

/** Nytt arrangement. Bildet er påkrevd i datamodellen, så det første bildet i biblioteket brukes som plassholder. */
export async function opprettArrangement(formData: FormData) {
  const { payload } = await krevAdmin()
  const tittel = tekst(formData, 'tittel')
  const dato = tekst(formData, 'dato')
  const tid = tekst(formData, 'tid') || '11:00'
  const gruppeId = tall(formData, 'gruppeId')
  if (!tittel || !dato || !gruppeId) throw new Error('Tittel, dato og gruppe må fylles ut.')

  const { docs: bilder } = await payload.find({ collection: 'media', limit: 1, depth: 0, overrideAccess: true })
  if (bilder.length === 0) throw new Error('Last opp minst ett bilde under Bilder i admin først.')

  const ny = await payload.create({
    collection: 'aktiviteter',
    data: {
      tittel,
      gruppe: gruppeId,
      bilde: bilder[0].id,
      start: osloTilIso(dato, tid),
      sted: tekst(formData, 'sted') || undefined,
      erGudstjeneste: formData.get('erGudstjeneste') === 'on',
      offentlig: formData.get('offentlig') === 'on',
    },
    overrideAccess: true,
  })
  tilArrangement(ny.id, 'Arrangementet er opprettet. Bytt gjerne bilde under Aktiviteter i Payload.')
}

export async function oppdaterArrangement(formData: FormData) {
  const { payload } = await krevAdmin()
  const id = tall(formData, 'id')
  const tittel = tekst(formData, 'tittel')
  const dato = tekst(formData, 'dato')
  if (!id || !tittel || !dato) throw new Error('Tittel og dato må fylles ut.')

  await payload.update({
    collection: 'aktiviteter',
    id,
    data: {
      tittel,
      start: osloTilIso(dato, tekst(formData, 'tid') || '00:00'),
      sted: tekst(formData, 'sted') || null,
      tema: tekst(formData, 'tema') || null,
      bibeltekst: tekst(formData, 'bibeltekst') || null,
      erGudstjeneste: formData.get('erGudstjeneste') === 'on',
      offentlig: formData.get('offentlig') === 'on',
      avlyst: formData.get('avlyst') === 'on',
    },
    overrideAccess: true,
  })
  tilArrangement(id, 'Arrangementet er oppdatert.')
}

/** Ny oppgave på arrangementet. Hvis klokkeslett og programtittel er fylt ut, legges den også inn i programmet. */
export async function opprettOppgave(formData: FormData) {
  const { payload } = await krevAdmin()
  const aktivitetId = tall(formData, 'aktivitetId')
  const gruppeId = tall(formData, 'gruppeId')
  const rolle = tekst(formData, 'rolle')
  if (!aktivitetId || !gruppeId || !rolle) throw new Error('Gruppe og oppgavenavn må fylles ut.')

  const oppgave = await payload.create({
    collection: 'oppgaver',
    data: {
      aktivitet: aktivitetId,
      gruppe: gruppeId,
      tittel: rolle,
      beskrivelse: tekst(formData, 'beskrivelse') || undefined,
      instruksjon: tekst(formData, 'instruksjon') || undefined,
      antallTrengs: Math.max(1, tall(formData, 'antall') || 1),
      status: 'open',
    },
    overrideAccess: true,
  })

  const klokkeslett = tekst(formData, 'klokkeslett')
  const programtittel = tekst(formData, 'programtittel')
  if (klokkeslett && programtittel) {
    const aktivitet = await payload.findByID({ collection: 'aktiviteter', id: aktivitetId, depth: 0, overrideAccess: true })
    const eksisterende = (aktivitet.program ?? []).map((p) => ({
      klokkeslett: p.klokkeslett,
      tittel: p.tittel,
      beskrivelse: p.beskrivelse ?? undefined,
      oppgave: typeof p.oppgave === 'object' && p.oppgave !== null ? p.oppgave.id : (p.oppgave ?? undefined),
    }))
    const nytt = [
      ...eksisterende,
      { klokkeslett, tittel: programtittel, beskrivelse: tekst(formData, 'beskrivelse') || undefined, oppgave: oppgave.id },
    ].sort((a, b) => a.klokkeslett.localeCompare(b.klokkeslett))
    await payload.update({ collection: 'aktiviteter', id: aktivitetId, data: { program: nytt }, overrideAccess: true })
  }
  tilArrangement(aktivitetId, 'Oppgaven er lagt til.')
}

/** Tildel en person direkte: admin har allerede avtalt det muntlig, så personen står som bekreftet. */
export async function tildelPerson(formData: FormData) {
  const { payload } = await krevAdmin()
  const aktivitetId = tall(formData, 'aktivitetId')
  const oppgaveId = tall(formData, 'oppgaveId')
  const personId = tall(formData, 'personId')
  if (!oppgaveId || !personId) throw new Error('Velg en person.')

  const { docs } = await payload.find({
    collection: 'tildelinger',
    where: { and: [{ oppgave: { equals: oppgaveId } }, { person: { equals: personId } }] },
    limit: 5,
    depth: 0,
    overrideAccess: true,
  })
  if (docs.some((t) => t.svar === 'confirmed')) tilArrangement(aktivitetId, 'Personen er allerede bekreftet på denne oppgaven.')

  if (docs[0]) {
    await payload.update({ collection: 'tildelinger', id: docs[0].id, data: { svar: 'confirmed' }, overrideAccess: true })
  } else {
    await payload.create({
      collection: 'tildelinger',
      data: { oppgave: oppgaveId, person: personId, svar: 'confirmed' },
      overrideAccess: true,
    })
  }
  await oppdaterOppgaveStatus(payload, oppgaveId)
  tilArrangement(aktivitetId, 'Personen er tildelt oppgaven og står som bekreftet.')
}

/** Forespør en person om å ta oppgaven: lager en tildeling som venter på svar. */
export async function foresporPerson(formData: FormData) {
  const { payload } = await krevAdmin()
  const aktivitetId = tall(formData, 'aktivitetId')
  const oppgaveId = tall(formData, 'oppgaveId')
  const personId = tall(formData, 'personId')
  if (!oppgaveId || !personId) throw new Error('Velg en person.')

  const { docs } = await payload.find({
    collection: 'tildelinger',
    where: { and: [{ oppgave: { equals: oppgaveId } }, { person: { equals: personId } }] },
    limit: 5,
    depth: 0,
    overrideAccess: true,
  })
  const aktiv = docs.find((t) => t.svar === 'pending' || t.svar === 'confirmed')
  if (aktiv) tilArrangement(aktivitetId, 'Personen er allerede forespurt eller bekreftet på denne oppgaven.')

  const tidligere = docs[0]
  if (tidligere) {
    await payload.update({ collection: 'tildelinger', id: tidligere.id, data: { svar: 'pending' }, overrideAccess: true })
  } else {
    await payload.create({
      collection: 'tildelinger',
      data: { oppgave: oppgaveId, person: personId, svar: 'pending' },
      overrideAccess: true,
    })
  }
  await oppdaterOppgaveStatus(payload, oppgaveId)
  tilArrangement(aktivitetId, 'Forespørselen er sendt. Personen svarer på Min side.')
}

export async function fjernTildeling(formData: FormData) {
  const { payload } = await krevAdmin()
  const aktivitetId = tall(formData, 'aktivitetId')
  const oppgaveId = tall(formData, 'oppgaveId')
  const tildelingId = tall(formData, 'tildelingId')
  await payload.delete({ collection: 'tildelinger', id: tildelingId, overrideAccess: true })
  await oppdaterOppgaveStatus(payload, oppgaveId)
  tilArrangement(aktivitetId, 'Personen er fjernet fra oppgaven.')
}

/** Rediger oppgave og bemanning: rolle, tjenestegruppe, antall personer og instruks. Statusen beregnes på nytt. */
export async function oppdaterOppgave(formData: FormData) {
  const { payload } = await krevAdmin()
  const aktivitetId = tall(formData, 'aktivitetId')
  const oppgaveId = tall(formData, 'oppgaveId')
  const rolle = tekst(formData, 'rolle')
  const gruppeId = tall(formData, 'gruppeId')
  if (!oppgaveId || !rolle || !gruppeId) throw new Error('Oppgavenavn og tjenestegruppe må fylles ut.')

  await payload.update({
    collection: 'oppgaver',
    id: oppgaveId,
    data: {
      tittel: rolle,
      gruppe: gruppeId,
      antallTrengs: Math.max(1, tall(formData, 'antall') || 1),
      instruksjon: tekst(formData, 'instruksjon') || null,
    },
    overrideAccess: true,
  })
  await oppdaterOppgaveStatus(payload, oppgaveId)
  tilArrangement(aktivitetId, 'Oppgaven er oppdatert.')
}

export async function slettOppgave(formData: FormData) {
  const { payload } = await krevAdmin()
  const aktivitetId = tall(formData, 'aktivitetId')
  const oppgaveId = tall(formData, 'oppgaveId')

  const { docs } = await payload.find({
    collection: 'tildelinger',
    where: { oppgave: { equals: oppgaveId } },
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })
  for (const t of docs) await payload.delete({ collection: 'tildelinger', id: t.id, overrideAccess: true })

  const aktivitet = await payload.findByID({ collection: 'aktiviteter', id: aktivitetId, depth: 0, overrideAccess: true })
  const program = (aktivitet.program ?? [])
    .filter((p) => (typeof p.oppgave === 'object' && p.oppgave !== null ? p.oppgave.id : p.oppgave) !== oppgaveId)
    .map((p) => ({
      klokkeslett: p.klokkeslett,
      tittel: p.tittel,
      beskrivelse: p.beskrivelse ?? undefined,
      oppgave: typeof p.oppgave === 'object' && p.oppgave !== null ? p.oppgave.id : (p.oppgave ?? undefined),
    }))
  await payload.update({ collection: 'aktiviteter', id: aktivitetId, data: { program }, overrideAccess: true })
  await payload.delete({ collection: 'oppgaver', id: oppgaveId, overrideAccess: true })
  tilArrangement(aktivitetId, 'Oppgaven er slettet.')
}
