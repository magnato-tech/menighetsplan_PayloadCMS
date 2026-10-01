import { notFound } from 'next/navigation'
import { hentAdmin } from '@/lib/adminAuth'
import ArrangementSkjerm from '@/components/admin/ArrangementSkjerm'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ visning?: string; gruppe?: string; melding?: string }>
}

export default async function ArrangementAdminSide({ params, searchParams }: Props) {
  const admin = await hentAdmin()
  if (!admin) {
    return (
      <div className="side-innhold adm">
        <h1>Arrangement</h1>
        <p>Denne siden krever innlogging som admin.</p>
        <p>
          <a href="/admin">Logg inn i Payload-admin</a>, og kom tilbake hit.
        </p>
      </div>
    )
  }
  const { id: idTekst } = await params
  const { visning, gruppe, melding } = await searchParams
  const id = Number(idTekst)
  if (!Number.isInteger(id)) notFound()

  return <ArrangementSkjerm payload={admin.payload} id={id} visning={visning} gruppeFilter={gruppe} melding={melding} modus="admin" />
}
