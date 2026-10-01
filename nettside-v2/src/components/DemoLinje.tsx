import { cookies } from 'next/headers'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { DEMO_COOKIE, erDemo } from '@/lib/demo'

/**
 * Vises øverst på alle sider i demomodus (DEMO_MODUS=true): tydelig merking som demo, og knapper for å bytte rolle
 * (admin, gruppeleder, medlem) uten passord. Vises ikke i vanlig drift.
 */
export default async function DemoLinje() {
  if (!erDemo()) return null
  const payload = await getPayload({ config: await config })
  const { docs: personer } = await payload.find({ collection: 'users', sort: 'navn', limit: 50, depth: 0, overrideAccess: true })
  const valgt = Number((await cookies()).get(DEMO_COOKIE)?.value)

  return (
    <div className="demolinje" role="region" aria-label="Demo">
      <strong>DEMO</strong>
      <span className="demolinje-tekst">Mockdata, ingen ekte personer. Velg hvem du vil være:</span>
      <span className="demolinje-valg">
        {personer.map((p) => (
          <a
            key={p.id}
            href={`/demo/bytt?som=${p.id}&retur=${p.globalRolle === 'admin' ? '/admin-oversikt' : '/min-side'}`}
            className={p.id === valgt ? 'demovalg aktiv' : 'demovalg'}
            title={p.globalRolle === 'admin' ? 'Admin: arrangement og bemanning' : 'Min side, grupperom og oppgaver'}
          >
            {p.navn}
            {p.globalRolle === 'admin' ? ' (admin)' : ''}
          </a>
        ))}
        {valgt ? (
          <a href="/demo/bytt?som=0&retur=/" className="demovalg">
            Nullstill
          </a>
        ) : null}
      </span>
    </div>
  )
}
