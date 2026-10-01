import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { somMedDemo } from '@/lib/demo'
import { kanSeGrupperom } from '@/lib/grupperom'
import GrupperomSkjerm from '@/components/GrupperomSkjerm'
import '../../../styles.css'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ som?: string; fane?: string; filter?: string; periode?: string }>
}

/**
 * Grupperom: aktiviteter, gruppechat og medlemmer for en tjenestegruppe. Bare gruppens medlemmer kommer inn.
 * NB: personen identifiseres av «Vis som» (som), ikke av ekte innlogging ennå, men tilgangen sjekkes på serveren.
 */
export default async function GrupperomSide({ params, searchParams }: Props) {
  const { id } = await params
  const { som: somParam, fane, filter, periode } = await searchParams
  const gruppeId = Number(id)
  if (!Number.isInteger(gruppeId)) notFound()

  const som = await somMedDemo(somParam)
  const payload = await getPayload({ config: await config })
  const personId = Number(som)
  const aktor = Number.isInteger(personId)
    ? await payload.findByID({ collection: 'users', id: personId, depth: 0, overrideAccess: true }).catch(() => null)
    : null
  if (!aktor) {
    return (
      <div className="side-innhold adm">
        <h1>Grupperom</h1>
        <p>
          Velg hvem du er på <Link href="/min-side">Min side</Link> først.
        </p>
      </div>
    )
  }

  const gruppe = await payload.findByID({ collection: 'grupper', id: gruppeId, depth: 0, overrideAccess: true }).catch(() => null)
  if (!gruppe) notFound()
  if (!kanSeGrupperom(gruppe, aktor.id)) {
    return (
      <div className="side-innhold adm">
        <h1>{gruppe.navn}</h1>
        <p>Du er ikke med i denne gruppen, så du har ikke tilgang til grupperommet.</p>
        <p>
          <Link href={`/min-side?som=${aktor.id}`}>← Tilbake til Min side</Link>
        </p>
      </div>
    )
  }

  return <GrupperomSkjerm payload={payload} gruppeId={gruppeId} aktor={aktor} fane={fane} filter={filter} periode={periode} />
}
