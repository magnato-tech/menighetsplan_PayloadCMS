import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { somMedDemo } from '@/lib/demo'
import { erLederIGruppe, erMedlemIGruppe, relId } from '@/lib/bemanning'
import OppgaveKort from '@/components/admin/OppgaveKort'
import '../../../styles.css'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ som?: string; melding?: string }>
}

/**
 * Oppgavekort for gruppeleder og medlem. Leder av oppgavens gruppe får redigere og gripe inn;
 * øvrige gruppemedlemmer ser det som angår dem og svarer for seg selv.
 * NB: personen identifiseres av «Vis som» (som), ikke av ekte innlogging ennå.
 */
export default async function OppgaveKortMinSide({ params, searchParams }: Props) {
  const { id } = await params
  const { som: somParam, melding } = await searchParams
  const oppgaveId = Number(id)
  if (!Number.isInteger(oppgaveId)) notFound()

  const som = await somMedDemo(somParam)
  const payload = await getPayload({ config: await config })
  const personId = Number(som)
  const aktor = Number.isInteger(personId)
    ? await payload.findByID({ collection: 'users', id: personId, depth: 0, overrideAccess: true }).catch(() => null)
    : null
  if (!aktor) {
    return (
      <div className="side-innhold adm">
        <h1>Oppgave</h1>
        <p>
          Velg hvem du er på <Link href="/min-side">Min side</Link> først.
        </p>
      </div>
    )
  }

  const oppgave = await payload.findByID({ collection: 'oppgaver', id: oppgaveId, depth: 0, overrideAccess: true }).catch(() => null)
  if (!oppgave) notFound()
  const gruppeId = relId(oppgave.gruppe)
  const gruppe = gruppeId ? await payload.findByID({ collection: 'grupper', id: gruppeId, depth: 0, overrideAccess: true }) : null

  if (!gruppe || !erMedlemIGruppe(gruppe, aktor.id)) {
    return (
      <div className="side-innhold adm">
        <h1>Oppgave</h1>
        <p>Du er ikke med i tjenestegruppen som har denne oppgaven.</p>
        <p>
          <Link href={`/min-side?som=${aktor.id}`}>← Tilbake til Min side</Link>
        </p>
      </div>
    )
  }

  const modus = erLederIGruppe(gruppe, aktor.id) ? 'leder' : 'medlem'
  return <OppgaveKort payload={payload} oppgaveId={oppgaveId} modus={modus} aktor={aktor} melding={melding} />
}
