import Link from 'next/link'
import type { Payload } from 'payload'
import { erLederIGruppe, relId } from '@/lib/bemanning'
import {
  aktiviteterForGruppe,
  filtrerGruppeAktiviteter,
  kanSeKontaktinfo,
  medlemmerMedRolle,
  perioderIListe,
  type AktivitetFilter,
} from '@/lib/grupperom'
import { datoTidOslo } from '@/lib/tid'
import { sendMelding } from '@/lib/handlinger'
import type { User } from '@/payload-types'

type Props = {
  payload: Payload
  gruppeId: number
  /** Personen som ser rommet («Vis som»). Må være med i gruppen. */
  aktor: User
  fane?: string
  filter?: string
  periode?: string
}

const chipKlasse: Record<string, string> = { confirmed: 'pille-ok', pending: 'pille-venter', withdrawn: 'pille-forfall', declined: 'pille-nei' }
const merkelapp: Record<string, string> = { confirmed: '', pending: 'Forespurt', withdrawn: 'Forfall', declined: 'Avslått' }
const rekkefolge: Record<string, number> = { confirmed: 0, pending: 1, withdrawn: 2, declined: 3 }
const MAANED = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember']

function periodeNavn(p: string) {
  const [aar, mnd] = p.split('-')
  return `${MAANED[Number(mnd) - 1]} ${aar}`
}

/**
 * Grupperom for en tjenestegruppe: arrangementer gruppen skal delta i, gruppechat (med systemmeldinger) og medlemmer.
 * Alle i gruppen ser det samme; kontaktinfo og andres forespørsler/forfall vises bare for leder og admin.
 */
export default async function GrupperomSkjerm({ payload, gruppeId, aktor, fane, filter, periode }: Props) {
  const gruppe = await payload.findByID({ collection: 'grupper', id: gruppeId, depth: 1, overrideAccess: true })
  const erLeder = erLederIGruppe(gruppe, aktor.id)
  const erAdmin = aktor.globalRolle === 'admin'
  const kanSeAlt = kanSeKontaktinfo(gruppe, aktor.id, erAdmin)
  const rolle = (Array.isArray(gruppe.ledere) ? gruppe.ledere : []).some((p) => relId(p) === aktor.id)
    ? 'Leder'
    : erLeder
      ? 'Nestleder'
      : 'Medlem'

  const aktivFane = fane === 'chat' || fane === 'medlemmer' ? fane : 'aktiviteter'
  const aktivtFilter: AktivitetFilter = filter === 'mine' || filter === 'mangler' ? filter : 'alle'
  const lenke = (f: string, ekstra: Record<string, string> = {}) => {
    const q = new URLSearchParams({ som: String(aktor.id), fane: f, ...ekstra })
    return `/min-side/gruppe/${gruppeId}?${q.toString()}`
  }

  const medlemmer = medlemmerMedRolle(gruppe)
  const personer = new Map<number, User>()
  for (const lista of [gruppe.ledere, gruppe.varaledere, gruppe.medlemmer]) {
    if (Array.isArray(lista)) for (const p of lista) if (typeof p === 'object' && p) personer.set(p.id, p as User)
  }

  const { docs: meldinger } = await payload.find({
    collection: 'gruppemeldinger',
    where: { gruppe: { equals: gruppeId } },
    limit: 300,
    depth: 1,
    overrideAccess: true,
  })
  meldinger.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a.id - b.id)

  // Aktiviteter-fanen
  let aktivitetInnhold: React.ReactNode = null
  let antallAktiviteter = 0
  if (aktivFane === 'aktiviteter') {
    const { docs: aktiviteter } = await payload.find({ collection: 'aktiviteter', sort: 'start', limit: 500, depth: 1, overrideAccess: true })
    const { docs: oppgaver } = await payload.find({ collection: 'oppgaver', limit: 1000, depth: 1, overrideAccess: true })
    const { docs: tildelinger } = await payload.find({ collection: 'tildelinger', limit: 3000, depth: 1, overrideAccess: true })
    const alle = aktiviteterForGruppe(gruppeId, aktor.id, aktiviteter, oppgaver, tildelinger)
    const synlige = filtrerGruppeAktiviteter(alle, aktivtFilter, periode || undefined)
    const perioder = perioderIListe(alle)
    antallAktiviteter = alle.length
    const oppfolging = alle.reduce((sum, g) => sum + (g.dekning?.oppfolging ?? 0), 0)

    aktivitetInnhold = (
      <>
        {oppfolging > 0 && (
          <div className="adm-dekning adm-dekning-forfall">
            <div>
              <strong>
                {oppfolging} oppgave{oppfolging === 1 ? '' : 'r'} trenger oppfølging / vikar
              </strong>
              <br />
              <span>Alle i gruppen kan ta ledige oppgaver.</span>
            </div>
            <Link href={lenke('aktiviteter', { filter: 'mangler' })} className="adm-apne">
              Vis forfall →
            </Link>
          </div>
        )}

        <div className="adm-faner">
          {(['alle', 'mine', 'mangler'] as const).map((f) => (
            <Link
              key={f}
              href={lenke('aktiviteter', { filter: f, ...(periode ? { periode } : {}) })}
              className={aktivtFilter === f ? 'adm-fane aktiv' : 'adm-fane'}
            >
              {f === 'alle' ? 'Alle arrangementer' : f === 'mine' ? 'Mine (jeg er satt opp)' : 'Forfall / Mangler'}
              {f === 'mangler' && oppfolging > 0 && <span className="adm-teller">{oppfolging}</span>}
            </Link>
          ))}
        </div>

        {perioder.length > 1 && (
          <form method="get" className="adm-filter">
            <input type="hidden" name="som" value={aktor.id} />
            <input type="hidden" name="fane" value="aktiviteter" />
            <input type="hidden" name="filter" value={aktivtFilter} />
            <label>
              <span className="adm-etikett">PERIODE:</span>{' '}
              <select name="periode" defaultValue={periode ?? ''}>
                <option value="">Alle perioder</option>
                {perioder.map((p) => (
                  <option key={p} value={p}>
                    {periodeNavn(p)}
                  </option>
                ))}
              </select>
            </label>{' '}
            <button type="submit" className="adm-apne">
              Filtrer
            </button>
          </form>
        )}

        <div className="adm-seksjonsrad">
          <h2 className="adm-seksjon">Planlagte aktiviteter</h2>
          <span className="adm-viser">
            {synlige.length} av {alle.length} aktiviteter
          </span>
        </div>
        {synlige.length === 0 && <p className="adm-tom">Ingen aktiviteter matcher filteret.</p>}

        {synlige.map((g) => {
          const a = g.aktivitet
          const klasse = g.dekning ? (g.dekning.klasse === 'tag-dekket' ? 'pille-ok' : g.dekning.klasse === 'tag-forfall' ? 'pille-forfall' : 'pille-mangler') : 'pille-info'
          return (
            <article key={a.id} className={g.dekning && g.dekning.oppfolging > 0 ? 'adm-kort adm-kort-rod' : 'adm-kort'} data-aktivitet={a.id}>
              <div className="adm-kort-topp">
                <div className="adm-kort-tittel">
                  <strong>{a.tittel}</strong>{' '}
                  <span className="pille pille-info">{a.erGudstjeneste ? 'GUDSTJENESTE' : a.type === 'gruppesamling' ? 'SAMLING' : 'ARRANGEMENT'}</span>
                  <p>
                    {datoTidOslo(a.start)}
                    {a.sted ? ` · ${a.sted}` : ''}
                  </p>
                  {g.mine && <p className="adm-hjelp">Du er satt opp på dette arrangementet</p>}
                </div>
                <span className={`pille ${klasse}`}>{g.dekning?.label ?? 'Ingen oppgaver'}</span>
              </div>
              {g.dekning && (
                <p className="adm-hjelp">
                  {g.dekning.dekkede} av {g.dekning.totalt} dekket
                </p>
              )}
              <div className="adm-oppgaveliste">
                <p className="adm-etikett">OPPGAVER ({g.oppgaver.length}):</p>
                {g.oppgaver.map((b) => {
                  const sortert = [...b.tilds].sort((x, y) => (rekkefolge[x.svar ?? 'pending'] ?? 9) - (rekkefolge[y.svar ?? 'pending'] ?? 9))
                  return (
                    <div key={b.oppgave.id} className="adm-oppgaverad">
                      <span>
                        {b.oppgave.tittel}{' '}
                        {sortert
                          .filter((t) => kanSeAlt || t.svar === 'confirmed' || relId(t.person) === aktor.id)
                          .map((t) => {
                            const navn = typeof t.person === 'object' && t.person ? t.person.navn : 'Ukjent'
                            const svar = t.svar ?? 'pending'
                            return (
                              <span key={t.id} className={`pille ${chipKlasse[svar]}`} data-svar={svar}>
                                {navn}
                                {merkelapp[svar] && <span className="adm-merke">{merkelapp[svar]}</span>}
                              </span>
                            )
                          })}
                      </span>
                      <span className="adm-oppgaverad-hoyre">
                        <span className={`pille ${b.dekket ? 'pille-ok' : b.forfall ? 'pille-forfall' : 'pille-mangler'}`}>
                          {b.bekreftet}/{b.behov}
                        </span>
                        <Link href={`/min-side/oppgave/${b.oppgave.id}?som=${aktor.id}`} className="adm-kortlenke">
                          Oppgavekort →
                        </Link>
                      </span>
                    </div>
                  )
                })}
              </div>
              {erLeder && (
                <p className="adm-hjelp">
                  <Link href={`/min-side/leder/arrangement/${a.id}?som=${aktor.id}`} className="adm-kortlenke">
                    Åpne aktivitetsdetalj ›
                  </Link>
                </p>
              )}
            </article>
          )
        })}
      </>
    )
  }

  return (
    <div className="side-innhold adm grupperom">
      <p className="adm-brodsmule">
        <Link href={`/min-side?som=${aktor.id}`}>← Min side</Link>
      </p>
      <header className="adm-topp">
        <span className="pille pille-gruppe">{rolle}</span>
        <h1>{gruppe.navn}</h1>
        <p className="adm-meta">
          {gruppe.kategori ? `${gruppe.kategori[0].toUpperCase()}${gruppe.kategori.slice(1)} · ` : ''}
          {medlemmer.length} medlemmer
        </p>
        {gruppe.moteplan?.ukedag && (
          <p className="adm-meta">
            Fast møteplan: {gruppe.moteplan.ukedag} kl. {gruppe.moteplan.klokkeslett} ({gruppe.moteplan.frekvens})
          </p>
        )}
      </header>

      <nav className="adm-faner" aria-label="Grupperom">
        <Link href={lenke('aktiviteter')} className={aktivFane === 'aktiviteter' ? 'adm-fane aktiv' : 'adm-fane'}>
          Aktiviteter
        </Link>
        <Link href={lenke('chat')} className={aktivFane === 'chat' ? 'adm-fane aktiv' : 'adm-fane'}>
          Gruppechat <span className="adm-teller adm-teller-noytral">{meldinger.length}</span>
        </Link>
        <Link href={lenke('medlemmer')} className={aktivFane === 'medlemmer' ? 'adm-fane aktiv' : 'adm-fane'}>
          Medlemmer ({medlemmer.length})
        </Link>
      </nav>

      {aktivFane === 'aktiviteter' && aktivitetInnhold}
      {aktivFane === 'aktiviteter' && antallAktiviteter === 0 && <p className="adm-tom">Gruppen har ingen arrangementer ennå.</p>}

      {aktivFane === 'chat' && (
        <section aria-label="Gruppechat">
          <div className="meldingsliste">
            {meldinger.length === 0 && <p className="adm-tom">Ingen meldinger ennå i denne gruppen.</p>}
            {meldinger.map((m) => {
              const navn = typeof m.avsender === 'object' && m.avsender ? m.avsender.navn : 'Ukjent'
              const erSystem = m.type === 'system'
              const egen = relId(m.avsender) === aktor.id
              return (
                <div key={m.id} className={erSystem ? 'melding melding-system' : egen ? 'melding melding-egen' : 'melding'} data-type={m.type ?? 'melding'}>
                  {!erSystem && <div className="melding-avsender">{navn}</div>}
                  <p className="melding-innhold">{m.innhold}</p>
                  <div className="melding-tid">{datoTidOslo(m.createdAt)}</div>
                </div>
              )
            })}
          </div>
          <form action={sendMelding} className="send-melding-skjema">
            <input type="hidden" name="gruppeId" value={gruppeId} />
            <input type="hidden" name="avsenderId" value={aktor.id} />
            <input type="text" name="innhold" placeholder="Skriv en melding…" required maxLength={2000} aria-label="Meldingstekst" />
            <button type="submit">Send</button>
          </form>
          <p className="adm-hjelp">Alle i gruppen ser meldingene. Systemmeldinger skrives automatisk når noen tar en oppgave, melder forfall eller blir tildelt.</p>
        </section>
      )}

      {aktivFane === 'medlemmer' && (
        <section aria-label="Medlemmer">
          {medlemmer.map((m) => {
            const p = personer.get(m.id)
            return (
              <div key={m.id} className="oppgavekort-person" data-rolle={m.rolle}>
                <div>
                  <strong>{p?.navn ?? 'Ukjent'}</strong>
                  {kanSeAlt && p && (
                    <p className="adm-hjelp">
                      {p.telefon ? `${p.telefon} · ` : ''}
                      {p.email}
                    </p>
                  )}
                </div>
                <span className="pille pille-gruppe">{m.rolle}</span>
              </div>
            )
          })}
          {!kanSeAlt && <p className="adm-hjelp">Kontaktinfo vises bare for gruppens leder og nestleder.</p>}
        </section>
      )}
    </div>
  )
}
