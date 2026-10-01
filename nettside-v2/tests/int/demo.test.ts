/**
 * Demomodus: hvem som helst kan velge rolle uten passord, men bare når DEMO_MODUS=true.
 * Viktigst: når demomodus er AV, gir demo-valget ingen adgang overhodet.
 * Kjører mot Neon når TEST_DATABASE_URL er satt, ellers mot en midlertidig SQLite-fil.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import type { Payload } from 'payload'
import type { User } from '@/payload-types'

const POSTGRES = process.env.TEST_DATABASE_URL && /^postgres(ql)?:\/\//.test(process.env.TEST_DATABASE_URL) ? process.env.TEST_DATABASE_URL : ''
const DB_FIL = path.resolve(process.cwd(), 'data', 'test-demo.db')
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

const demo = vi.hoisted(() => ({ cookie: '' as string }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: (navn: string) => (navn === 'demo_som' && demo.cookie ? { name: navn, value: demo.cookie } : undefined) }),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
}))

let payload: Payload
let kari: User, ingrid: User
let gruppeId: number, aktivitetId: number, oppgaveId: number, mediaId: number

beforeAll(async () => {
  const { getPayload } = await import('payload')
  const config = (await import('@/payload.config')).default
  payload = await getPayload({ config: await config })
  const lag = (navn: string, rolle: 'admin' | 'member') =>
    payload.create({
      collection: 'users',
      data: { navn, email: `${navn.split(' ')[0].toLowerCase()}-${KJORING}@demo.test`, password: 'test-passord-12345', globalRolle: rolle },
      overrideAccess: true,
    }) as Promise<User>
  kari = await lag('Kari Demo', 'admin')
  ingrid = await lag('Ingrid Demo', 'member')
  const png = Buffer.from(
    '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000a49444154789c6360000002000155e3fe15000000004945' + '4e44ae426082',
    'hex',
  )
  mediaId = (
    await payload.create({
      collection: 'media',
      data: { alt: 'DEMO_testbilde' },
      file: { data: png, mimetype: 'image/png', name: 'demo-test.png', size: png.length },
      overrideAccess: true,
    })
  ).id
  gruppeId = (await payload.create({ collection: 'grupper', data: { navn: 'Demogruppe', kategori: 'tjenestegruppe', medlemmer: [ingrid.id] }, overrideAccess: true })).id
  aktivitetId = (
    await payload.create({
      collection: 'aktiviteter',
      data: { gruppe: gruppeId, tittel: 'Demoarrangement', bilde: mediaId, start: '2026-11-01T10:00:00.000Z' },
      overrideAccess: true,
    })
  ).id
  oppgaveId = (
    await payload.create({ collection: 'oppgaver', data: { aktivitet: aktivitetId, gruppe: gruppeId, tittel: 'Demooppgave', antallTrengs: 1 }, overrideAccess: true })
  ).id
}, 120000)

afterEach(() => {
  delete process.env.DEMO_MODUS
  demo.cookie = ''
})

afterAll(async () => {
  const prov = async (f: () => Promise<unknown>) => {
    try {
      await f()
    } catch {}
  }
  await prov(() => payload.delete({ collection: 'gruppemeldinger', where: { gruppe: { equals: gruppeId } }, overrideAccess: true }))
  await prov(() => payload.delete({ collection: 'aktiviteter', id: aktivitetId, overrideAccess: true }))
  for (const u of [kari, ingrid]) if (u) await prov(() => payload.delete({ collection: 'users', id: u.id, overrideAccess: true }))
  await prov(() => payload.delete({ collection: 'grupper', id: gruppeId, overrideAccess: true }))
  await prov(() => payload.delete({ collection: 'media', id: mediaId, overrideAccess: true }))
  if (!POSTGRES) for (const ende of ['', '-shm', '-wal', '-journal']) await prov(async () => fs.rmSync(DB_FIL + ende, { force: true }))
})

describe('Demomodus AV (standard): demo-valget gir ingen adgang', () => {
  it('admin-sjekken avviser selv med en admin-cookie', async () => {
    const { hentAdmin } = await import('@/lib/adminAuth')
    demo.cookie = String(kari.id)
    expect(await hentAdmin()).toBeNull()
  })

  it('admin-handlinger avvises, og ingenting endres', async () => {
    const admin = await import('@/lib/adminHandlinger')
    demo.cookie = String(kari.id)
    const fd = new FormData()
    fd.set('aktivitetId', String(aktivitetId))
    fd.set('oppgaveId', String(oppgaveId))
    fd.set('personId', String(ingrid.id))
    await expect(admin.tildelPerson(fd)).rejects.toThrow(/admin/)
    const { docs } = await payload.find({ collection: 'tildelinger', where: { oppgave: { equals: oppgaveId } }, overrideAccess: true })
    expect(docs).toHaveLength(0)
  })

  it('«Vis som» fra cookien brukes ikke', async () => {
    const { somMedDemo } = await import('@/lib/demo')
    demo.cookie = String(kari.id)
    expect(await somMedDemo(undefined)).toBeUndefined()
    expect(await somMedDemo('7')).toBe('7') // adressen virker som før
  })

  it('bytte-adressen finnes ikke', async () => {
    const { GET } = await import('@/app/(frontend)/demo/bytt/route')
    const svar = await GET(new Request(`http://localhost/demo/bytt?som=${kari.id}&retur=/admin-oversikt`))
    expect(svar.status).toBe(404)
    expect(svar.headers.get('set-cookie')).toBeNull()
  })
})

describe('Demomodus PÅ: hvem som helst kan velge rolle, men Payload-admin er fortsatt låst', () => {
  it('admin-rolle gir tilgang til admin-oversikten og handlingene', async () => {
    process.env.DEMO_MODUS = 'true'
    demo.cookie = String(kari.id)
    const { hentAdmin } = await import('@/lib/adminAuth')
    expect((await hentAdmin())?.user.id).toBe(kari.id)

    const admin = await import('@/lib/adminHandlinger')
    const fd = new FormData()
    fd.set('aktivitetId', String(aktivitetId))
    fd.set('oppgaveId', String(oppgaveId))
    fd.set('personId', String(ingrid.id))
    await admin.tildelPerson(fd).catch((e: Error) => expect(e.message).toContain('NEXT_REDIRECT'))
    const { docs } = await payload.find({ collection: 'tildelinger', where: { oppgave: { equals: oppgaveId } }, overrideAccess: true })
    expect(docs.map((t) => t.svar)).toEqual(['confirmed'])
  })

  it('en vanlig rolle (medlem) gir ikke admin-tilgang', async () => {
    process.env.DEMO_MODUS = 'true'
    demo.cookie = String(ingrid.id)
    const { hentAdmin } = await import('@/lib/adminAuth')
    expect(await hentAdmin()).toBeNull()
  })

  it('uten valgt rolle eller med ukjent person gir ingen tilgang', async () => {
    process.env.DEMO_MODUS = 'true'
    const { hentAdmin } = await import('@/lib/adminAuth')
    expect(await hentAdmin()).toBeNull()
    demo.cookie = '999999'
    expect(await hentAdmin()).toBeNull()
    demo.cookie = 'abc'
    expect(await hentAdmin()).toBeNull()
  })

  it('«Vis som» fra cookien brukes av sidene, men adressen går foran', async () => {
    process.env.DEMO_MODUS = 'true'
    demo.cookie = String(ingrid.id)
    const { somMedDemo } = await import('@/lib/demo')
    expect(await somMedDemo(undefined)).toBe(String(ingrid.id))
    expect(await somMedDemo('42')).toBe('42')
  })

  it('bytte-adressen setter rolle og sender deg videre, men bare til interne adresser', async () => {
    process.env.DEMO_MODUS = 'true'
    const { GET } = await import('@/app/(frontend)/demo/bytt/route')
    const ok = await GET(new Request(`http://localhost/demo/bytt?som=${kari.id}&retur=/admin-oversikt`))
    expect(ok.status).toBe(307)
    expect(ok.headers.get('location')).toBe('/admin-oversikt')
    expect(ok.headers.get('set-cookie')).toContain(`demo_som=${kari.id}`)

    const ond = await GET(new Request(`http://localhost/demo/bytt?som=${kari.id}&retur=https://ond.example/steal`))
    expect(ond.headers.get('location')).toBe('/min-side')
    const ond2 = await GET(new Request(`http://localhost/demo/bytt?som=${kari.id}&retur=//ond.example`))
    expect(ond2.headers.get('location')).toBe('/min-side')

    expect((await GET(new Request('http://localhost/demo/bytt?som=999999'))).status).toBe(404)
    expect((await GET(new Request('http://localhost/demo/bytt?som=abc'))).status).toBe(400)
    const nullstill = await GET(new Request('http://localhost/demo/bytt?som=0&retur=/'))
    expect(nullstill.headers.get('set-cookie')).toContain('demo_som=;')
  })

  it('Payload-adminen (/admin) er fortsatt låst for medlemmer, også i demo', async () => {
    process.env.DEMO_MODUS = 'true'
    const { Users } = await import('@/collections/Users')
    const tilgang = Users.access?.admin as (a: { req: unknown }) => boolean
    expect(tilgang({ req: { user: { ...ingrid, collection: 'users' } } })).toBe(false)
    expect(tilgang({ req: { user: null } })).toBe(false)
  })

  it('API-et er like lukket i demo (uinnlogget kan ikke lese gruppechat)', async () => {
    process.env.DEMO_MODUS = 'true'
    demo.cookie = String(kari.id)
    await expect(payload.find({ collection: 'gruppemeldinger', overrideAccess: false })).rejects.toThrow()
  })
})
