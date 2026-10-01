import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { somMedDemo } from '@/lib/demo'
import { erLederIGruppe, relId } from '@/lib/bemanning'
import ArrangementSkjerm from '@/components/admin/ArrangementSkjerm'
import '../../../../styles.css'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ som?: string; visning?: string; gruppe?: string; melding?: string }>
}

/**
 * Arrangementsskjerm for gruppeleder: samme kjøreplan som admin, men bare oppgaver i grupper lederen leder
 * kan håndteres. NB: lederen identifiseres av «Vis som» (som), ikke av ekte innlogging ennå.
 */
export default async function ArrangementLederSide({ params, searchParams }: Props) {
  const { id: idTekst } = await params
  const { som: somParam, visning, gruppe, melding } = await searchParams
  const id = Number(idTekst)
  if (!Number.isInteger(id)) notFound()

  const som = await somMedDemo(somParam)
  const payload = await getPayload({ config: await config })
  const lederId = Number(som)
  const aktor = Number.isInteger(lederId)
    ? await payload.findByID({ collection: 'users', id: lederId, depth: 0, overrideAccess: true }).catch(() => null)
    : null

  if (!aktor) {
    return (
      <div className="side-innhold adm">
        <h1>Arrangement</h1>
        <p>
          Velg hvem du er på <Link href="/min-side">Min side</Link> først.
        </p>
      </div>
    )
  }

  const { docs: oppgaver } = await payload.find({
    collection: 'oppgaver',
    where: { aktivitet: { equals: id } },
    depth: 0,
    limit: 200,
    overrideAccess: true,
  })
  const { docs: grupper } = await payload.find({ collection: 'grupper', limit: 100, depth: 0, overrideAccess: true })
  const involvert = new Set(oppgaver.map((o) => relId(o.gruppe)).filter((g): g is number => !!g))
  const lederIEnInvolvert = grupper.some((g) => involvert.has(g.id) && erLederIGruppe(g, aktor.id))

  if (!lederIEnInvolvert) {
    return (
      <div className="side-innhold adm">
        <h1>Arrangement</h1>
        <p>Du leder ingen tjenestegruppe som har oppgaver på dette arrangementet.</p>
        <p>
          <Link href={`/min-side?som=${aktor.id}`}>← Tilbake til Min side</Link>
        </p>
      </div>
    )
  }

  return (
    <ArrangementSkjerm payload={payload} id={id} visning={visning} gruppeFilter={gruppe} melding={melding} modus="leder" aktor={aktor} />
  )
}
