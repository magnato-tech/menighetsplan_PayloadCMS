import { randomBytes } from 'node:crypto'
import type { Payload } from 'payload'
import { seedDemodata } from '@/seed/demodata'

export type ResetResultat = { ok: true; melding: string } | { ok: false; melding: string }

const MIN_MELLOMROM_MS = 60_000

/**
 * Tilbakestiller demodata (KUN for demomodus): sletter det som endrer seg når folk prøver løsningen
 * (meldinger, oppmøter, tildelinger, oppgaver og arrangementer) og fyller det inn igjen fra seeding.
 * Personer, grupper, sider, nyheter og bilder beholdes.
 *
 * Kan trykkes av hvem som helst i demomodus, så den har en grense på én gang i minuttet.
 */
export async function tilbakestillDemodata(payload: Payload, valg: { ignorerGrense?: boolean } = {}): Promise<ResetResultat> {
  if (!valg.ignorerGrense) {
    const sist = Number(await payload.kv.get<string>('demo-reset-sist'))
    if (Number.isFinite(sist) && sist > 0 && Date.now() - sist < MIN_MELLOMROM_MS) {
      return { ok: false, melding: 'Demodata ble tilbakestilt nylig. Vent et minutt og prøv igjen.' }
    }
  }
  await payload.kv.set('demo-reset-sist', String(Date.now()))

  for (const collection of ['gruppemeldinger', 'oppmoter', 'tildelinger', 'oppgaver', 'aktiviteter'] as const) {
    await payload.delete({ collection, where: { id: { greater_than: 0 } }, overrideAccess: true })
  }

  // Eksisterende brukere beholdes (og beholder passordet sitt). Passordet brukes bare hvis noen må opprettes på nytt.
  const passord = process.env.SEED_PASSORD && process.env.SEED_PASSORD.length >= 12 ? process.env.SEED_PASSORD : randomBytes(18).toString('base64url')
  await seedDemodata(payload, passord)
  return { ok: true, melding: 'Demodata er tilbakestilt.' }
}
