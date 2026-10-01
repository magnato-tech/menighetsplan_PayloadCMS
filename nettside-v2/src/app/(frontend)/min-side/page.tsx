import { getPayload } from 'payload'
import config from '@/payload.config'
import { filtrerMineGrupper, finnLedetGrupper, finnRolleIGruppe, erGruppeleder as erGruppelederAvNoen } from '@/lib/gruppeLogikk'
import { statusForAktivitet } from '@/lib/aktivitetStatus'
import { taOppgave, meldForfall, svarInnkalling, svarTildeling } from '@/lib/handlinger'
import '../styles.css'

function fmtDatoKort(iso: string) {
  return new Date(iso).toLocaleDateString('nb-NO', {
    timeZone: 'Europe/Oslo',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}
function fmtDatoLang(iso: string) {
  return new Date(iso).toLocaleDateString('nb-NO', { timeZone: 'Europe/Oslo', weekday: 'long', day: 'numeric', month: 'long' })
}

type Fane = 'medlem' | 'gruppeleder' | 'admin'

export default async function MinSidePage({
  searchParams,
}: {
  searchParams: Promise<{ som?: string; fane?: string; filter?: string }>
}) {
  const { som, fane: faneParam, filter } = await searchParams
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const { docs: brukere } = await payload.find({ collection: 'users', sort: 'navn', limit: 100 })
  const valgtBruker = som ? brukere.find((b) => String(b.id) === som) : brukere[0]

  if (!valgtBruker) {
    return (
      <div className="min-side">
        <h1>Min side</h1>
        <p>
          Ingen personer finnes ennå. Kjør <code>npm run seed</code>.
        </p>
      </div>
    )
  }

  const { docs: alleGrupper } = await payload.find({ collection: 'grupper', limit: 100, depth: 1 })
  const mineGrupper = filtrerMineGrupper(alleGrupper, valgtBruker.id)
  const ledetGrupper = finnLedetGrupper(alleGrupper, valgtBruker.id)
  const rolleIGruppe = (g: (typeof alleGrupper)[number]) => finnRolleIGruppe(g, valgtBruker.id)

  const erAdmin = valgtBruker.globalRolle === 'admin'
  const erGruppeleder = erGruppelederAvNoen(alleGrupper, valgtBruker.id)
  const tilgjengeligeFaner: Fane[] = ['medlem', ...(erGruppeleder ? (['gruppeleder'] as const) : []), ...(erAdmin ? (['admin'] as const) : [])]
  const aktivFane: Fane = (faneParam as Fane) && tilgjengeligeFaner.includes(faneParam as Fane) ? (faneParam as Fane) : 'medlem'

  const { docs: alleOppgaver } = await payload.find({ collection: 'oppgaver', limit: 500, depth: 1 })
  const { docs: alleTildelinger } = await payload.find({ collection: 'tildelinger', limit: 500, depth: 1 })
  const { docs: alleAktiviteter } = await payload.find({ collection: 'aktiviteter', limit: 500, depth: 1, sort: 'start' })
  const { docs: alleMeldinger } = await payload.find({
    collection: 'gruppemeldinger',
    limit: 200,
    depth: 1,
    sort: '-createdAt',
  })
  const { docs: alleOppmoter } = await payload.find({ collection: 'oppmoter', limit: 500, depth: 1 })

  const gruppeId = (rel: unknown) => (typeof rel === 'object' && rel ? (rel as { id: string | number }).id : rel)

  // Min side (medlem) - Handlingskort: ledige oppgaver + venter på svar
  const ledigeOppgaver = alleOppgaver.filter(
    (o) => mineGrupper.some((g) => g.id === gruppeId(o.gruppe)) && (o.status === 'vacant' || o.status === 'open'),
  )
  const mineTildelinger = alleTildelinger.filter(
    (t) => gruppeId(t.person) === valgtBruker.id && t.svar === 'pending',
  )
  const ledigeOppgaverMedAktivitet = ledigeOppgaver.map((o) => ({
    oppgave: o,
    aktivitet: alleAktiviteter.find((a) => a.id === gruppeId(o.aktivitet)),
  }))
  const ubesvarteInnkallinger = alleAktiviteter.filter(
    (a) =>
      mineGrupper.some((g) => g.id === gruppeId(a.gruppe)) &&
      new Date(a.start) >= new Date() &&
      !alleOppmoter.some((m) => gruppeId(m.aktivitet) === a.id && gruppeId(m.person) === valgtBruker.id),
  )

  const handlinger = [
    ...ledigeOppgaverMedAktivitet.map((x) => ({
      type: 'ledig' as const,
      ...x,
    })),
    ...mineTildelinger.map((t) => ({
      type: 'venter' as const,
      tildeling: t,
      oppgave: alleOppgaver.find((o) => o.id === gruppeId(t.oppgave)),
      aktivitet: alleAktiviteter.find((a) => a.id === gruppeId(alleOppgaver.find((o) => o.id === gruppeId(t.oppgave))?.aktivitet)),
    })),
    ...ubesvarteInnkallinger.map((a) => ({
      type: 'innkalling' as const,
      aktivitet: a,
    })),
  ]

  const mineBekreftedeTildelinger = alleTildelinger
    .filter((t) => gruppeId(t.person) === valgtBruker.id && t.svar === 'confirmed')
    .map((t) => {
      const oppgave = alleOppgaver.find((o) => o.id === gruppeId(t.oppgave))
      return {
        tildeling: t,
        oppgave,
        aktivitet: alleAktiviteter.find((a) => a.id === gruppeId(oppgave?.aktivitet)),
      }
    })
    .filter((x) => x.oppgave)

  const gruppekort = mineGrupper.map((g) => {
    const nesteAkt = alleAktiviteter
      .filter((a) => gruppeId(a.gruppe) === g.id && new Date(a.start) >= new Date())
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0]
    const sisteMelding = alleMeldinger.find((m) => gruppeId(m.gruppe) === g.id)
    return {
      gruppe: g,
      rolle: rolleIGruppe(g),
      nesteAkt,
      nesteAktStatus: nesteAkt ? statusForAktivitet(nesteAkt.id, alleOppgaver, alleTildelinger) : null,
      sisteMelding,
    }
  })

  // Gruppeleder
  const aktiviteterLedetGrupper = alleAktiviteter.filter((a) => ledetGrupper.some((g) => g.id === gruppeId(a.gruppe)))
  const aktiviteterMedStatus = aktiviteterLedetGrupper.map((a) => ({
    akt: a,
    status: statusForAktivitet(a.id, alleOppgaver, alleTildelinger),
  }))
  const tellinger = {
    alle: aktiviteterMedStatus.length,
    forfall: aktiviteterMedStatus.filter((x) => x.status?.klasse === 'tag-forfall').length,
    mangler: aktiviteterMedStatus.filter((x) => x.status?.klasse === 'tag-mangler').length,
    dekket: aktiviteterMedStatus.filter((x) => x.status?.klasse === 'tag-dekket').length,
  }
  const aktivtFilter = filter && ['forfall', 'mangler', 'dekket'].includes(filter) ? filter : 'alle'
  const filtrerteAktiviteter = aktiviteterMedStatus.filter((x) => {
    if (aktivtFilter === 'alle') return true
    if (aktivtFilter === 'forfall') return x.status?.klasse === 'tag-forfall'
    if (aktivtFilter === 'mangler') return x.status?.klasse === 'tag-mangler'
    if (aktivtFilter === 'dekket') return x.status?.klasse === 'tag-dekket'
    return true
  })
  const trengerOppfolging = aktiviteterMedStatus.filter(
    (x) => x.status?.klasse === 'tag-mangler' || x.status?.klasse === 'tag-forfall',
  ).length

  const brukerId = valgtBruker.id
  function faneUrl(f: Fane) {
    return `/min-side?som=${brukerId}&fane=${f}`
  }

  return (
    <div className="min-side">
      <h1>Min side</h1>

      <form className="brukervelger" method="get">
        <input type="hidden" name="fane" value={aktivFane} />
        <label htmlFor="som">Vis som (demonstrasjon, ingen ekte innlogging ennå):</label>
        <select id="som" name="som" defaultValue={String(valgtBruker.id)}>
          {brukere.map((b) => (
            <option key={b.id} value={String(b.id)}>
              {b.navn}
            </option>
          ))}
        </select>
        <button type="submit">Bytt</button>
      </form>

      <div className="fanevelger">
        <a href={faneUrl('medlem')} className={aktivFane === 'medlem' ? 'fane aktiv' : 'fane'}>
          Min side
        </a>
        {erGruppeleder && (
          <a href={faneUrl('gruppeleder')} className={aktivFane === 'gruppeleder' ? 'fane aktiv' : 'fane'}>
            Gruppeleder
            {trengerOppfolging > 0 && <span className="fane-prikk" />}
          </a>
        )}
        {erAdmin && (
          <a href="/admin" className="fane">
            Admin
          </a>
        )}
      </div>

      {aktivFane === 'medlem' && (
        <>
          {handlinger.length > 0 && (
            <section className="kort handlingskort">
              <span className="handlingskort-label">DETTE TRENGER DIN HANDLING</span>
              <h2>{handlinger.length} saker venter på deg</h2>
              <div className="handlingskort-liste">
                {handlinger.map((h) => {
                  if (h.type === 'ledig') {
                    return (
                      <div key={`ledig-${h.oppgave.id}`} className="handlingskort-item">
                        <div className="handlingskort-item-innhold">
                          <span className="tag tag-trenger-vikar">TRENGER VIKAR</span>
                          <p className="handlingskort-item-tittel">{h.oppgave.tittel}</p>
                          {h.aktivitet && (
                            <p className="handlingskort-item-aktivitet">
                              {h.aktivitet.tittel} · {fmtDatoLang(h.aktivitet.start)}
                            </p>
                          )}
                        </div>
                        <form action={taOppgave} style={{ margin: 0 }}>
                          <input type="hidden" name="oppgaveId" value={h.oppgave.id} />
                          <input type="hidden" name="personId" value={valgtBruker.id} />
                          <button type="submit">Ta oppgave</button>
                        </form>
                      </div>
                    )
                  } else if (h.type === 'venter') {
                    return (
                      <div key={`venter-${h.tildeling.id}`} className="handlingskort-item">
                        <div className="handlingskort-item-innhold">
                          <span className="tag tag-venter-svar">VENTER PÅ SVAR</span>
                          <p className="handlingskort-item-tittel">{h.oppgave?.tittel}</p>
                          {h.aktivitet && (
                            <p className="handlingskort-item-aktivitet">
                              {h.aktivitet.tittel} · {fmtDatoLang(h.aktivitet.start)}
                            </p>
                          )}
                        </div>
                        <form action={svarTildeling} style={{ margin: 0, display: 'flex', gap: '0.4rem' }}>
                          <input type="hidden" name="tildelingId" value={h.tildeling.id} />
                          <button type="submit" name="status" value="confirmed">
                            Ja, jeg tar den
                          </button>
                          <button type="submit" name="status" value="declined" className="forfall">
                            Nei
                          </button>
                        </form>
                      </div>
                    )
                  } else {
                    return (
                      <div key={`innkalling-${h.aktivitet.id}`} className="handlingskort-item">
                        <div className="handlingskort-item-innhold">
                          <span className="tag tag-venter-svar">INNKALLING</span>
                          <p className="handlingskort-item-tittel">{h.aktivitet.tittel}</p>
                          <p className="handlingskort-item-aktivitet">{fmtDatoLang(h.aktivitet.start)}</p>
                        </div>
                        <form action={svarInnkalling} style={{ margin: 0, display: 'flex', gap: '0.4rem' }}>
                          <input type="hidden" name="aktivitetId" value={h.aktivitet.id} />
                          <input type="hidden" name="personId" value={valgtBruker.id} />
                          <button type="submit" name="status" value="attending">
                            Kommer
                          </button>
                          <button type="submit" name="status" value="declined" className="forfall">
                            Kan ikke
                          </button>
                        </form>
                      </div>
                    )
                  }
                })}
              </div>
            </section>
          )}

          {mineBekreftedeTildelinger.length > 0 && (
            <section className="kort">
              <h2>Mine oppgaver ({mineBekreftedeTildelinger.length})</h2>
              <div className="handlingskort-liste">
                {mineBekreftedeTildelinger.map((x) => (
                  <div key={`bekreftet-${x.tildeling.id}`} className="handlingskort-item">
                    <div className="handlingskort-item-innhold">
                      <span className="tag tag-dekket">BEKREFTET</span>
                      <p className="handlingskort-item-tittel">{x.oppgave!.tittel}</p>
                      {x.aktivitet && (
                        <p className="handlingskort-item-aktivitet">
                          {x.aktivitet.tittel} · {fmtDatoLang(x.aktivitet.start)}
                        </p>
                      )}
                    </div>
                    <form action={meldForfall} style={{ margin: 0 }}>
                      <input type="hidden" name="tildelingId" value={x.tildeling.id} />
                      <input type="hidden" name="oppgaveId" value={x.oppgave!.id} />
                      <button type="submit" className="forfall">
                        Meld forfall
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2>Mine grupper ({mineGrupper.length})</h2>
            {gruppekort.length === 0 && <p>Ikke medlem av noen grupper.</p>}
            <div className="gruppekort-liste">
              {gruppekort.map(({ gruppe, rolle, nesteAkt, nesteAktStatus, sisteMelding }) => (
                <div key={gruppe.id} className="gruppekort">
                  <div className="gruppekort-header">
                    <span className="tag">{gruppe.kategori}</span>
                    <span className={`tag tag-rolle-${rolle.toLowerCase()}`}>{rolle}</span>
                  </div>
                  <h3>{gruppe.navn}</h3>
                  <p className="gruppekort-meta">
                    {Array.isArray(gruppe.medlemmer) ? gruppe.medlemmer.length : 0} medlemmer
                    {gruppe.moteplan?.ukedag &&
                      ` · ${gruppe.moteplan.ukedag} kl. ${gruppe.moteplan.klokkeslett} (${gruppe.moteplan.frekvens})`}
                  </p>
                  {nesteAkt && (
                    <div className="gruppekort-neste">
                      <span className="gruppekort-neste-label">NESTE AKTIVITET</span>
                      {nesteAktStatus && <span className={`tag ${nesteAktStatus.klasse}`}>{nesteAktStatus.label}</span>}
                      <p>{nesteAkt.tittel}</p>
                      <p className="dempet">{fmtDatoLang(nesteAkt.start)}</p>
                    </div>
                  )}
                  {sisteMelding && (
                    <div className="gruppekort-melding">
                      <strong>{typeof sisteMelding.avsender === 'object' ? sisteMelding.avsender.navn : ''}</strong>
                      <p>{sisteMelding.innhold}</p>
                    </div>
                  )}
                  <a href={`/min-side/gruppe/${gruppe.id}?som=${valgtBruker.id}`} className="gruppekort-chat-lenke">
                    Gå til gruppechat →
                  </a>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {aktivFane === 'gruppeleder' && (
        <>
          <p className="rolle-info">
            {valgtBruker.navn} leder {ledetGrupper.length} grupper
          </p>

          {trengerOppfolging > 0 && (
            <section className="kort handlingskort">
              <h2>{trengerOppfolging} oppgaver trenger vikar / oppfølging</h2>
              <p>I {tellinger.alle} aktiviteter dette semesteret</p>
            </section>
          )}

          <section>
            <div className="semesteroversikt-header">
              <h2>Semesteroversikt</h2>
              <span className="dempet">{tellinger.alle} aktiviteter</span>
            </div>
            <div className="filterchips">
              <a href={`/min-side?som=${valgtBruker.id}&fane=gruppeleder&filter=alle`} className={aktivtFilter === 'alle' ? 'chip aktiv' : 'chip'}>
                Alle {tellinger.alle}
              </a>
              <a
                href={`/min-side?som=${valgtBruker.id}&fane=gruppeleder&filter=forfall`}
                className={aktivtFilter === 'forfall' ? 'chip chip-forfall aktiv' : 'chip chip-forfall'}
              >
                Forfall {tellinger.forfall}
              </a>
              <a
                href={`/min-side?som=${valgtBruker.id}&fane=gruppeleder&filter=mangler`}
                className={aktivtFilter === 'mangler' ? 'chip chip-mangler aktiv' : 'chip chip-mangler'}
              >
                Mangler {tellinger.mangler}
              </a>
              <a
                href={`/min-side?som=${valgtBruker.id}&fane=gruppeleder&filter=dekket`}
                className={aktivtFilter === 'dekket' ? 'chip chip-dekket aktiv' : 'chip chip-dekket'}
              >
                Dekket {tellinger.dekket}
              </a>
            </div>
            <ul className="aktivitetsliste">
              {filtrerteAktiviteter.map(({ akt, status }) => (
                <li key={akt.id}>
                  <span className="dato">{fmtDatoKort(akt.start)}</span>
                  <span className="tittel">{akt.tittel}</span>
                  {status && <span className={`tag ${status.klasse}`}>{status.label}</span>}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2>Mine ledergrupper</h2>
            <div className="gruppekort-liste">
              {ledetGrupper.map((g) => (
                <div key={g.id} className="gruppekort">
                  <div className="gruppekort-header">
                    <span className="tag">{g.kategori}</span>
                    <span className={`tag tag-rolle-${rolleIGruppe(g).toLowerCase()}`}>{rolleIGruppe(g)}</span>
                  </div>
                  <h3>{g.navn}</h3>
                  <p className="gruppekort-meta">
                    {Array.isArray(g.medlemmer) ? g.medlemmer.length : 0} medlemmer
                    {g.moteplan?.ukedag && ` · Fast tid: ${g.moteplan.ukedag} kl. ${g.moteplan.klokkeslett} (${g.moteplan.frekvens})`}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
