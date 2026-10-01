/**
 * Tilbakestilling av demodata: sletter arrangementer/oppgaver/tildelinger/meldinger og seeder på nytt.
 * Kjører bare mot SQLite (en midlertidig fil), aldri mot Neon, fordi den tømmer tabellene.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'

const POSTGRES = !!process.env.TEST_DATABASE_URL && /^postgres(ql)?:\/\//.test(process.env.TEST_DATABASE_URL)
const DB_FIL = path.resolve(process.cwd(), 'data', 'test-demoreset.db')
if (!POSTGRES) {
  process.env.SQLITE_URL = `file:${DB_FIL.replace(/\\/g, '/')}`
  process.env.DATABASE_URL = ''
  fs.mkdirSync(path.dirname(DB_FIL), { recursive: true })
  for (const ende of ['', '-shm', '-wal', '-journal']) fs.rmSync(DB_FIL + ende, { force: true })
}
process.env.SEED_PASSORD = 'test-passord-for-reset-123'

vi.mock('next/headers', () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined }) }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

let payload: Payload

beforeAll(async () => {
  if (POSTGRES) return
  const { getPayload } = await import('payload')
  const config = (await import('@/payload.config')).default
  payload = await getPayload({ config: await config })
}, 120000)

afterAll(() => {
  if (!POSTGRES) for (const ende of ['', '-shm', '-wal', '-journal']) {
    try {
      fs.rmSync(DB_FIL + ende, { force: true })
    } catch {}
  }
})

const antall = async (collection: 'aktiviteter' | 'tildelinger' | 'oppgaver' | 'gruppemeldinger' | 'users') =>
  (await payload.count({ collection, overrideAccess: true })).totalDocs

describe.skipIf(POSTGRES)('Tilbakestilling av demodata', () => {
  it('gjenoppretter utgangspunktet etter at brukerne har endret ting', async () => {
    const { tilbakestillDemodata } = await import('@/lib/demoReset')
    expect((await tilbakestillDemodata(payload, { ignorerGrense: true })).ok).toBe(true)
    const f = { aktiviteter: await antall('aktiviteter'), oppgaver: await antall('oppgaver'), tildelinger: await antall('tildelinger'), brukere: await antall('users') }
    expect(f.aktiviteter).toBeGreaterThan(0)
    expect(f.oppgaver).toBeGreaterThan(0)

    // Brukere «roter»: sletter en tildeling og skriver en melding.
    const { docs: [t] } = await payload.find({ collection: 'tildelinger', limit: 1, overrideAccess: true })
    if (t) await payload.delete({ collection: 'tildelinger', id: t.id, overrideAccess: true })
    const { docs: [g] } = await payload.find({ collection: 'grupper', limit: 1, overrideAccess: true })
    const { docs: [u] } = await payload.find({ collection: 'users', limit: 1, overrideAccess: true })
    await payload.create({ collection: 'gruppemeldinger', data: { gruppe: g.id, avsender: u.id, innhold: 'Søppel fra demobruker', type: 'melding' }, overrideAccess: true })
    expect(await antall('gruppemeldinger')).toBeGreaterThan(0)

    expect((await tilbakestillDemodata(payload, { ignorerGrense: true })).ok).toBe(true)
    expect(await antall('aktiviteter')).toBe(f.aktiviteter)
    expect(await antall('oppgaver')).toBe(f.oppgaver)
    expect(await antall('tildelinger')).toBe(f.tildelinger)
    expect(await antall('users')).toBe(f.brukere)
    const { totalDocs: soppel } = await payload.count({ collection: 'gruppemeldinger', where: { innhold: { equals: 'Søppel fra demobruker' } }, overrideAccess: true })
    expect(soppel).toBe(0)
  }, 240000)

  it('begrenser hvor ofte det kan tilbakestilles', async () => {
    const { tilbakestillDemodata } = await import('@/lib/demoReset')
    const nei = await tilbakestillDemodata(payload)
    expect(nei.ok).toBe(false)
  }, 60000)
})

describe.skipIf(POSTGRES)('Adressen /demo/tilbakestill', () => {
  it('finnes ikke utenfor demomodus', async () => {
    delete process.env.DEMO_MODUS
    const { POST, GET } = await import('@/app/(frontend)/demo/tilbakestill/route')
    expect((await POST()).status).toBe(404)
    expect((await GET(new Request('http://localhost/demo/tilbakestill'))).status).toBe(404)
  })

  it('nattjobben krever riktig hemmelighet', async () => {
    process.env.DEMO_MODUS = 'true'
    const { GET } = await import('@/app/(frontend)/demo/tilbakestill/route')
    delete process.env.CRON_SECRET
    expect((await GET(new Request('http://localhost/demo/tilbakestill'))).status).toBe(401)
    process.env.CRON_SECRET = 'riktig-hemmelighet'
    expect((await GET(new Request('http://localhost/demo/tilbakestill', { headers: { authorization: 'Bearer feil' } }))).status).toBe(401)
    expect((await GET(new Request('http://localhost/demo/tilbakestill', { headers: { authorization: 'Bearer riktig-hemmelighet' } }))).status).toBe(200)
    delete process.env.DEMO_MODUS
    delete process.env.CRON_SECRET
  }, 240000)
})
