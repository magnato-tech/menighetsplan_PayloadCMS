import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Payload } from 'payload'
import { bemanningForOppgave, erLederIGruppe, erMedlemIGruppe, relId } from '@/lib/bemanning'
import { datoTidOslo } from '@/lib/tid'
import { oppdaterBehov, oppdaterInstruks, tildelPerson, foresporPerson, fjernTildeling } from '@/lib/adminHandlinger'
import { lederTildel, lederForespor, lederFjern, lederOppdaterBehov, lederOppdaterInstruks } from '@/lib/lederHandlinger'
import { taOppgave, meldForfall, svarTildeling } from '@/lib/handlinger'
import PersonVelger from '@/components/admin/PersonVelger'
import type { User } from '@/payload-types'

type Props = {
  payload: Payload
  oppgaveId: number
  /** 'admin': alt. 'leder': redigerer egen gruppes oppgaver. 'medlem': ser det som angår en, og svarer for seg selv. */
  modus: 'admin' | 'leder' | 'medlem'
  /** Personen som ser kortet (leder eller medlem). */
  aktor?: User
  melding?: string
}

const chipKlasse: Record<string, string> = { confirmed: 'pille-ok', pending: 'pille-venter', withdrawn: 'pille-forfall', declined: 'pille-nei' }
const merkelapp: Record<string, string> = { confirmed: 'Bekreftet', pending: 'Forespurt', withdrawn: 'Forfall', declined: 'Avslått' }
const rekkefolge: Record<string, number> = { confirmed: 0, pending: 1, withdrawn: 2, declined: 3 }

/**
 * Oppgavekort: alt om én oppgave. Samling, tjenestegruppe, bemanningsbehov, instruks for rollen og hvem som er
 * forespurt, har akseptert, avslått eller meldt forfall. Samme data for alle; hva man kan se og endre avhenger av nivå.
 */
export default async function OppgaveKort({ payload, oppgaveId, modus, aktor, melding }: Props) {
  const oppgave = await payload.findByID({ collection: 'oppgaver', id: oppgaveId, depth: 1, overrideAccess: true }).catch(() => null)
  if (!oppgave) notFound()

  const aktivitet = typeof oppgave.aktivitet === 'object' ? oppgave.aktivitet : null
  const gruppeObj = typeof oppgave.gruppe === 'object' ? oppgave.gruppe : null
  const gruppe = gruppeObj ? await payload.findByID({ collection: 'grupper', id: gruppeObj.id, depth: 0, overrideAccess: true }) : null

  const { docs: tilds } = await payload.find({
    collection: 'tildelinger',
    where: { oppgave: { equals: oppgaveId } },
    depth: 1,
    limit: 200,
    overrideAccess: true,
  })
  const { docs: brukere } = await payload.find({ collection: 'users', sort: 'navn', limit: 200, depth: 0, overrideAccess: true })

  const b = bemanningForOppgave(oppgave, tilds)
  const erLeder = modus === 'leder' && !!aktor && !!gruppe && erLederIGruppe(gruppe, aktor.id)
  const kanRedigere = modus === 'admin' || erLeder
  const erMedlem = !!aktor && !!gruppe && erMedlemIGruppe(gruppe, aktor.id)

  const statusTekst = b.dekket ? 'Dekket' : b.forfall ? 'Forfall' : `Mangler: ${b.behov - b.bekreftet}`
  const statusKlasse = b.dekket ? 'pille-ok' : b.forfall ? 'pille-forfall' : 'pille-mangler'

  const sortert = [...tilds].sort((a, c) => (rekkefolge[a.svar ?? 'pending'] ?? 9) - (rekkefolge[c.svar ?? 'pending'] ?? 9))
  const opptatt = new Set(tilds.filter((t) => t.svar === 'pending' || t.svar === 'confirmed').map((t) => relId(t.person)))
  const kandidater = brukere.filter((u) => !opptatt.has(u.id) && (modus === 'admin' || (gruppe ? erMedlemIGruppe(gruppe, u.id) : false)))

  const meg = aktor ? tilds.find((t) => relId(t.person) === aktor.id && (t.svar === 'pending' || t.svar === 'confirmed')) : undefined
  const kanTa = !!aktor && erMedlem && !meg && b.ledigePlasser > 0 && oppgave.status !== 'cancelled'

  const side =
    modus === 'admin' ? `/admin-oversikt/oppgave/${oppgaveId}` : `/min-side/oppgave/${oppgaveId}`
  const tilbakeLenke =
    modus === 'admin'
      ? aktivitet ? `/admin-oversikt/arrangement/${aktivitet.id}` : '/admin-oversikt'
      : erLeder && aktivitet ? `/min-side/leder/arrangement/${aktivitet.id}?som=${aktor!.id}` : `/min-side?som=${aktor?.id ?? ''}`
  const arrangementLenke =
    modus === 'admin' && aktivitet
      ? `/admin-oversikt/arrangement/${aktivitet.id}`
      : erLeder && aktivitet
        ? `/min-side/leder/arrangement/${aktivitet.id}?som=${aktor!.id}`
        : null

  const tildelH = modus === 'admin' ? tildelPerson : lederTildel
  const foresporH = modus === 'admin' ? foresporPerson : lederForespor
  const fjernH = modus === 'admin' ? fjernTildeling : lederFjern
  const behovH = modus === 'admin' ? oppdaterBehov : lederOppdaterBehov
  const instruksH = modus === 'admin' ? oppdaterInstruks : lederOppdaterInstruks
  const ekstra: Record<string, string | number> = { returTil: side, ...(aktor && modus !== 'admin' ? { aktorId: aktor.id } : {}) }

  const skjulteFelt = (
    <>
      <input type="hidden" name="aktivitetId" value={aktivitet?.id ?? 0} />
      <input type="hidden" name="oppgaveId" value={oppgaveId} />
      <input type="hidden" name="returTil" value={side} />
      {modus !== 'admin' && aktor && <input type="hidden" name="aktorId" value={aktor.id} />}
    </>
  )

  return (
    <div className="side-innhold adm oppgavekort">
      <p className="adm-brodsmule">
        <Link href={tilbakeLenke}>← {aktivitet && modus !== 'medlem' ? aktivitet.tittel : 'Tilbake'}</Link>
      </p>
      {melding && <p className="adm-melding">{melding}</p>}

      <header className="adm-topp">
        <p className="adm-etikett">ID: oppgave-{oppgave.id}</p>
        <div className="oppgavekort-tittel">
          <h1>{oppgave.tittel}</h1>
          <span className={`pille ${statusKlasse}`}>{statusTekst}</span>
        </div>
        {oppgave.beskrivelse && <p className="adm-meta">{oppgave.beskrivelse}</p>}
      </header>

      <section className="adm-kort" aria-label="Samling">
        <p className="adm-etikett">SAMLING</p>
        {aktivitet ? (
          <>
            <p className="oppgavekort-stor">
              {arrangementLenke ? <Link href={arrangementLenke}>{aktivitet.tittel}</Link> : aktivitet.tittel}
            </p>
            <p className="adm-meta">{datoTidOslo(aktivitet.start)}</p>
            {aktivitet.sted && <p className="adm-meta">{aktivitet.sted}</p>}
          </>
        ) : (
          <p className="adm-tom">Ukjent arrangement</p>
        )}
      </section>

      <section className="adm-kort" aria-label="Gruppe">
        <p className="adm-etikett">GRUPPE</p>
        <p className="oppgavekort-stor">
          {gruppeObj?.navn ?? 'Ukjent gruppe'}{' '}
          {gruppeObj?.kategori && <span className="pille pille-gruppe">{gruppeObj.kategori}</span>}
        </p>
      </section>

      <section className="adm-kort" aria-label="Bemanningsbehov">
        <p className="adm-etikett">BEMANNINGSBEHOV</p>
        <p className="oppgavekort-stor">
          {b.behov} person{b.behov === 1 ? '' : 'er'}
          <span className="adm-behov"> · {b.bekreftet} bekreftet · {b.venter} forespurt</span>
        </p>
        {kanRedigere && (
          <form action={behovH} className="adm-skjema oppgavekort-behov">
            {skjulteFelt}
            <input type="number" name="antall" min={1} defaultValue={b.behov} aria-label="Antall personer" />
            <button type="submit">Oppdater behov</button>
          </form>
        )}
      </section>

      <section className="adm-kort" aria-label="Personstatus">
        <p className="adm-etikett">
          PERSONSTATUS FOR OPPGAVEN ({sortert.length}) · {b.bekreftet} bekreftet
        </p>
        {sortert.length === 0 && <p className="adm-tom">Ingen er forespurt eller tildelt ennå.</p>}
        {sortert.map((t) => {
          const p = typeof t.person === 'object' ? t.person : null
          const svar = t.svar ?? 'pending'
          const synlig = kanRedigere || svar === 'confirmed' || (aktor && relId(t.person) === aktor.id)
          if (!synlig) return null
          return (
            <div key={t.id} className="oppgavekort-person" data-svar={svar}>
              <div>
                <strong className={svar === 'declined' ? 'adm-strek' : undefined}>{p?.navn ?? 'Ukjent'}</strong>
                {kanRedigere && p && (
                  <p className="adm-hjelp">
                    {p.telefon ? `${p.telefon} · ` : ''}
                    {p.email}
                  </p>
                )}
              </div>
              <span className="oppgavekort-person-hoyre">
                <span className={`pille ${chipKlasse[svar]}`}>{merkelapp[svar]}</span>
                {kanRedigere && (
                  <form action={fjernH} className="adm-inline">
                    {skjulteFelt}
                    <input type="hidden" name="tildelingId" value={t.id} />
                    <button type="submit" className="adm-x" title="Fjern fra oppgaven" aria-label={`Fjern ${p?.navn ?? 'person'}`}>
                      ×
                    </button>
                  </form>
                )}
              </span>
            </div>
          )
        })}
        {!kanRedigere && (
          <p className="adm-hjelp">
            Du ser de som har bekreftet, og din egen status. Gruppeleder og admin ser også de som er forespurt, har avslått eller meldt forfall.
          </p>
        )}

        {kanRedigere && (
          <details className={b.dekket ? 'adm-detaljer' : 'adm-detaljer adm-grip'}>
            <summary>{b.dekket ? 'Tildel / forespør person' : 'Grip inn / Tildel'}</summary>
            <PersonVelger
              aktivitetId={aktivitet?.id ?? 0}
              oppgaveId={oppgaveId}
              personer={kandidater.map((u) => ({ id: u.id, navn: u.navn, epost: u.email }))}
              tildelAction={tildelH}
              foresporAction={foresporH}
              ekstraFelt={ekstra}
            />
          </details>
        )}
      </section>

      {modus === 'medlem' || (modus === 'leder' && !erLeder) ? (
        <section className="adm-kort" aria-label="Din status">
          <p className="adm-etikett">DIN STATUS</p>
          {meg?.svar === 'pending' && (
            <form action={svarTildeling} className="adm-skjema">
              <p>Du er forespurt til denne oppgaven.</p>
              <input type="hidden" name="tildelingId" value={meg.id} />
              <input type="hidden" name="personId" value={aktor!.id} />
              <span className="oppgavekort-knapper">
                <button type="submit" name="status" value="confirmed">
                  Ja, jeg tar den
                </button>
                <button type="submit" name="status" value="declined" className="adm-fareknapp">
                  Nei
                </button>
              </span>
            </form>
          )}
          {meg?.svar === 'confirmed' && (
            <form action={meldForfall} className="adm-skjema">
              <p>Du har tatt denne oppgaven.</p>
              <input type="hidden" name="tildelingId" value={meg.id} />
              <button type="submit" className="adm-fareknapp">
                Meld forfall
              </button>
            </form>
          )}
          {!meg && kanTa && (
            <form action={taOppgave} className="adm-skjema">
              <p>Oppgaven mangler folk, og du er med i tjenestegruppen.</p>
              <input type="hidden" name="oppgaveId" value={oppgaveId} />
              <input type="hidden" name="personId" value={aktor!.id} />
              <button type="submit">Ta oppgave</button>
            </form>
          )}
          {!meg && !kanTa && <p className="adm-tom">Ingen handling nødvendig fra deg.</p>}
        </section>
      ) : null}

      <section className="adm-kort" aria-label="Instruks for rollen">
        <p className="adm-etikett">INSTRUKS FOR ROLLEN</p>
        <p className="adm-hjelp">Instruksen beskriver hva den som har rollen skal gjøre. Den hører til oppgaven og deles med alle som ser eller er tildelt den.</p>
        {kanRedigere ? (
          <form action={instruksH} className="adm-skjema">
            {skjulteFelt}
            <label>
              Rediger instruks
              <textarea name="instruksjon" rows={5} defaultValue={oppgave.instruksjon ?? ''} />
            </label>
            <button type="submit">Lagre instruks</button>
          </form>
        ) : (
          <p className="adm-instruks">{oppgave.instruksjon || 'Ingen instruks lagt inn ennå.'}</p>
        )}
      </section>
    </div>
  )
}
