import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Payload } from 'payload'
import { relId, erLederIGruppe, erMedlemIGruppe } from '@/lib/bemanning'
import { beregnDekning } from '@/lib/dekning'
import { datoTidOslo, isoTilOslo } from '@/lib/tid'
import {
  oppdaterArrangement,
  opprettOppgave,
  oppdaterOppgave,
  foresporPerson,
  tildelPerson,
  fjernTildeling,
  slettOppgave,
} from '@/lib/adminHandlinger'
import { lederForespor, lederTildel, lederFjern } from '@/lib/lederHandlinger'
import PersonVelger from '@/components/admin/PersonVelger'
import type { Grupper, Oppgaver, Tildelinger, User } from '@/payload-types'

type Props = {
  payload: Payload
  id: number
  visning?: string
  gruppeFilter?: string
  melding?: string
  /** 'admin': full kontroll. 'leder': bare egne gruppers oppgaver, og bare personer i egen gruppe. */
  modus: 'admin' | 'leder'
  /** Gruppelederen (modus 'leder'). */
  aktor?: User
}

function navnPaPerson(p: number | User | undefined | null): string {
  return typeof p === 'object' && p !== null ? p.navn : 'Ukjent'
}

/** Arrangementsskjerm med kjøreplan, bemanning og handlinger. Brukes av admin og gruppeleder. */
export default async function ArrangementSkjerm({ payload, id, visning, gruppeFilter, melding, modus, aktor }: Props) {
  const erLeder = modus === 'leder' && !!aktor

  let aktivitet
  try {
    aktivitet = await payload.findByID({ collection: 'aktiviteter', id, depth: 1, overrideAccess: true })
  } catch {
    notFound()
  }

  const { docs: oppgaver } = await payload.find({
    collection: 'oppgaver',
    where: { aktivitet: { equals: id } },
    depth: 1,
    limit: 200,
    overrideAccess: true,
  })
  const oppgaveIder = oppgaver.map((o) => o.id)
  const { docs: tildelinger } = oppgaveIder.length
    ? await payload.find({
        collection: 'tildelinger',
        where: { oppgave: { in: oppgaveIder } },
        depth: 1,
        limit: 500,
        overrideAccess: true,
      })
    : { docs: [] as Tildelinger[] }
  const { docs: brukere } = await payload.find({ collection: 'users', sort: 'navn', limit: 200, depth: 0, overrideAccess: true })
  const { docs: grupper } = await payload.find({ collection: 'grupper', sort: 'navn', limit: 100, depth: 0, overrideAccess: true })
  const lederGrupper = erLeder && aktor ? grupper.filter((g) => erLederIGruppe(g, aktor.id)).map((g) => g.id) : []

  const oppgaveInfo = new Map<
    number,
    { oppgave: Oppgaver; tilds: Tildelinger[]; bekreftet: number; behov: number; dekket: boolean; forfall: boolean }
  >()
  for (const o of oppgaver) {
    const tilds = tildelinger.filter((t) => relId(t.oppgave) === o.id)
    const bekreftet = new Set(tilds.filter((t) => t.svar === 'confirmed').map((t) => relId(t.person))).size
    const behov = o.antallTrengs ?? 1
    const dekket = bekreftet >= behov
    const forfall = tilds.some((t) => t.svar === 'withdrawn') && !dekket
    oppgaveInfo.set(o.id, { oppgave: o, tilds, bekreftet, behov, dekket, forfall })
  }
  const minGruppeInfo = Array.from(oppgaveInfo.values()).filter(
    (i) => lederGrupper.includes(relId(i.oppgave.gruppe) ?? -1) && i.oppgave.status !== 'cancelled',
  )
  const minGruppeDekket = minGruppeInfo.filter((i) => i.dekket).length
  const aktive = oppgaver.filter((o) => o.status !== 'cancelled')
  const dekkede = aktive.filter((o) => oppgaveInfo.get(o.id)?.dekket).length
  const status = beregnDekning(oppgaver, tildelinger)

  const programIder = new Set<number>()
  const rader = (aktivitet.program ?? []).map((p) => {
    const oppgaveId = relId(p.oppgave)
    if (oppgaveId) programIder.add(oppgaveId)
    return {
      nokkel: p.id ?? `${p.klokkeslett}-${p.tittel}`,
      klokkeslett: p.klokkeslett,
      tittel: p.tittel,
      beskrivelse: p.beskrivelse,
      info: oppgaveId ? oppgaveInfo.get(oppgaveId) : undefined,
    }
  })
  const utenProgram = oppgaver.filter((o) => !programIder.has(o.id))

  const gruppeIder = Array.from(new Set(oppgaver.map((o) => relId(o.gruppe)).filter((g): g is number => !!g)))
  const gruppeNavn = new Map<number, string>(grupper.map((g: Grupper) => [g.id, g.navn]))

  const visMangler = visning === 'mangler'
  const visGruppe = erLeder && visning === 'gruppe'
  const valgtGruppe = gruppeFilter ? Number(gruppeFilter) : undefined
  const synligeRader = rader.filter((r) => {
    if (visMangler && !(r.info && (!r.info.dekket || r.info.forfall))) return false
    if (visGruppe && !lederGrupper.includes(relId(r.info?.oppgave.gruppe) ?? -1)) return false
    if (valgtGruppe && relId(r.info?.oppgave.gruppe) !== valgtGruppe) return false
    return true
  })
  const synligeUtenProgram = utenProgram.filter((o) => {
    const i = oppgaveInfo.get(o.id)
    if (visMangler && !(i && (!i.dekket || i.forfall))) return false
    if (visGruppe && !lederGrupper.includes(relId(o.gruppe) ?? -1)) return false
    if (valgtGruppe && relId(o.gruppe) !== valgtGruppe) return false
    return true
  })

  const { dato, tid } = isoTilOslo(aktivitet.start)
  const baseUrl = erLeder ? `/min-side/leder/arrangement/${id}` : `/admin-oversikt/arrangement/${id}`
  const lenke = (v?: string, g?: number) => {
    const q = new URLSearchParams()
    if (v) q.set('visning', v)
    if (g) q.set('gruppe', String(g))
    if (erLeder && aktor) q.set('som', String(aktor.id))
    const s = q.toString()
    return s ? `${baseUrl}?${s}` : baseUrl
  }

  function Oppgavelinje({ info }: { info: NonNullable<ReturnType<typeof oppgaveInfo.get>> }) {
    const { oppgave, tilds, bekreftet, behov } = info
    const aktiveTilds = tilds.filter((t) => t.svar === 'pending' || t.svar === 'confirmed')
    const rekkefolge: Record<string, number> = { confirmed: 0, pending: 1, withdrawn: 2, declined: 3 }
    const sortert = [...tilds].sort((a, b) => (rekkefolge[a.svar ?? 'pending'] ?? 9) - (rekkefolge[b.svar ?? 'pending'] ?? 9))
    const chipKlasse: Record<string, string> = { confirmed: 'pille-ok', pending: 'pille-venter', withdrawn: 'pille-forfall', declined: 'pille-nei' }
    const merkelapp: Record<string, string> = { confirmed: '', pending: 'Forespurt', withdrawn: 'Forfall', declined: 'Avslått' }
    const opptatt = new Set(aktiveTilds.map((t) => relId(t.person)))
    const kanHandtere = !erLeder || lederGrupper.includes(relId(oppgave.gruppe) ?? -1)
    const gruppeForOppgave = grupper.find((g) => g.id === relId(oppgave.gruppe))
    const kandidater = brukere.filter(
      (b) => !opptatt.has(b.id) && (!erLeder || (gruppeForOppgave ? erMedlemIGruppe(gruppeForOppgave, b.id) : false)),
    )
    const tildelHandling = erLeder ? lederTildel : tildelPerson
    const foresporHandling = erLeder ? lederForespor : foresporPerson
    const fjernHandling = erLeder ? lederFjern : fjernTildeling
    const ekstraFelt = erLeder && aktor ? { aktorId: aktor.id } : undefined
    return (
      <div className="adm-oppgave">
        <div className="adm-ansvarlig">
          <span className="adm-etikett">ANSVARLIG:</span>
          {aktiveTilds.length === 0 && <span className="pille pille-mangler">Ingen ennå</span>}
          {sortert.map((t) => (
            <span key={t.id} className={`pille ${chipKlasse[t.svar ?? 'pending']}`} data-svar={t.svar ?? 'pending'}>
              <span className={t.svar === 'declined' ? 'adm-strek' : undefined}>{navnPaPerson(t.person)}</span>
              {merkelapp[t.svar ?? 'pending'] && <span className="adm-merke">{merkelapp[t.svar ?? 'pending']}</span>}
              {kanHandtere && (
                <form action={fjernHandling} className="adm-inline">
                  {erLeder && aktor && <input type="hidden" name="aktorId" value={aktor.id} />}
                  <input type="hidden" name="aktivitetId" value={id} />
                  <input type="hidden" name="oppgaveId" value={oppgave.id} />
                  <input type="hidden" name="tildelingId" value={t.id} />
                  <button type="submit" className="adm-x" title="Fjern fra oppgaven" aria-label={`Fjern ${navnPaPerson(t.person)}`}>
                    ×
                  </button>
                </form>
              )}
            </span>
          ))}          <span className="adm-behov">
            Behov: {behov} pers. ({bekreftet}/{behov} bekreftet)
            {' · '}
            <Link href={erLeder && aktor ? `/min-side/oppgave/${oppgave.id}?som=${aktor.id}` : `/admin-oversikt/oppgave/${oppgave.id}`} className="adm-kortlenke">
              Oppgavekort →
            </Link>
          </span>
        </div>
        {!kanHandtere && <p className="adm-hjelp">Denne oppgaven tilhører en annen tjenestegruppe. Bare den gruppens leder kan gripe inn.</p>}
        {kanHandtere && (
        <div className="adm-handlinger">
          <details className={info.dekket ? 'adm-detaljer' : 'adm-detaljer adm-grip'}>
            <summary>{info.dekket ? 'Tildel / forespør person' : 'Grip inn / Tildel'}</summary>
            <PersonVelger
              aktivitetId={id}
              oppgaveId={oppgave.id}
              personer={kandidater.map((b) => ({ id: b.id, navn: b.navn, epost: b.email }))}
              tildelAction={tildelHandling}
              foresporAction={foresporHandling}
              ekstraFelt={ekstraFelt}
            />
          </details>
          {!erLeder && (
          <details className="adm-detaljer">
            <summary>Rediger</summary>
            <form action={oppdaterOppgave} className="adm-skjema">
              <p className="adm-etikett">ADMINISTRATIV OPPGAVEKONTROLL</p>
              <input type="hidden" name="aktivitetId" value={id} />
              <input type="hidden" name="oppgaveId" value={oppgave.id} />
              <label>
                Oppgavetittel / Rolle
                <input name="rolle" defaultValue={oppgave.tittel} required />
              </label>
              <label>
                Ansvarlig tjenestegruppe
                <select name="gruppeId" required defaultValue={relId(oppgave.gruppe)}>
                  {grupper.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.navn}
                      {g.kategori ? ` (${g.kategori})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Bemanningsbehov (antall personer)
                <input type="number" name="antall" min={1} defaultValue={behov} />
              </label>
              <label>
                Oppgaveinstruks (vises ved behov)
                <textarea name="instruksjon" rows={3} defaultValue={oppgave.instruksjon ?? ''} />
              </label>
              <button type="submit">Lagre endringer</button>
            </form>
          </details>
          )}
          <details className="adm-detaljer">
            <summary>Instruks</summary>
            <p className="adm-instruks">{oppgave.instruksjon || 'Ingen instruks lagt inn ennå.'}</p>
          </details>
          {!erLeder && (
          <details className="adm-detaljer adm-fare">
            <summary>Slett</summary>
            <form action={slettOppgave} className="adm-skjema">
              <input type="hidden" name="aktivitetId" value={id} />
              <input type="hidden" name="oppgaveId" value={oppgave.id} />
              <p>Sletter oppgaven og alle tildelinger. Kan ikke angres.</p>
              <button type="submit" className="adm-fareknapp">
                Ja, slett oppgaven
              </button>
            </form>
          </details>
          )}
        </div>
        )}
      </div>
    )
  }

  return (
    <div className="side-innhold adm">
      <p className="adm-brodsmule">
        {erLeder && aktor ? (
          <Link href={`/min-side?som=${aktor.id}&fane=gruppeleder`}>← Min side (gruppeleder)</Link>
        ) : (
          <>
            <Link href="/admin-oversikt">← Arrangementer</Link> · <a href="/admin">Payload-admin</a>
          </>
        )}
      </p>

      {melding && <p className="adm-melding">{melding}</p>}

      <header className="adm-topp">
        <span className="pille pille-info">{aktivitet.erGudstjeneste ? 'GUDSTJENESTE' : aktivitet.type === 'gruppesamling' ? 'SAMLING' : 'ARRANGEMENT'}</span>
        {aktivitet.avlyst && <span className="pille pille-nei">AVLYST</span>}
        {aktivitet.offentlig && <span className="pille pille-ok">VISES PÅ NETTSIDEN</span>}
        <h1>{aktivitet.tittel}</h1>
        <p className="adm-meta">
          {datoTidOslo(aktivitet.start)}
          {aktivitet.sted ? ` · ${aktivitet.sted}` : ''} · {gruppeIder.length} tjenestegruppe{gruppeIder.length === 1 ? '' : 'r'} involvert
        </p>
        {(aktivitet.tema || aktivitet.bibeltekst) && (
          <p className="adm-meta">
            {aktivitet.tema && <>Tema: {aktivitet.tema}</>}
            {aktivitet.tema && aktivitet.bibeltekst && ' · '}
            {aktivitet.bibeltekst && <>Tekst: {aktivitet.bibeltekst}</>}
          </p>
        )}
      </header>

      <div
        className={
          'adm-dekning ' +
          (aktive.length === 0 ? 'adm-dekning-ingen' : status?.klasse === 'tag-forfall' ? 'adm-dekning-forfall' : status?.klasse === 'tag-mangler' ? 'adm-dekning-mangler' : 'adm-dekning-ok')
        }
      >
        <div>
          <strong>
            {aktive.length === 0
              ? 'Ingen oppgaver ennå'
              : (status?.oppfolging ?? 0) > 0
                ? `${status?.oppfolging} oppgave${status?.oppfolging === 1 ? '' : 'r'} krever oppfølging (forfall/vikar)`
                : 'Fullt bemannet arrangement'}
          </strong>
          <br />
          <span>
            Total dekning: {dekkede} av {aktive.length} oppgaver dekket
            {erLeder && minGruppeInfo.length > 0 && <> • Min gruppe: {minGruppeDekket}/{minGruppeInfo.length}</>}
          </span>
        </div>
        <span className="adm-dekning-tall">
          {dekkede}/{aktive.length}
        </span>
      </div>

      {!erLeder && (
      <>
      <details className="adm-detaljer adm-stor">
        <summary>Rediger arrangement</summary>
        <form action={oppdaterArrangement} className="adm-skjema adm-rutenett">
          <input type="hidden" name="id" value={id} />
          <label className="adm-bred">
            Tittel *
            <input name="tittel" defaultValue={aktivitet.tittel} required />
          </label>
          <label>
            Dato *
            <input type="date" name="dato" defaultValue={dato} required />
          </label>
          <label>
            Tid
            <input type="time" name="tid" defaultValue={tid} />
          </label>
          <label className="adm-bred">
            Sted
            <input name="sted" defaultValue={aktivitet.sted ?? ''} />
          </label>
          <label>
            Tema
            <input name="tema" defaultValue={aktivitet.tema ?? ''} />
          </label>
          <label>
            Bibeltekst
            <input name="bibeltekst" defaultValue={aktivitet.bibeltekst ?? ''} />
          </label>
          <label className="adm-avkryss">
            <input type="checkbox" name="erGudstjeneste" defaultChecked={!!aktivitet.erGudstjeneste} /> Gudstjeneste
          </label>
          <label className="adm-avkryss">
            <input type="checkbox" name="offentlig" defaultChecked={!!aktivitet.offentlig} /> Vis på nettsiden
          </label>
          <label className="adm-avkryss">
            <input type="checkbox" name="avlyst" defaultChecked={!!aktivitet.avlyst} /> Avlyst
          </label>
          <button type="submit" className="adm-bred">
            Lagre endringer
          </button>
        </form>
      </details>

      <details className="adm-detaljer adm-stor">
        <summary>+ Ny oppgave / programpunkt</summary>
        <form action={opprettOppgave} className="adm-skjema adm-rutenett">
          <input type="hidden" name="aktivitetId" value={id} />
          <label className="adm-bred">
            Oppgave (rolle) *
            <input name="rolle" placeholder="f.eks. Lydtekniker" required />
          </label>
          <label>
            Tjenestegruppe *
            <select name="gruppeId" required defaultValue={relId(aktivitet.gruppe)}>
              {grupper.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.navn}
                </option>
              ))}
            </select>
          </label>
          <label>
            Antall personer
            <input type="number" name="antall" min={1} defaultValue={1} />
          </label>
          <label>
            Klokkeslett i programmet
            <input type="time" name="klokkeslett" />
          </label>
          <label>
            Programpunkt
            <input name="programtittel" placeholder="valgfritt, f.eks. Lydprøve" />
          </label>
          <label className="adm-bred">
            Beskrivelse
            <input name="beskrivelse" />
          </label>
          <label className="adm-bred">
            Instruks til den som får oppgaven
            <textarea name="instruksjon" rows={3} />
          </label>
          <button type="submit" className="adm-bred">
            Legg til oppgave
          </button>
          <p className="adm-hjelp adm-bred">Fyll ut både klokkeslett og programpunkt for at oppgaven også skal stå i programmet.</p>
        </form>
      </details>
      </>
      )}

      <div className="adm-faner">
        <Link href={lenke(undefined, valgtGruppe)} className={!visMangler && !visGruppe ? 'adm-fane aktiv' : 'adm-fane'}>
          Hele programmet ({rader.length + utenProgram.length})
        </Link>
        <Link href={lenke('mangler', valgtGruppe)} className={visMangler ? 'adm-fane aktiv' : 'adm-fane'}>
          Forfall / Mangler
          {(status?.oppfolging ?? 0) > 0 && <span className="adm-teller">{status?.oppfolging}</span>}
        </Link>
        {erLeder && (
          <Link href={lenke('gruppe', valgtGruppe)} className={visGruppe ? 'adm-fane aktiv' : 'adm-fane'}>
            Min gruppe ({minGruppeInfo.length})
          </Link>
        )}
      </div>
      {gruppeIder.length > 0 && (
        <div className="adm-filter">
          <span className="adm-etikett">GRUPPE:</span>
          <Link href={lenke(visning)} className={!valgtGruppe ? 'chip aktiv' : 'chip'}>
            Alle ({rader.length + utenProgram.length})
          </Link>
          {gruppeIder.map((g) => (
            <Link key={g} href={lenke(visning, g)} className={valgtGruppe === g ? 'chip aktiv' : 'chip'}>
              {gruppeNavn.get(g) ?? `Gruppe ${g}`} (
              {rader.filter((r) => relId(r.info?.oppgave.gruppe) === g).length +
                utenProgram.filter((o) => relId(o.gruppe) === g).length}
              )
            </Link>
          ))}
        </div>
      )}

      <div className="adm-seksjonsrad">
        <h2 className="adm-seksjon">Kjøreplan og «hvem gjør hva»</h2>
        <span className="adm-viser">
          Viser {synligeRader.length + synligeUtenProgram.length} av {rader.length + utenProgram.length} punkter
        </span>
      </div>
      {synligeRader.length === 0 && synligeUtenProgram.length === 0 && (
        <p className="adm-tom">
          {visMangler ? 'Ingen oppgaver med forfall eller som mangler folk.' : 'Ingen programpunkter eller oppgaver ennå. Legg til en over.'}
        </p>
      )}

      {synligeRader.map((r) => (
        <article
          key={r.nokkel}
          id={r.info ? `oppgave-${r.info.oppgave.id}` : undefined}
          className={r.info && !r.info.dekket ? 'adm-kort adm-kort-rod' : 'adm-kort'}
        >
          <div className="adm-kort-topp">
            <span className="adm-tid">{r.klokkeslett}</span>
            <div className="adm-kort-tittel">
              <strong>{r.tittel}</strong>
              {r.info && <span className="adm-rolle"> · {r.info.oppgave.tittel}</span>}
              {r.beskrivelse && <p>{r.beskrivelse}</p>}
            </div>
            {r.info && (
              <>
                <span className="pille pille-gruppe">{typeof r.info.oppgave.gruppe === 'object' ? r.info.oppgave.gruppe.navn : ''}</span>
                <span
                  className={r.info.dekket ? 'pille pille-ok' : r.info.bekreftet > 0 ? 'pille pille-venter' : 'pille pille-mangler'}
                  title={`${r.info.bekreftet} av ${r.info.behov} bekreftet`}
                >
                  {r.info.bekreftet}/{r.info.behov}
                </span>
              </>
            )}
          </div>
          {r.info ? <Oppgavelinje info={r.info} /> : <p className="adm-hjelp">Ingen oppgave knyttet til dette programpunktet.</p>}
        </article>
      ))}

      {synligeUtenProgram.length > 0 && <h3 className="adm-seksjon">Oppgaver som ikke står i programmet</h3>}
      {synligeUtenProgram.map((o) => {
        const info = oppgaveInfo.get(o.id)
        if (!info) return null
        return (
          <article key={o.id} id={`oppgave-${o.id}`} className={info.dekket ? 'adm-kort' : 'adm-kort adm-kort-rod'}>
            <div className="adm-kort-topp">
              <div className="adm-kort-tittel">
                <strong>{o.tittel}</strong>
                {o.beskrivelse && <p>{o.beskrivelse}</p>}
              </div>
              <span className="pille pille-gruppe">{typeof o.gruppe === 'object' ? o.gruppe.navn : ''}</span>
              <span
                className={info.dekket ? 'pille pille-ok' : info.bekreftet > 0 ? 'pille pille-venter' : 'pille pille-mangler'}
                title={`${info.bekreftet} av ${info.behov} bekreftet`}
              >
                {info.bekreftet}/{info.behov}
              </span>
            </div>
            <Oppgavelinje info={info} />
          </article>
        )
      })}
    </div>
  )
}
