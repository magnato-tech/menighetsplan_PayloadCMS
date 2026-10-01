/**
 * Databaseintegritet: hva skjer med tildelinger når en oppgave eller person slettes direkte
 * (for eksempel i Payload-admin), uten å gå via våre egne handlinger?
 * Kjører mot en egen, ny SQLite-database.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'

const DB_FIL = path.resolve(process.cwd(), 'data', 'test-integritet.db')
process.env.SQLITE_URL = `file:${DB_FIL.replace(/\\/g, '/')}`
process.env.DATABASE_URL = ''
fs.mkdirSync(path.dirname(DB_FIL), { recursive: true })
for (const ende of ['', '-shm', '-wal', '-journal']) fs.rmSync(DB_FIL + ende, { force: true })

let payload: Payload
let mediaId: number

beforeAll(async () => {
  const { getPayload } = await import('payload')
  const config = (await import('@/payload.config')).default
  payload = await getPayload({ config: await config })
  const png = Buffer.from(
    '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000a49444154789c6360000002000155e3fe15000000004945' + '4e44ae426082',
    'hex',
  )
  const m = (await payload.create({
    collection: 'media',
    data: { alt: 'INTEGRITET_testbilde' },
    file: { data: png, mimetype: 'image/png', name: 'integritet-test.png', size: png.length },
    overrideAccess: true,
  })) as { id: number }
  mediaId = m.id
}, 120000)

afterAll(async () => {
  await payload.delete({ collection: 'media', id: mediaId, overrideAccess: true }).catch(() => {})
  for (const ende of ['', '-shm', '-wal', '-journal']) {
    try {
      fs.rmSync(DB_FIL + ende, { force: true })
    } catch {}
  }
})

async function lag(suffiks: string) {
  const person = await payload.create({
    collection: 'users',
    data: { navn: `P ${suffiks}`, email: `p-${suffiks}@integritet.test`, password: 'test-passord-12345', globalRolle: 'member' },
    overrideAccess: true,
  })
  const gruppe = await payload.create({
    collection: 'grupper',
    data: { navn: `G ${suffiks}`, kategori: 'tjenestegruppe', medlemmer: [person.id] },
    overrideAccess: true,
  })
  const aktivitet = await payload.create({
    collection: 'aktiviteter',
    data: { gruppe: gruppe.id, tittel: `A ${suffiks}`, bilde: mediaId, start: '2026-11-01T10:00:00.000Z' },
    overrideAccess: true,
  })
  const oppgave = await payload.create({
    collection: 'oppgaver',
    data: { aktivitet: aktivitet.id, gruppe: gruppe.id, tittel: `O ${suffiks}`, antallTrengs: 1 },
    overrideAccess: true,
  })
  const tildeling = await payload.create({
    collection: 'tildelinger',
    data: { oppgave: oppgave.id, person: person.id, svar: 'confirmed' },
    overrideAccess: true,
  })
  return { person, gruppe, aktivitet, oppgave, tildeling }
}

describe('Sletting direkte i Payload etterlater ingen foreldreløse tildelinger', () => {
  it('slett oppgave → tildelingene på oppgaven forsvinner', async () => {
    const d = await lag('a')
    await payload.delete({ collection: 'oppgaver', id: d.oppgave.id, overrideAccess: true })
    const { docs } = await payload.find({ collection: 'tildelinger', where: { id: { equals: d.tildeling.id } }, depth: 0, overrideAccess: true })
    expect(docs).toHaveLength(0)
  })

  it('slett aktivitet → oppgavene og tildelingene på den forsvinner', async () => {
    const d = await lag('b')
    await payload.delete({ collection: 'aktiviteter', id: d.aktivitet.id, overrideAccess: true })
    const o = await payload.find({ collection: 'oppgaver', where: { id: { equals: d.oppgave.id } }, depth: 0, overrideAccess: true })
    const t = await payload.find({ collection: 'tildelinger', where: { id: { equals: d.tildeling.id } }, depth: 0, overrideAccess: true })
    expect(o.docs).toHaveLength(0)
    expect(t.docs).toHaveLength(0)
  })

  it('slett person → personens tildelinger forsvinner, og personen er ikke lenger medlem i gruppen', async () => {
    const d = await lag('c')
    await payload.delete({ collection: 'users', id: d.person.id, overrideAccess: true })
    const t = await payload.find({ collection: 'tildelinger', where: { id: { equals: d.tildeling.id } }, depth: 0, overrideAccess: true })
    expect(t.docs).toHaveLength(0)
    const g = await payload.findByID({ collection: 'grupper', id: d.gruppe.id, depth: 0, overrideAccess: true })
    expect(g.medlemmer ?? []).not.toContain(d.person.id)
  })

  it('slett gruppe med arrangementer og oppgaver → avvises med en tydelig melding, ingenting forsvinner', async () => {
    const d = await lag('d')
    await expect(payload.delete({ collection: 'grupper', id: d.gruppe.id, overrideAccess: true })).rejects.toThrow(/kan ikke slettes/)
    const g = await payload.find({ collection: 'grupper', where: { id: { equals: d.gruppe.id } }, depth: 0, overrideAccess: true })
    const o = await payload.find({ collection: 'oppgaver', where: { id: { equals: d.oppgave.id } }, depth: 0, overrideAccess: true })
    expect(g.docs).toHaveLength(1)
    expect(o.docs).toHaveLength(1)
  })

  it('slett tom gruppe → går bra', async () => {
    const g = await payload.create({ collection: 'grupper', data: { navn: 'Tom gruppe', kategori: 'tjenestegruppe' }, overrideAccess: true })
    await payload.delete({ collection: 'grupper', id: g.id, overrideAccess: true })
    const igjen = await payload.find({ collection: 'grupper', where: { id: { equals: g.id } }, depth: 0, overrideAccess: true })
    expect(igjen.docs).toHaveLength(0)
  })
})