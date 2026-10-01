import { notFound } from 'next/navigation'
import { hentAdmin } from '@/lib/adminAuth'
import OppgaveKort from '@/components/admin/OppgaveKort'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ melding?: string }>
}

export default async function OppgaveKortAdminSide({ params, searchParams }: Props) {
  const admin = await hentAdmin()
  if (!admin) {
    return (
      <div className="side-innhold adm">
        <h1>Oppgave</h1>
        <p>Denne siden krever innlogging som admin.</p>
        <p>
          <a href="/admin">Logg inn i Payload-admin</a>, og kom tilbake hit.
        </p>
      </div>
    )
  }
  const { id } = await params
  const { melding } = await searchParams
  const oppgaveId = Number(id)
  if (!Number.isInteger(oppgaveId)) notFound()
  return <OppgaveKort payload={admin.payload} oppgaveId={oppgaveId} modus="admin" melding={melding} />
}
