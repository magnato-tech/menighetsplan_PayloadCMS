/**
 * Flyt-tester: bruker → gruppeleder → admin.
 *
 * Kjører de ekte server-handlingene (Tildel, Forespør, Ta oppgave, Meld forfall, gruppelederens handlinger)
 * mot en egen, ny database (SQLite-fil), og sjekker at alle tre roller ser det samme etterpå.
 * Går også gjennom Payloads databaselag, så feil i hvordan oppgaver, tildelinger og relasjoner er satt opp avsløres.
 *
 * Next-spesifikke moduler (cache, redirect) og admin-innloggingen er byttet ut med enkle stand-ins.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import type { Grupper, Oppgaver, Tildelinger, User } from '@/payload-types'

const DB_FIL = path.resolve(process.cwd(), 'data', 'test-flyt.db')
process.env.SQLITE_URL = `file:${DB_FIL.replace(/\\/g, '/')}`
process.env.DATABASE_URL = ''
fs.mkdirSync(path.dirname(DB_FIL), { recursive: true })
for (const ende of ['', '-shm', '-wal', '-journal']) fs.rmSync(DB_FIL + ende, { force: true })

let erAdmin = true
let payload: Payload

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
}))
vi.mock('@/lib/adminAuth', () => ({
  relId: (rel: unknown) =>
    typeof rel === 'object' && rel !== null && 'id' in rel ? (rel as { id: number }).id : typeof rel === 'number' ? rel : undefined,
  hentAdmin: async () => (erAdmin ? { payload, user: { id: 1, globalRolle: 'admin', collection: 'users' } } : null),
}))

function skjema(felt: Record<string, string | number>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(felt)) fd.set(k, String(v))
  return fd
}

/** Kjør en handling. Handlingene avslutter med redirect, som her fanges opp og gir meldingen tilbake. */
async function kjor(handling: (fd: FormData) => Promise<void>, felt: Record<string, string | number>) {
  try {
    await handling(skjema(felt))
    return { melding: '', feil: undefined as string | undefined }
  } catch (e) {
    const tekst = e instanceof Error ? e.message : String(e)
    if (tekst.startsWith('NEXT_REDIRECT:')) {
      const url = tekst.slice('NEXT_REDIRECT:'.length)
      const melding = new URL(url, 'http://x').searchParams.get('melding') ?? ''
      return { melding, feil: undefined as string | undefined }
    }
    return { melding: '', feil: tekst }
  }
}

// ---- data ----
let kari: User, ola: User, ingrid: User, jonas: User, per: User
let lyd: Grupper, kaffe: Grupper
let aktivitetId: number
let oppgA: Oppgaver, oppgB: Oppgaver, oppgC: Oppgaver
const mediaIder: number[] = []

type Mod = {
  taOppgave: (fd: FormData) => Promise<void>
  meldForfall: (fd: FormData) => Promise<void>
  svarTildeling: (fd: FormData) => Promise<void>
}
type Admin = {
  tildelPerson: (fd: FormData) => Promise<void>
  foresporPerson: (fd: FormData) => Promise<void>
  fjernTildeling: (fd: FormData) => Promise<void>
  opprettOppgave: (fd: FormData) => Promise<void>
  slettOppgave: (fd: FormData) => Promise<void>
  oppdaterOppgave: (fd: FormData) => Promise<void>
  oppdaterBehov: (fd: FormData) => Promise<void>
  oppdaterInstruks: (fd: FormData) => Promise<void>
}
type Leder = {
  lederTildel: (fd: FormData) => Promise<void>
  lederForespor: (fd: FormData) => Promise<void>
  lederFjern: (fd: FormData) => Promise<void>
  lederOppdaterBehov: (fd: FormData) => Promise<void>
  lederOppdaterInstruks: (fd: FormData) => Promise<void>
}
type Bem = typeof import('@/lib/bemanning')
type Dek = typeof import('@/lib/dekning')

let medlem: Mod
let admin: Admin
let leder: Leder
let B: Bem
let D: Dek

async function hent() {
  const { docs: oppgaver } = await payload.find({ collection: 'oppgaver', limit: 500, depth: 0, overrideAccess: true })
  const { docs: tildelinger } = await payload.find({ collection: 'tildelinger', limit: 500, depth: 0, overrideAccess: true })
  const { docs: grupper } = await payload.find({ collection: 'grupper', limit: 100, depth: 0, overrideAccess: true })
  return { oppgaver, tildelinger, grupper }
}

beforeAll(async () => {
  const { getPayload } = await import('payload')
  const config = (await import('@/payload.config')).default
  payload = await getPayload({ config: await config })
  medlem = (await import('@/lib/handlinger')) as unknown as Mod
  admin = (await import('@/lib/adminHandlinger')) as unknown as Admin
  leder = (await import('@/lib/lederHandlinger')) as unknown as Leder
  B = await import('@/lib/bemanning')
  D = await import('@/lib/dekning')

  const lagBruker = (navn: string, epost: string, rolle: 'admin' | 'member') =>
    payload.create({
      collection: 'users',
      data: { navn, email: epost, password: 'test-passord-12345', globalRolle: rolle },
      overrideAccess: true,
    }) as Promise<User>
  kari = await lagBruker('Kari Test', 'kari@flyt.test', 'admin')
  ola = await lagBruker('Ola Test', 'ola@flyt.test', 'member')
  ingrid = await lagBruker('Ingrid Test', 'ingrid@flyt.test', 'member')
  jonas = await lagBruker('Jonas Test', 'jonas@flyt.test', 'member')
  per = await lagBruker('Per Utenfor', 'per@flyt.test', 'member')

  lyd = (await payload.create({
    collection: 'grupper',
    data: { navn: 'Lyd og bilde', kategori: 'tjenestegruppe', ledere: [ola.id], medlemmer: [ingrid.id, jonas.id] },
    overrideAccess: true,
  })) as Grupper
  kaffe = (await payload.create({
    collection: 'grupper',
    data: { navn: 'Kirkekaffe', kategori: 'tjenestegruppe', ledere: [kari.id], medlemmer: [per.id] },
    overrideAccess: true,
  })) as Grupper

  const png = Buffer.from(
    '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000a49444154789c6360000002000155e3fe15000000004945' + '4e44ae426082',
    'hex',
  )
  const bilde = (await payload.create({
    collection: 'media',
    data: { alt: 'FLYT_testbilde' },
    file: { data: png, mimetype: 'image/png', name: 'flyt-test.png', size: png.length },
    overrideAccess: true,
  })) as { id: number }
  mediaIder.push(bilde.id)

  const akt = await payload.create({
    collection: 'aktiviteter',
    data: { gruppe: kaffe.id, tittel: 'Flyt-gudstjeneste', bilde: bilde.id, start: '2026-11-01T10:00:00.000Z', offentlig: true, erGudstjeneste: true },
    overrideAccess: true,
  })
  aktivitetId = akt.id

  const lagOppgave = (tittel: string, gruppe: number, behov: number) =>
    payload.create({
      collection: 'oppgaver',
      data: { aktivitet: aktivitetId, gruppe, tittel, antallTrengs: behov, status: 'open' },
      overrideAccess: true,
    }) as Promise<Oppgaver>
  oppgA = await lagOppgave('Lydtekniker', lyd.id, 1)
  oppgB = await lagOppgave('Kamera', lyd.id, 2)
  oppgC = await lagOppgave('Kaffevert', kaffe.id, 1)
}, 120000)

afterAll(async () => {
  for (const id of mediaIder) await payload.delete({ collection: 'media', id, overrideAccess: true }).catch(() => {})
  // Windows kan holde filen låst mens databasen er åpen; opprydning er best mulig (data/ er ikke i git).
  for (const ende of ['', '-shm', '-wal', '-journal']) {
    try {
      fs.rmSync(DB_FIL + ende, { force: true })
    } catch {}
  }
})

const rad = (o: Oppgaver, t: Tildelinger[]) => B.bemanningForOppgave(o, t)
const ref = (oppgaver: Oppgaver[], id: number) => oppgaver.find((o) => o.id === id)!

describe('Databaseoppsett for oppgaver', () => {
  it('oppgave, tildeling og gruppe henger sammen via relasjoner', async () => {
    const o = await payload.findByID({ collection: 'oppgaver', id: oppgB.id, depth: 1, overrideAccess: true })
    expect(typeof o.gruppe === 'object' && o.gruppe.navn).toBe('Lyd og bilde')
    expect(typeof o.aktivitet === 'object' && o.aktivitet.tittel).toBe('Flyt-gudstjeneste')
    expect(o.antallTrengs).toBe(2)
  })

  it('en tildeling kan ikke peke på en oppgave eller person som ikke finnes', async () => {
    await expect(
      payload.create({ collection: 'tildelinger', data: { oppgave: 999999, person: ingrid.id, svar: 'pending' }, overrideAccess: true }),
    ).rejects.toThrow()
    await expect(
      payload.create({ collection: 'tildelinger', data: { oppgave: oppgA.id, person: 999999, svar: 'pending' }, overrideAccess: true }),
    ).rejects.toThrow()
  })

  it('en oppgave må ha aktivitet, gruppe og tittel', async () => {
    await expect(
      payload.create({ collection: 'oppgaver', data: { gruppe: lyd.id, tittel: 'Uten aktivitet' } as never, overrideAccess: true }),
    ).rejects.toThrow()
    await expect(
      payload.create({ collection: 'oppgaver', data: { aktivitet: aktivitetId, tittel: 'Uten gruppe' } as never, overrideAccess: true }),
    ).rejects.toThrow()
  })

  it('gruppens medlemmer og ledere lagres som relasjoner til personer', async () => {
    const g = await payload.findByID({ collection: 'grupper', id: lyd.id, depth: 1, overrideAccess: true })
    expect((g.ledere as User[]).map((p) => p.navn)).toEqual(['Ola Test'])
    expect((g.medlemmer as User[]).map((p) => p.navn).sort()).toEqual(['Ingrid Test', 'Jonas Test'])
  })
})

describe('Admin tildeler → personen, gruppeleder og admin ser det samme', () => {
  it('Tildel (avtalt muntlig): personen står som bekreftet med en gang', async () => {
    const r = await kjor(admin.tildelPerson, { aktivitetId, oppgaveId: oppgA.id, personId: ingrid.id })
    expect(r.melding).toContain('bekreftet')

    const { oppgaver, tildelinger } = await hent()
    // personsiden: oppgaven vises under «Mine oppgaver»
    const mine = B.oppgaverForPerson(ingrid.id, oppgaver, tildelinger)
    expect(mine.bekreftet.map((x) => x.oppgave.id)).toContain(oppgA.id)
    expect(mine.venterPaSvar).toHaveLength(0)
    // oppgavens lagrede status og bemanning
    expect(ref(oppgaver, oppgA.id).status).toBe('confirmed')
    expect(rad(oppgA, tildelinger).dekket).toBe(true)
    // gruppelederen har ingenting å følge opp på denne oppgaven
    const oppf = B.oppfolgingForGrupper([lyd.id], oppgaver, tildelinger).map((b) => b.oppgave.id)
    expect(oppf).not.toContain(oppgA.id)
    // ingen kan ta den (fullt bemannet)
    const ledige = B.ledigeOppgaverForPerson(jonas.id, [lyd, kaffe] as Grupper[], oppgaver, tildelinger).map((o) => o.id)
    expect(ledige).not.toContain(oppgA.id)
  })

  it('Forespør: personen ser «venter på svar», og plassen er holdt av', async () => {
    const r = await kjor(admin.foresporPerson, { aktivitetId, oppgaveId: oppgB.id, personId: jonas.id })
    expect(r.melding).toContain('Forespørselen er sendt')

    const { oppgaver, tildelinger, grupper } = await hent()
    const mine = B.oppgaverForPerson(jonas.id, oppgaver, tildelinger)
    expect(mine.venterPaSvar.map((x) => x.oppgave.id)).toContain(oppgB.id)
    expect(mine.bekreftet.map((x) => x.oppgave.id)).not.toContain(oppgB.id)
    expect(ref(oppgaver, oppgB.id).status).toBe('assigned')
    // bemanning: behov 2, ingen bekreftet, én venter → én ledig plass igjen
    const b = rad(oppgB, tildelinger)
    expect(b).toMatchObject({ bekreftet: 0, venter: 1, behov: 2, ledigePlasser: 1, dekket: false })
    // Jonas kan ikke ta den en gang til; Ingrid kan ta den siste plassen
    expect(B.ledigeOppgaverForPerson(jonas.id, grupper, oppgaver, tildelinger).map((o) => o.id)).not.toContain(oppgB.id)
    expect(B.ledigeOppgaverForPerson(ingrid.id, grupper, oppgaver, tildelinger).map((o) => o.id)).toContain(oppgB.id)
  })

  it('«Venter på svar» telles ikke som dekket for gruppeleder og admin', async () => {
    const { oppgaver, tildelinger } = await hent()
    const oppf = B.oppfolgingForGrupper([lyd.id], oppgaver, tildelinger)
    expect(oppf.map((b) => b.oppgave.id)).toContain(oppgB.id)
    const dekning = D.beregnDekning(oppgaver.filter((o) => o.aktivitet === aktivitetId), tildelinger)
    expect(dekning?.klasse).toBe('tag-mangler')
    expect(dekning?.dekkede).toBe(1) // bare A er dekket
  })

  it('Personen svarer ja: bekreftet hos både gruppeleder og admin', async () => {
    const { tildelinger: for_ } = await hent()
    const t = for_.find((x) => x.oppgave === oppgB.id && x.person === jonas.id)!
    const r = await kjor(medlem.svarTildeling as never, { tildelingId: t.id, personId: jonas.id, status: 'confirmed' })
    expect(r.feil).toBeUndefined()

    const { oppgaver, tildelinger } = await hent()
    expect(B.oppgaverForPerson(jonas.id, oppgaver, tildelinger).bekreftet.map((x) => x.oppgave.id)).toContain(oppgB.id)
    const b = rad(oppgB, tildelinger)
    expect(b).toMatchObject({ bekreftet: 1, venter: 0, ledigePlasser: 1 })
    // fortsatt 1 av 2: gruppeleder skal fortsatt se at den mangler
    expect(B.oppfolgingForGrupper([lyd.id], oppgaver, tildelinger).map((x) => x.oppgave.id)).toContain(oppgB.id)
  })

  it('Bare personen forespørselen gjelder kan svare på den', async () => {
    await kjor(admin.foresporPerson, { aktivitetId, oppgaveId: oppgB.id, personId: ingrid.id })
    const { tildelinger } = await hent()
    const t = tildelinger.find((x) => x.oppgave === oppgB.id && x.person === ingrid.id)!
    // Jonas prøver å svare på Ingrids forespørsel
    await kjor(medlem.svarTildeling as never, { tildelingId: t.id, personId: jonas.id, status: 'confirmed' })
    const etter = (await hent()).tildelinger.find((x) => x.id === t.id)!
    expect(etter.svar).toBe('pending')
    // Ingrid avslår selv → plassen er ledig igjen
    await kjor(medlem.svarTildeling as never, { tildelingId: t.id, personId: ingrid.id, status: 'declined' })
    const { oppgaver, tildelinger: nye } = await hent()
    expect(nye.find((x) => x.id === t.id)!.svar).toBe('declined')
    expect(rad(oppgB, nye).ledigePlasser).toBe(1)
    expect(ref(oppgaver, oppgB.id).status).toBe('open')
  })
})

describe('Medlem tar oppgave → gruppeleder og admin ser at den er tatt', () => {
  it('Ta oppgave på siste ledige plass: oppgaven blir fullt bemannet', async () => {
    const r = await kjor(medlem.taOppgave, { oppgaveId: oppgB.id, personId: ingrid.id })
    expect(r.feil).toBeUndefined()

    const { oppgaver, tildelinger, grupper } = await hent()
    const b = rad(oppgB, tildelinger)
    expect(b).toMatchObject({ bekreftet: 2, dekket: true, ledigePlasser: 0 })
    expect(ref(oppgaver, oppgB.id).status).toBe('confirmed')
    // gruppeleder: ingenting å følge opp lenger
    expect(B.oppfolgingForGrupper([lyd.id], oppgaver, tildelinger)).toHaveLength(0)
    // admin: hele arrangementet i lyd-gruppen er dekket
    expect(D.beregnDekning(oppgaver.filter((o) => o.gruppe === lyd.id), tildelinger)?.label).toBe('Dekket')
    // ingen i gruppen ser lenger ledige oppgaver
    expect(B.ledigeOppgaverForPerson(jonas.id, grupper, oppgaver, tildelinger)).toHaveLength(0)
  })

  it('Ingen kan ta mer enn bemanningsbehovet (ingen overbooking)', async () => {
    const r = await kjor(admin.tildelPerson, { aktivitetId, oppgaveId: oppgA.id, personId: jonas.id })
    expect(r.melding).toContain('ingen ledige plasser')
    const { tildelinger } = await hent()
    expect(rad(oppgA, tildelinger).bekreftet).toBe(1)
  })

  it('Samme person kan ikke legges på samme oppgave to ganger', async () => {
    const r = await kjor(admin.tildelPerson, { aktivitetId, oppgaveId: oppgA.id, personId: ingrid.id })
    expect(r.melding).toContain('allerede bekreftet')
    const { tildelinger } = await hent()
    expect(tildelinger.filter((t) => t.oppgave === oppgA.id && t.person === ingrid.id)).toHaveLength(1)
  })

  it('Den som ikke er med i tjenestegruppen kan ikke ta oppgaven', async () => {
    // Ingrid melder forfall på A slik at plassen er ledig
    await kjor(medlem.meldForfall as never, {
      tildelingId: (await hent()).tildelinger.find((t) => t.oppgave === oppgA.id && t.person === ingrid.id)!.id,
    })
    const før = (await hent()).tildelinger.length
    await kjor(medlem.taOppgave, { oppgaveId: oppgA.id, personId: per.id })
    const { tildelinger } = await hent()
    expect(tildelinger.length).toBe(før)
    expect(tildelinger.some((t) => t.person === per.id && t.oppgave === oppgA.id)).toBe(false)
  })
})

describe('Forfall: synlig for gruppe, gruppeleder og admin', () => {
  it('Etter forfall er oppgaven ledig for alle i tjenestegruppen, men ikke for utenforstående', async () => {
    const { oppgaver, tildelinger, grupper } = await hent()
    expect(ref(oppgaver, oppgA.id).status).toBe('vacant')
    expect(B.ledigeOppgaverForPerson(jonas.id, grupper, oppgaver, tildelinger).map((o) => o.id)).toContain(oppgA.id)
    expect(B.ledigeOppgaverForPerson(ingrid.id, grupper, oppgaver, tildelinger).map((o) => o.id)).toContain(oppgA.id) // hun kan ta den igjen
    expect(B.ledigeOppgaverForPerson(ola.id, grupper, oppgaver, tildelinger).map((o) => o.id)).toContain(oppgA.id) // leder er også med i gruppen
    expect(B.ledigeOppgaverForPerson(per.id, grupper, oppgaver, tildelinger).map((o) => o.id)).not.toContain(oppgA.id)
  })

  it('Gruppeleder ser forfallet som oppfølging, og admin ser Forfall på arrangementet', async () => {
    const { oppgaver, tildelinger } = await hent()
    const oppf = B.oppfolgingForGrupper([lyd.id], oppgaver, tildelinger)
    expect(oppf.map((b) => b.oppgave.id)).toEqual([oppgA.id])
    expect(oppf[0].forfall).toBe(true)
    // leder av en annen gruppe ser det ikke
    expect(B.oppfolgingForGrupper([kaffe.id], oppgaver, tildelinger).map((b) => b.oppgave.id)).not.toContain(oppgA.id)
    const dekning = D.beregnDekning(oppgaver.filter((o) => o.aktivitet === aktivitetId), tildelinger)
    expect(dekning?.label).toBe('Forfall')
    expect(dekning?.oppfolging).toBeGreaterThanOrEqual(1)
  })

  it('Personen som meldte forfall står ikke lenger som bekreftet', async () => {
    const { oppgaver, tildelinger } = await hent()
    expect(B.oppgaverForPerson(ingrid.id, oppgaver, tildelinger).bekreftet.map((x) => x.oppgave.id)).not.toContain(oppgA.id)
    expect(tildelinger.find((t) => t.oppgave === oppgA.id && t.person === ingrid.id)?.svar).toBe('withdrawn')
  })

  it('Et annet gruppemedlem tar over → forfallet er løst for leder og admin', async () => {
    await kjor(medlem.taOppgave, { oppgaveId: oppgA.id, personId: jonas.id })
    const { oppgaver, tildelinger } = await hent()
    expect(ref(oppgaver, oppgA.id).status).toBe('confirmed')
    expect(B.oppfolgingForGrupper([lyd.id], oppgaver, tildelinger)).toHaveLength(0)
    expect(B.oppgaverForPerson(jonas.id, oppgaver, tildelinger).bekreftet.map((x) => x.oppgave.id)).toContain(oppgA.id)
    expect(D.beregnDekning(oppgaver.filter((o) => o.gruppe === lyd.id), tildelinger)?.label).toBe('Dekket')
  })
})

describe('Gruppeleder griper inn på egen gruppe', () => {
  it('Leder forespør et gruppemedlem på en oppgave som mangler folk', async () => {
    // Jonas melder forfall så oppgaven mangler igjen
    const t = (await hent()).tildelinger.find((x) => x.oppgave === oppgA.id && x.person === jonas.id && x.svar === 'confirmed')!
    await kjor(medlem.meldForfall as never, { tildelingId: t.id })

    const r = await kjor(leder.lederForespor, { aktorId: ola.id, aktivitetId, oppgaveId: oppgA.id, personId: ingrid.id })
    expect(r.melding).toContain('Forespørselen er sendt')
    const { oppgaver, tildelinger } = await hent()
    expect(B.oppgaverForPerson(ingrid.id, oppgaver, tildelinger).venterPaSvar.map((x) => x.oppgave.id)).toContain(oppgA.id)
    expect(ref(oppgaver, oppgA.id).status).toBe('assigned')
  })

  it('Leder tildeler direkte (avtalt muntlig), og admin ser at oppgaven er dekket', async () => {
    const { tildelinger: t0 } = await hent()
    const venter = t0.find((x) => x.oppgave === oppgA.id && x.person === ingrid.id && x.svar === 'pending')!
    await kjor(leder.lederFjern, { aktorId: ola.id, aktivitetId, oppgaveId: oppgA.id, tildelingId: venter.id })
    const r = await kjor(leder.lederTildel, { aktorId: ola.id, aktivitetId, oppgaveId: oppgA.id, personId: jonas.id })
    expect(r.melding).toContain('bekreftet')
    const { oppgaver, tildelinger } = await hent()
    expect(ref(oppgaver, oppgA.id).status).toBe('confirmed')
    expect(D.beregnDekning(oppgaver.filter((o) => o.gruppe === lyd.id), tildelinger)?.label).toBe('Dekket')
  })

  it('Leder kan bare tildele personer som er med i tjenestegruppen', async () => {
    const før = (await hent()).tildelinger.length
    const r = await kjor(leder.lederTildel, { aktorId: ola.id, aktivitetId, oppgaveId: oppgC.id, personId: per.id })
    expect(r.melding).toContain('Bare leder eller nestleder i gruppen')
    // riktig leder (Ola leder Lyd og bilde), men personen er ikke med i gruppen
    const r2 = await kjor(leder.lederTildel, { aktorId: ola.id, aktivitetId, oppgaveId: oppgA.id, personId: per.id })
    expect(r2.melding).toContain('ikke med i tjenestegruppen')
    expect((await hent()).tildelinger.length).toBe(før)
  })

  it('Et vanlig medlem kan ikke bruke gruppeleder-handlingene', async () => {
    const før = (await hent()).tildelinger.length
    const r = await kjor(leder.lederTildel, { aktorId: ingrid.id, aktivitetId, oppgaveId: oppgB.id, personId: jonas.id })
    expect(r.melding).toContain('Bare leder eller nestleder')
    expect((await hent()).tildelinger.length).toBe(før)
  })

  it('Leder av en annen gruppe kan ikke endre denne gruppens oppgaver', async () => {
    const { tildelinger } = await hent()
    const t = tildelinger.find((x) => x.oppgave === oppgA.id && x.svar === 'confirmed')!
    const r = await kjor(leder.lederFjern, { aktorId: kari.id, aktivitetId, oppgaveId: oppgA.id, tildelingId: t.id })
    expect(r.melding).toContain('Bare leder eller nestleder')
    expect((await hent()).tildelinger.some((x) => x.id === t.id)).toBe(true)
  })
})

describe('Admin-handlinger krever admin-innlogging', () => {
  it('uten admin avvises alle endringer', async () => {
    erAdmin = false
    try {
      const før = (await hent()).tildelinger.length
      const r = await kjor(admin.tildelPerson, { aktivitetId, oppgaveId: oppgC.id, personId: per.id })
      expect(r.feil).toContain('admin')
      const r2 = await kjor(admin.slettOppgave, { aktivitetId, oppgaveId: oppgC.id })
      expect(r2.feil).toContain('admin')
      expect((await hent()).tildelinger.length).toBe(før)
      expect((await hent()).oppgaver.some((o) => o.id === oppgC.id)).toBe(true)
    } finally {
      erAdmin = true
    }
  })
})

describe('Admin redigerer oppgave og bemanning', () => {
  it('Øker bemanningsbehov: oppgaven blir åpen igjen for gruppen', async () => {
    const r = await kjor(admin.oppdaterOppgave, { aktivitetId, oppgaveId: oppgA.id, rolle: 'Lydtekniker', gruppeId: lyd.id, antall: 2, instruksjon: 'Møt kl. 9' })
    expect(r.melding).toContain('oppdatert')
    const { oppgaver, tildelinger, grupper } = await hent()
    expect(ref(oppgaver, oppgA.id)).toMatchObject({ antallTrengs: 2, status: 'open', instruksjon: 'Møt kl. 9' })
    expect(B.ledigeOppgaverForPerson(ingrid.id, grupper, oppgaver, tildelinger).map((o) => o.id)).toContain(oppgA.id)
  })

  it('Ny oppgave med programpunkt havner i arrangementets program', async () => {
    await kjor(admin.opprettOppgave, {
      aktivitetId, rolle: 'Mikrofon', gruppeId: lyd.id, antall: 1, klokkeslett: '10:30', programtittel: 'Lydprøve', beskrivelse: 'Sjekk mikrofoner',
    })
    const akt = await payload.findByID({ collection: 'aktiviteter', id: aktivitetId, depth: 1, overrideAccess: true })
    const punkt = akt.program?.find((p) => p.tittel === 'Lydprøve')
    expect(punkt?.klokkeslett).toBe('10:30')
    expect(typeof punkt?.oppgave === 'object' && punkt.oppgave?.tittel).toBe('Mikrofon')
  })

  it('Sletter oppgave: tildelinger og programpunkt forsvinner med den', async () => {
    const { oppgaver } = await hent()
    const mikrofon = oppgaver.find((o) => o.tittel === 'Mikrofon')!
    await kjor(admin.tildelPerson, { aktivitetId, oppgaveId: mikrofon.id, personId: ingrid.id })
    await kjor(admin.slettOppgave, { aktivitetId, oppgaveId: mikrofon.id })
    const etter = await hent()
    expect(etter.oppgaver.some((o) => o.id === mikrofon.id)).toBe(false)
    expect(etter.tildelinger.some((t) => t.oppgave === mikrofon.id)).toBe(false)
    const akt = await payload.findByID({ collection: 'aktiviteter', id: aktivitetId, depth: 0, overrideAccess: true })
    expect(akt.program?.some((p) => p.tittel === 'Lydprøve')).toBeFalsy()
  })
})

describe('Oppgavekortet viser hvem som har gjort hva, for admin og gruppeleder', () => {
  let oppgD: Oppgaver

  /** Henter HTML for arrangementsskjermen slik admin eller gruppeleder får den. */
  async function skjerm(modus: 'admin' | 'leder', aktor?: User) {
    const { renderToStaticMarkup } = await import('react-dom/server')
    const komp = (await import('@/components/admin/ArrangementSkjerm')).default
    const jsx = await komp({ payload, id: aktivitetId, modus, aktor })
    return renderToStaticMarkup(jsx)
  }

  /** Utdraget av kortet for én oppgave. */
  function kort(html: string, tittel: string) {
    const deler = html.split('<article')
    return deler.find((d) => d.includes(`>${tittel}</strong>`) || d.includes(`· ${tittel}</span>`)) ?? ''
  }

  /** Chipen (personen med status) i et kort. */
  function chip(k: string, navn: string) {
    const deler = k.split('<span class="pille ')
    return deler.find((d) => d.includes(`>${navn}</span>`)) ?? ''
  }

  beforeAll(async () => {
    // Samme situasjon som i skjermbildet: Ola bekreftet, Kari forfall, Ingrid avslått, Jonas forespurt.
    oppgD = (await payload.create({
      collection: 'oppgaver',
      data: { aktivitet: aktivitetId, gruppe: lyd.id, tittel: 'Kaffe-ansvarlig', antallTrengs: 2, status: 'open' },
      overrideAccess: true,
    })) as Oppgaver
    const medlemTildel = (p: User) => kjor(admin.tildelPerson, { aktivitetId, oppgaveId: oppgD.id, personId: p.id })
    await medlemTildel(ola)
    await medlemTildel(kari)
    const kariT = (await hent()).tildelinger.find((t) => t.oppgave === oppgD.id && t.person === kari.id)!
    await kjor(medlem.meldForfall as never, { tildelingId: kariT.id })
    await kjor(admin.foresporPerson, { aktivitetId, oppgaveId: oppgD.id, personId: ingrid.id })
    const ingridT = (await hent()).tildelinger.find((t) => t.oppgave === oppgD.id && t.person === ingrid.id)!
    await kjor(medlem.svarTildeling as never, { tildelingId: ingridT.id, personId: ingrid.id, status: 'declined' })
    await kjor(admin.foresporPerson, { aktivitetId, oppgaveId: oppgD.id, personId: jonas.id })
  })

  it('databasen har de fire statusene på samme oppgave', async () => {
    const { tildelinger } = await hent()
    const svar = (p: User) => tildelinger.find((t) => t.oppgave === oppgD.id && t.person === p.id)?.svar
    expect(svar(ola)).toBe('confirmed')
    expect(svar(kari)).toBe('withdrawn')
    expect(svar(ingrid)).toBe('declined')
    expect(svar(jonas)).toBe('pending')
  })

  it('admin: hver person vises med riktig status på oppgavekortet', async () => {
    const k = kort(await skjerm('admin'), 'Kaffe-ansvarlig')
    expect(k).not.toBe('')
    expect(chip(k, 'Ola Test')).toContain('data-svar="confirmed"')
    expect(chip(k, 'Ola Test')).not.toContain('adm-merke')
    expect(chip(k, 'Kari Test')).toContain('data-svar="withdrawn"')
    expect(chip(k, 'Kari Test')).toContain('>Forfall<')
    expect(chip(k, 'Ingrid Test')).toContain('data-svar="declined"')
    expect(chip(k, 'Ingrid Test')).toContain('>Avslått<')
    expect(chip(k, 'Ingrid Test')).toContain('adm-strek')
    expect(chip(k, 'Jonas Test')).toContain('data-svar="pending"')
    expect(chip(k, 'Jonas Test')).toContain('>Forespurt<')
  })

  it('admin: oppgaven vises som uferdig med bemanning 1/2 og «Grip inn / Tildel»', async () => {
    const html = await skjerm('admin')
    const k = kort(html, 'Kaffe-ansvarlig')
    expect(k).toContain('>1/2<')
    expect(k).toContain('Grip inn / Tildel')
    expect(k).toContain('adm-kort-rod')
    expect(html).toContain('krever oppfølging')
  })

  it('gruppeleder: ser de samme statusene på oppgaver i egen gruppe, og kan gripe inn', async () => {
    const html = await skjerm('leder', ola)
    const k = kort(html, 'Kaffe-ansvarlig')
    expect(chip(k, 'Kari Test')).toContain('>Forfall<')
    expect(chip(k, 'Ingrid Test')).toContain('>Avslått<')
    expect(chip(k, 'Jonas Test')).toContain('>Forespurt<')
    expect(chip(k, 'Ola Test')).toContain('data-svar="confirmed"')
    expect(k).toContain('Grip inn / Tildel')
    // lederen får ikke redigere eller slette oppgaver, og ikke endre arrangementet
    expect(k).not.toContain('Ja, slett oppgaven')
    expect(html).not.toContain('Rediger arrangement')
    // lederen kan bare velge blant gruppens medlemmer (Per Utenfor er ikke med)
    expect(k).toContain('Jonas Test')
    expect(k).not.toContain('Per Utenfor')
  })

  it('gruppeleder: oppgaver i andre grupper vises, men uten handlinger', async () => {
    const k = kort(await skjerm('leder', ola), 'Kaffevert')
    expect(k).not.toBe('')
    expect(k).toContain('tilhører en annen tjenestegruppe')
    expect(k).not.toContain('Grip inn')
    expect(k).not.toContain('Tildel / forespør')
  })

  it('admin kan velge blant alle personer, også utenfor gruppen', async () => {
    const k = kort(await skjerm('admin'), 'Kaffe-ansvarlig')
    expect(k).toContain('Per Utenfor')
  })

  it('personsiden: hver person ser bare sin egen status på oppgaven', async () => {
    const { oppgaver, tildelinger } = await hent()
    expect(B.oppgaverForPerson(jonas.id, oppgaver, tildelinger).venterPaSvar.map((x) => x.oppgave.id)).toContain(oppgD.id)
    expect(B.oppgaverForPerson(ola.id, oppgaver, tildelinger).bekreftet.map((x) => x.oppgave.id)).toContain(oppgD.id)
    for (const p of [kari, ingrid]) {
      const m = B.oppgaverForPerson(p.id, oppgaver, tildelinger)
      expect(m.bekreftet.map((x) => x.oppgave.id)).not.toContain(oppgD.id)
      expect(m.venterPaSvar.map((x) => x.oppgave.id)).not.toContain(oppgD.id)
    }
  })

  it('medlemmer i gruppen ser at oppgaven mangler folk, bortsett fra de som allerede er på den', async () => {
    const { oppgaver, tildelinger, grupper } = await hent()
    const ledigFor = (p: User) => B.ledigeOppgaverForPerson(p.id, grupper, oppgaver, tildelinger).map((o) => o.id)
    // behov 2: Ola bekreftet + Jonas forespurt holder begge plassene, så ingen andre ser den som ledig
    expect(rad(oppgD, tildelinger)).toMatchObject({ bekreftet: 1, venter: 1, ledigePlasser: 0 })
    expect(ledigFor(ingrid)).not.toContain(oppgD.id)
    // når Jonas avslår, åpnes plassen for gruppen igjen
    const t = tildelinger.find((x) => x.oppgave === oppgD.id && x.person === jonas.id)!
    await kjor(medlem.svarTildeling as never, { tildelingId: t.id, personId: jonas.id, status: 'declined' })
    const etter = await hent()
    expect(B.ledigeOppgaverForPerson(ingrid.id, etter.grupper, etter.oppgaver, etter.tildelinger).map((o) => o.id)).toContain(oppgD.id)
  })
})

describe('Oppgavekortet henger sammen på tvers av admin, gruppeleder og medlem', () => {
  async function oppgaveKort(modus: 'admin' | 'leder' | 'medlem', aktor?: User) {
    const { renderToStaticMarkup } = await import('react-dom/server')
    const komp = (await import('@/components/admin/OppgaveKort')).default
    const o = (await hent()).oppgaver.find((x) => x.tittel === 'Kaffe-ansvarlig')!
    return { html: renderToStaticMarkup(await komp({ payload, oppgaveId: o.id, modus, aktor })), oppgaveId: o.id }
  }
  const chipFor = (html: string, navn: string) => {
    const deler = html.split('<div class="oppgavekort-person"')
    return deler.find((d) => d.includes(`>${navn}</strong>`)) ?? ''
  }

  beforeAll(async () => {
    const o = (await hent()).oppgaver.find((x) => x.tittel === 'Kaffe-ansvarlig')!
    await payload.update({ collection: 'oppgaver', id: o.id, data: { instruksjon: 'Lever ferdig oppskåret kake før kl. 12.' }, overrideAccess: true })
    // Sørg for at Jonas er forespurt (forrige testgruppe lot ham avslå): Ola bekreftet, Kari forfall, Ingrid avslått, Jonas forespurt.
    const jonasT = (await hent()).tildelinger.find((x) => x.oppgave === o.id && x.person === jonas.id)
    if (jonasT?.svar !== 'pending') await kjor(admin.foresporPerson, { aktivitetId, oppgaveId: o.id, personId: jonas.id })
  })

  it('admin: kortet viser samling, gruppe, behov, instruks og alle personer med status og kontaktinfo', async () => {
    const { html, oppgaveId } = await oppgaveKort('admin')
    expect(html).toContain(`ID: oppgave-${oppgaveId}`)
    expect(html).toContain('Kaffe-ansvarlig')
    expect(html).toContain('Flyt-gudstjeneste') // samling
    expect(html).toContain('Lyd og bilde') // tjenestegruppe
    expect(html).toContain('tjenestegruppe')
    expect(html).toMatch(/2 personer/) // bemanningsbehov
    expect(html).toContain('Lever ferdig oppskåret kake før kl. 12.') // instruks
    expect(html).toContain('PERSONSTATUS FOR OPPGAVEN (4)')
    expect(chipFor(html, 'Ola Test')).toContain('>Bekreftet<')
    expect(chipFor(html, 'Kari Test')).toContain('>Forfall<')
    expect(chipFor(html, 'Ingrid Test')).toContain('>Avslått<')
    expect(chipFor(html, 'Jonas Test')).toContain('>Forespurt<')
    expect(chipFor(html, 'Ola Test')).toContain('ola@flyt.test') // kontaktinfo
    expect(html).toContain('Oppdater behov')
    expect(html).toContain('Lagre instruks')
    expect(html).toContain('Grip inn / Tildel')
  })

  it('gruppeleder: ser det samme som admin for oppgaver i egen gruppe, og kan endre behov og instruks', async () => {
    const adm = (await oppgaveKort('admin')).html
    const { html } = await oppgaveKort('leder', ola)
    for (const [navn, merke] of [['Ola Test', 'Bekreftet'], ['Kari Test', 'Forfall'], ['Ingrid Test', 'Avslått'], ['Jonas Test', 'Forespurt']] as const) {
      expect(chipFor(html, navn)).toContain(`>${merke}<`)
      expect(chipFor(adm, navn)).toContain(`>${merke}<`)
    }
    expect(html).toContain('ola@flyt.test')
    expect(html).toContain('Oppdater behov')
    expect(html).toContain('Lagre instruks')
    expect(html).toContain('Grip inn / Tildel')
    // lederen kan bare velge personer i egen gruppe
    expect(html).not.toContain('Per Utenfor')
  })

  it('medlem: ser bekreftede og sin egen status, men ikke andres forespørsler, avslag, forfall eller kontaktinfo', async () => {
    const { html } = await oppgaveKort('medlem', ingrid)
    expect(html).toContain('Kaffe-ansvarlig')
    expect(html).toContain('Flyt-gudstjeneste')
    expect(html).toContain('Lyd og bilde')
    expect(html).toContain('Lever ferdig oppskåret kake før kl. 12.')
    expect(chipFor(html, 'Ola Test')).toContain('>Bekreftet<') // bekreftet er synlig for gruppen
    expect(chipFor(html, 'Ingrid Test')).toContain('>Avslått<') // egen status
    expect(chipFor(html, 'Kari Test')).toBe('') // andres forfall skjules
    expect(chipFor(html, 'Jonas Test')).toBe('') // andres forespørsel skjules
    expect(html).not.toContain('ola@flyt.test') // ingen kontaktinfo
    expect(html).not.toContain('Oppdater behov')
    expect(html).not.toContain('Lagre instruks')
    expect(html).not.toContain('Grip inn')
  })

  it('medlem som er forespurt får Ja/Nei, og bekreftet medlem får Meld forfall', async () => {
    const jonasKort = (await oppgaveKort('medlem', jonas)).html
    expect(jonasKort).toContain('Ja, jeg tar den')
    expect(chipFor(jonasKort, 'Jonas Test')).toContain('>Forespurt<')
    const olaMedlem = (await oppgaveKort('medlem', ola)).html
    expect(olaMedlem).toContain('Meld forfall')
  })

  it('endring av behov og instruks på ett nivå vises på alle nivåer', async () => {
    const o = (await hent()).oppgaver.find((x) => x.tittel === 'Kaffe-ansvarlig')!
    const r1 = await kjor(leder.lederOppdaterBehov as never, { aktorId: ola.id, aktivitetId, oppgaveId: o.id, antall: 3 })
    expect(r1.melding).toContain('oppdatert')
    const r2 = await kjor(leder.lederOppdaterInstruks as never, { aktorId: ola.id, aktivitetId, oppgaveId: o.id, instruksjon: 'Ny instruks fra leder.' })
    expect(r2.melding).toContain('Instruksen er lagret')

    for (const [modus, aktor] of [['admin', undefined], ['leder', ola], ['medlem', ingrid]] as const) {
      const { html } = await oppgaveKort(modus, aktor)
      expect(html, modus).toMatch(/3 personer/)
      expect(html, modus).toContain('Ny instruks fra leder.')
    }
  })

  it('en som ikke leder gruppen kan ikke endre behov eller instruks', async () => {
    const o = (await hent()).oppgaver.find((x) => x.tittel === 'Kaffe-ansvarlig')!
    const r = await kjor(leder.lederOppdaterBehov as never, { aktorId: ingrid.id, aktivitetId, oppgaveId: o.id, antall: 9 })
    expect(r.melding).toContain('Bare leder eller nestleder')
    const r2 = await kjor(leder.lederOppdaterInstruks as never, { aktorId: kari.id, aktivitetId, oppgaveId: o.id, instruksjon: 'Hacket' })
    expect(r2.melding).toContain('Bare leder eller nestleder')
    const etter = (await hent()).oppgaver.find((x) => x.id === o.id)!
    expect(etter.antallTrengs).toBe(3)
    expect(etter.instruksjon).toBe('Ny instruks fra leder.')
  })

  it('admin kan endre behov og instruks fra kortet', async () => {
    const o = (await hent()).oppgaver.find((x) => x.tittel === 'Kaffe-ansvarlig')!
    await kjor(admin.oppdaterBehov as never, { aktivitetId, oppgaveId: o.id, antall: 2 })
    await kjor(admin.oppdaterInstruks as never, { aktivitetId, oppgaveId: o.id, instruksjon: 'Admin sin instruks.' })
    const etter = (await hent()).oppgaver.find((x) => x.id === o.id)!
    expect(etter).toMatchObject({ antallTrengs: 2, instruksjon: 'Admin sin instruks.' })
  })

  it('handlinger fra kortet sender deg tilbake til kortet', async () => {
    const o = (await hent()).oppgaver.find((x) => x.tittel === 'Kaffe-ansvarlig')!
    const sendt = await kjor(admin.oppdaterBehov as never, { aktivitetId, oppgaveId: o.id, antall: 2, returTil: `/admin-oversikt/oppgave/${o.id}` })
    expect(sendt.melding).toContain('oppdatert')
    // kjor() gir bare meldingen; sjekk adressen direkte
    let url = ''
    try {
      await admin.oppdaterBehov(skjema({ aktivitetId, oppgaveId: o.id, antall: 2, returTil: `/admin-oversikt/oppgave/${o.id}` }))
    } catch (e) {
      url = (e as Error).message
    }
    expect(url).toContain(`NEXT_REDIRECT:/admin-oversikt/oppgave/${o.id}?melding=`)
    // ugyldig returadresse ignoreres
    try {
      await admin.oppdaterBehov(skjema({ aktivitetId, oppgaveId: o.id, antall: 2, returTil: 'https://ond.example/steal' }))
    } catch (e) {
      url = (e as Error).message
    }
    expect(url).toContain(`NEXT_REDIRECT:/admin-oversikt/arrangement/${aktivitetId}?melding=`)
  })
})