import Link from 'next/link'
import { hentAdmin, relId } from '@/lib/adminAuth'
import { beregnDekning } from '@/lib/dekning'
import { datoTidOslo } from '@/lib/tid'
import { opprettArrangement } from '@/lib/adminHandlinger'
import type { Oppgaver, Tildelinger } from '@/payload-types'

export const dynamic = 'force-dynamic'

/** Status for én oppgave: antall manglende personer, forfall eller dekket. */
function oppgaveStatus(o: Oppgaver, tilds: Tildelinger[]) {
  const mine = tilds.filter((t) => relId(t.oppgave) === o.id)
  const bekreftet = new Set(mine.filter((t) => t.svar === 'confirmed').map((t) => relId(t.person))).size
  const behov = o.antallTrengs ?? 1
  if (bekreftet >= behov) return { tekst: 'Dekket', klasse: 'pille pille-ok' }
  if (mine.some((t) => t.svar === 'withdrawn')) return { tekst: 'Forfall', klasse: 'pille pille-forfall' }
  return { tekst: `Mangler ${behov - bekreftet}`, klasse: 'pille pille-mangler' }
}

export default async function AdminOversiktSide() {
  const admin = await hentAdmin()
  if (!admin) {
    return (
      <div className="side-innhold adm">
        <h1>Admin-oversikt</h1>
        <p>Denne siden krever innlogging som admin.</p>
        <p>
          <a href="/admin">Logg inn i Payload-admin</a>, og kom tilbake hit.
        </p>
      </div>
    )
  }
  const { payload } = admin

  const { docs: aktiviteter } = await payload.find({
    collection: 'aktiviteter',
    sort: 'start',
    limit: 200,
    depth: 1,
    overrideAccess: true,
  })
  const { docs: oppgaver } = await payload.find({ collection: 'oppgaver', limit: 1000, depth: 0, overrideAccess: true })
  const { docs: tildelinger } = await payload.find({ collection: 'tildelinger', limit: 2000, depth: 0, overrideAccess: true })
  const { docs: grupper } = await payload.find({ collection: 'grupper', sort: 'navn', limit: 100, depth: 0, overrideAccess: true })

  const naa = Date.now()
  const kommende = aktiviteter.filter((a) => new Date(a.start).getTime() >= naa - 6 * 3600 * 1000)
  const tidligere = aktiviteter.filter((a) => !kommende.includes(a)).reverse()

  function Kort({ a }: { a: (typeof aktiviteter)[number] }) {
    const mineOppgaver = oppgaver.filter((o) => relId(o.aktivitet) === a.id && o.status !== 'cancelled')
    const mineIder = new Set(mineOppgaver.map((o) => o.id))
    const mineTilds = tildelinger.filter((t) => mineIder.has(relId(t.oppgave) ?? -1))
    const status = beregnDekning(mineOppgaver, mineTilds)
    const url = `/admin-oversikt/arrangement/${a.id}`
    return (
      <article className="adm-kort">
        <div className="adm-kort-topp">
          <div className="adm-kort-tittel">
            <strong>
              <Link href={url} className="adm-tittellenke">
                {a.tittel}
              </Link>
            </strong>
            <p>
              {datoTidOslo(a.start)}
              {a.sted ? ` · ${a.sted}` : ''}
              {typeof a.gruppe === 'object' ? ` · ${a.gruppe.navn}` : ''}
            </p>
            <p className="adm-hjelp">
              {a.erGudstjeneste ? 'Gudstjeneste' : a.type === 'gruppesamling' ? 'Gruppesamling' : 'Arrangement'}
              {a.offentlig ? ' · vises på nettsiden' : ''}
            </p>
          </div>
          {a.avlyst ? (
            <span className="pille pille-nei">Avlyst</span>
          ) : status ? (
            <span className={status.klasse === 'tag-dekket' ? 'pille pille-ok' : status.klasse === 'tag-forfall' ? 'pille pille-forfall' : 'pille pille-mangler'}>
              {status.label}
            </span>
          ) : (
            <span className="pille pille-info">Ingen oppgaver</span>
          )}
          <Link href={url} className="adm-apne">
            Åpne ›
          </Link>
        </div>

        {mineOppgaver.length > 0 && (
          <div className="adm-oppgaveliste">
            <p className="adm-etikett">OPPGAVER ({mineOppgaver.length}):</p>
            {mineOppgaver.map((o) => {
              const s = oppgaveStatus(o, mineTilds)
              return (
                <div key={o.id} className="adm-oppgaverad">
                  <span>{o.tittel}</span>
                  <span className="adm-oppgaverad-hoyre">
                    <span className={s.klasse}>{s.tekst}</span>
                    <Link href={`${url}#oppgave-${o.id}`} className="adm-kortlenke">
                      Kort →
                    </Link>
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </article>
    )
  }

  const antallOppfolging = kommende.filter((a) => {
    const os = oppgaver.filter((o) => relId(o.aktivitet) === a.id && o.status !== 'cancelled')
    const ids = new Set(os.map((o) => o.id))
    const d = beregnDekning(os, tildelinger.filter((t) => ids.has(relId(t.oppgave) ?? -1)))
    return (d?.oppfolging ?? 0) > 0 && !a.avlyst
  }).length

  return (
    <div className="side-innhold adm">
      <p className="adm-brodsmule">
        <Link href="/min-side">← Min side</Link> · <a href="/admin">Payload-admin</a>
      </p>
      <h1>Arrangementer og bemanningsstatus</h1>
      <p className="adm-meta">
        {kommende.length} kommende
        {antallOppfolging > 0 ? ` · ${antallOppfolging} krever oppfølging` : ' · alt er bemannet'}
      </p>

      <details className="adm-detaljer adm-stor">
        <summary>+ Nytt arrangement</summary>
        <form action={opprettArrangement} className="adm-skjema adm-rutenett">
          <label className="adm-bred">
            Tittel *
            <input name="tittel" required />
          </label>
          <label>
            Dato *
            <input type="date" name="dato" required />
          </label>
          <label>
            Tid
            <input type="time" name="tid" defaultValue="11:00" />
          </label>
          <label>
            Tjenestegruppe *
            <select name="gruppeId" required defaultValue="">
              <option value="" disabled>
                Velg gruppe…
              </option>
              {grupper.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.navn}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sted
            <input name="sted" />
          </label>
          <label className="adm-avkryss">
            <input type="checkbox" name="erGudstjeneste" /> Gudstjeneste
          </label>
          <label className="adm-avkryss">
            <input type="checkbox" name="offentlig" /> Vis på nettsiden
          </label>
          <button type="submit" className="adm-bred">
            Opprett arrangement
          </button>
        </form>
      </details>

      <h2 className="adm-seksjon">Kommende ({kommende.length})</h2>
      {kommende.length === 0 && <p className="adm-tom">Ingen kommende arrangementer.</p>}
      {kommende.map((a) => (
        <Kort key={a.id} a={a} />
      ))}

      {tidligere.length > 0 && (
        <details className="adm-detaljer">
          <summary>Tidligere arrangementer ({tidligere.length})</summary>
          {tidligere.map((a) => (
            <Kort key={a.id} a={a} />
          ))}
        </details>
      )}
    </div>
  )
}
