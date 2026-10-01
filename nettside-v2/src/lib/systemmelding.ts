import type { Payload } from 'payload'
import { relId } from '@/lib/bemanning'
import { datoTidOslo } from '@/lib/tid'

export type Hendelse = 'tok' | 'forfall' | 'ja' | 'nei' | 'tildelt' | 'forespurt' | 'fjernet'

/**
 * Skriver en systemmelding i gruppechaten til oppgavens tjenestegruppe, slik at alle i gruppen og gruppelederen
 * ser hva som skjer: at noen tar en oppgave, melder forfall, svarer på en forespørsel, blir tildelt eller fjernet.
 * Avsender er den som utførte handlingen (aktør). Feil her skal aldri stoppe selve handlingen.
 */
export async function skrivSystemmelding(
  payload: Payload,
  args: { oppgaveId: number; personId: number; aktorId: number; hendelse: Hendelse },
): Promise<void> {
  try {
    const { oppgaveId, personId, aktorId, hendelse } = args
    const oppgave = await payload.findByID({ collection: 'oppgaver', id: oppgaveId, depth: 1, overrideAccess: true })
    const gruppeId = relId(oppgave.gruppe)
    if (!gruppeId) return

    const person = await payload.findByID({ collection: 'users', id: personId, depth: 0, overrideAccess: true })
    const aktor = aktorId === personId ? person : await payload.findByID({ collection: 'users', id: aktorId, depth: 0, overrideAccess: true })
    const aktivitet = typeof oppgave.aktivitet === 'object' ? oppgave.aktivitet : null
    const hva = `«${oppgave.tittel}»` + (aktivitet ? ` på «${aktivitet.tittel}» (${datoTidOslo(aktivitet.start)})` : '')

    const tekst: Record<Hendelse, string> = {
      tok: `${person.navn} tok oppgaven ${hva}.`,
      forfall: `${person.navn} meldte forfall på ${hva}. Oppgaven er ledig for gruppen.`,
      ja: `${person.navn} takket ja til ${hva}.`,
      nei: `${person.navn} avslo ${hva}. Plassen er ledig for gruppen.`,
      tildelt: `${person.navn} er tildelt ${hva} av ${aktor.navn}.`,
      forespurt: `${person.navn} er forespurt til ${hva} av ${aktor.navn}.`,
      fjernet: `${person.navn} er fjernet fra ${hva} av ${aktor.navn}.`,
    }

    await payload.create({
      collection: 'gruppemeldinger',
      data: { gruppe: gruppeId, avsender: aktorId, innhold: tekst[hendelse], type: 'system' },
      overrideAccess: true,
    })
  } catch (feil) {
    console.error('Kunne ikke skrive systemmelding:', feil)
  }
}
