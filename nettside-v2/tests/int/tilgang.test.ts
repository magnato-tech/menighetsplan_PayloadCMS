/**
 * Tilgang utenfra: det en uinnlogget, et vanlig medlem og en admin faktisk slipper til via Payloads API
 * (samme regler som REST/GraphQL og /admin bruker). Appens egne handlinger går via serveren og er testet i flyt.test.ts.
 * Kjører mot Neon når TEST_DATABASE_URL er satt, ellers mot en midlertidig SQLite-fil.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import type { User } from '@/payload-types'

const POSTGRES = process.env.TEST_DATABASE_URL && /^postgres(ql)?:\/\//.test(process.env.TEST_DATABASE_URL) ? process.env.TEST_DATABASE_URL : ''
const DB_FIL = path.resolve(process.cwd(), 'data', 'test-tilgang.db')
if (POSTGRES) {
  process.env.DATABASE_URL = POSTGRES
  delete process.env.SQLITE_URL
} else {
  process.env.SQLITE_URL = `file:${DB_FIL.replace(/\\/g, '/')}`
  process.env.DATABASE_URL = ''
  fs.mkdirSync(path.dirname(DB_FIL), { recursive: true })
  for (const ende of ['', '-shm', '-wal', '-journal']) fs.rmSync(DB_FIL + ende, { force: true })
}
const KJORING = Date.now().toString(36)

let payload: Payload
type Bruker = User & { collection: 'users' }
let admin: Bruker, ingrid: Bruker, per: Bruker
let gruppeId: number, aktivitetOffentlig: number, aktivitetPrivat: number, oppgaveId: number, tildelingId: number, meldingId: number, mediaId: number

const som = (u: Bruker) => ({ user: u, overrideAccess: false as const })
const anonym = { overrideAccess: false as const }

beforeAll(async () => {
  const { getPayload } = await import('payload')
  const config = (await import('@/payload.config')).default
  payload = await getPayload({ config: await config })

  const lag = async (navn: string, rolle: 'admin' | 'member') =>
    ({
      ...(await payload.create({
        collection: 'users',
        data: { navn, email: `${navn.split(' ')[0].toLowerCase()}-${KJORING}@tilgang.test`, password: 'test-passord-12345', globalRolle: rolle },
        overrideAccess: true,
      })),
      collection: 'users',
    }) as Bruker
  admin = await lag('Admin Test', 'admin')
  ingrid = await lag('Ingrid Medlem', 'member')
  per = await lag('Per Utenfor', 'member')

  const png = Buffer.from(
    '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000a49444154789c6360000002000155e3fe15000000004945' + '4e44ae426082',
    'hex',
  )
  mediaId = (
    await payload.create({
      collection: 'media',
      data: { alt: 'TILGANG_testbilde' },
      file: { data: png, mimetype: 'image/png', name: 'tilgang-test.png', size: png.length },
      overrideAccess: true,
    })
  ).id
  gruppeId = (
    await payload.create({ collection: 'grupper', data: { navn: 'Tilgangsgruppe', kategori: 'tjenestegruppe', medlemmer: [ingrid.id] }, overrideAccess: true })
  ).id
  const akt = (offentlig: boolean) =>
    payload.create({
      collection: 'aktiviteter',
      data: { gruppe: gruppeId, tittel: offentlig ? 'Offentlig arrangement' : 'Internt arrangement', bilde: mediaId, start: '2026-11-01T10:00:00.000Z', offentlig },
      overrideAccess: true,
    })
  aktivitetOffentlig = (await akt(true)).id
  aktivitetPrivat = (await akt(false)).id
  oppgaveId = (
    await payload.create({ collection: 'oppgaver', data: { aktivitet: aktivitetPrivat, gruppe: gruppeId, tittel: 'Tilgangsoppgave', antallTrengs: 1 }, overrideAccess: true })
  ).id
  tildelingId = (
    await payload.create({ collection: 'tildelinger', data: { oppgave: oppgaveId, person: ingrid.id, svar: 'confirmed' }, overrideAccess: true })
  ).id
  meldingId = (
    await payload.create({ collection: 'gruppemeldinger', data: { gruppe: gruppeId, avsender: ingrid.id, innhold: 'Hemmelig gruppemelding', type: 'melding' }, overrideAccess: true })
  ).id
}, 120000)

afterAll(async () => {
  const prov = async (f: () => Promise<unknown>) => {
    try {
      await f()
    } catch {}
  }
  await prov(() => payload.delete({ collection: 'gruppemeldinger', where: { gruppe: { equals: gruppeId } }, overrideAccess: true }))
  for (const id of [aktivitetOffentlig, aktivitetPrivat]) await prov(() => payload.delete({ collection: 'aktiviteter', id, overrideAccess: true }))
  for (const u of [admin, ingrid, per]) if (u) await prov(() => payload.delete({ collection: 'users', id: u.id, overrideAccess: true }))
  await prov(() => payload.delete({ collection: 'grupper', id: gruppeId, overrideAccess: true }))
  await prov(() => payload.delete({ collection: 'media', id: mediaId, overrideAccess: true }))
  if (!POSTGRES) for (const ende of ['', '-shm', '-wal', '-journal']) await prov(async () => fs.rmSync(DB_FIL + ende, { force: true }))
})

describe('Uinnlogget: ingen lesing av interne data', () => {
  for (const collection of ['grupper', 'oppgaver', 'tildelinger', 'oppmoter', 'gruppemeldinger', 'users'] as const) {
    it(`kan ikke lese ${collection}`, async () => {
      await expect(payload.find({ collection, ...anonym })).rejects.toThrow()
    })
  }

  it('ser bare offentlige arrangementer', async () => {
    const { docs } = await payload.find({ collection: 'aktiviteter', where: { gruppe: { equals: gruppeId } }, ...anonym })
    expect(docs.map((d) => d.tittel)).toEqual(['Offentlig arrangement'])
  })

  it('kan ikke endre eller opprette noe', async () => {
    await expect(payload.update({ collection: 'oppgaver', id: oppgaveId, data: { tittel: 'Hacket' }, ...anonym })).rejects.toThrow()
    await expect(
      payload.create({ collection: 'tildelinger', data: { oppgave: oppgaveId, person: per.id, svar: 'confirmed' }, ...anonym }),
    ).rejects.toThrow()
    await expect(payload.delete({ collection: 'gruppemeldinger', id: meldingId, ...anonym })).rejects.toThrow()
  })
})

describe('Vanlig medlem: leser bare det som angår en, og kan ikke endre andres data', () => {
  it('leser meldinger i egen gruppe, men ikke i grupper en ikke er med i', async () => {
    const mine = await payload.find({ collection: 'gruppemeldinger', where: { gruppe: { equals: gruppeId } }, ...som(ingrid) })
    expect(mine.docs.map((m) => m.innhold)).toContain('Hemmelig gruppemelding')
    const utenfor = await payload.find({ collection: 'gruppemeldinger', where: { gruppe: { equals: gruppeId } }, ...som(per) })
    expect(utenfor.docs).toHaveLength(0)
  })

  it('ser alle arrangementer når innlogget', async () => {
    const { docs } = await payload.find({ collection: 'aktiviteter', where: { gruppe: { equals: gruppeId } }, ...som(ingrid) })
    expect(docs).toHaveLength(2)
  })

  it('ser bare seg selv blant brukerne (ingen andres e-post eller telefon)', async () => {
    const { docs } = await payload.find({ collection: 'users', limit: 100, ...som(ingrid) })
    expect(docs.map((d) => d.id)).toEqual([ingrid.id])
    await expect(payload.findByID({ collection: 'users', id: per.id, ...som(ingrid) })).rejects.toThrow()
  })

  it('kan ikke opprette, endre eller slette tildelinger, oppgaver eller meldinger via API-et', async () => {
    await expect(
      payload.create({ collection: 'tildelinger', data: { oppgave: oppgaveId, person: per.id, svar: 'confirmed' }, ...som(ingrid) }),
    ).rejects.toThrow()
    await expect(payload.update({ collection: 'tildelinger', id: tildelingId, data: { svar: 'withdrawn' }, ...som(ingrid) })).rejects.toThrow()
    await expect(payload.update({ collection: 'oppgaver', id: oppgaveId, data: { antallTrengs: 99 }, ...som(ingrid) })).rejects.toThrow()
    await expect(payload.delete({ collection: 'gruppemeldinger', id: meldingId, ...som(ingrid) })).rejects.toThrow()
    await expect(payload.update({ collection: 'grupper', id: gruppeId, data: { navn: 'Overtatt' }, ...som(ingrid) })).rejects.toThrow()
    const etter = await payload.findByID({ collection: 'oppgaver', id: oppgaveId, overrideAccess: true })
    expect(etter.antallTrengs).toBe(1)
  })

  it('kan endre seg selv, men ikke gjøre seg selv til admin', async () => {
    await payload.update({ collection: 'users', id: ingrid.id, data: { navn: 'Ingrid Endret' }, ...som(ingrid) })
    await payload
      .update({ collection: 'users', id: ingrid.id, data: { globalRolle: 'admin' }, ...som(ingrid) })
      .catch(() => {})
    const etter = await payload.findByID({ collection: 'users', id: ingrid.id, overrideAccess: true })
    expect(etter.navn).toBe('Ingrid Endret')
    expect(etter.globalRolle).toBe('member')
  })

  it('kan ikke endre andre brukere eller slette brukere', async () => {
    await expect(payload.update({ collection: 'users', id: per.id, data: { navn: 'Overtatt' }, ...som(ingrid) })).rejects.toThrow()
    await expect(payload.delete({ collection: 'users', id: per.id, ...som(ingrid) })).rejects.toThrow()
  })

  it('får ikke åpne adminpanelet (/admin)', async () => {
    const { Users } = await import('@/collections/Users')
    const adminTilgang = Users.access?.admin as (a: { req: unknown }) => boolean
    expect(adminTilgang({ req: { user: ingrid } })).toBe(false)
    expect(adminTilgang({ req: { user: admin } })).toBe(true)
    expect(adminTilgang({ req: { user: null } })).toBe(false)
  })
})

describe('Admin: full tilgang', () => {
  it('leser alt og kan endre data via API-et', async () => {
    const brukere = await payload.find({ collection: 'users', limit: 500, ...som(admin) })
    expect(brukere.docs.map((d) => d.id)).toEqual(expect.arrayContaining([admin.id, ingrid.id, per.id]))
    const meldinger = await payload.find({ collection: 'gruppemeldinger', where: { gruppe: { equals: gruppeId } }, ...som(admin) })
    expect(meldinger.docs.length).toBeGreaterThan(0)
    const ny = await payload.create({ collection: 'tildelinger', data: { oppgave: oppgaveId, person: per.id, svar: 'pending' }, ...som(admin) })
    await payload.delete({ collection: 'tildelinger', id: ny.id, ...som(admin) })
  })
})
