import { cookies } from 'next/headers'
import type { Payload } from 'payload'
import type { User } from '@/payload-types'

/**
 * DEMOMODUS (kun for demonstrasjon med mockdata).
 *
 * Slås på med miljøvariabelen DEMO_MODUS=true. Da kan hvem som helst velge hvem de vil være (admin, gruppeleder,
 * medlem) uten passord, og se alle funksjoner. Den tekniske Payload-adminen (/admin) er fortsatt låst.
 *
 * MÅ ALDRI være på i produksjon med ekte data. Når demomodus er av, ignoreres valget fullstendig,
 * og bare ekte innlogging gjelder.
 */

export const DEMO_COOKIE = 'demo_som'

export function erDemo(): boolean {
  return process.env.DEMO_MODUS === 'true'
}

/** Personen som er valgt som demo-rolle (fra cookie), eller null. Alltid null når demomodus er av. */
export async function demoPersona(payload: Payload): Promise<User | null> {
  if (!erDemo()) return null
  const verdi = (await cookies()).get(DEMO_COOKIE)?.value
  const id = Number(verdi)
  if (!verdi || !Number.isInteger(id)) return null
  return payload.findByID({ collection: 'users', id, depth: 0, overrideAccess: true }).catch(() => null)
}

/**
 * Hvilken person en side skal vise: «Vis som»-valget i adressen, ellers demo-rollen fra cookien.
 * Uten demomodus brukes bare adressen (som før).
 */
export async function somMedDemo(somParam?: string): Promise<string | undefined> {
  if (somParam) return somParam
  if (!erDemo()) return undefined
  return (await cookies()).get(DEMO_COOKIE)?.value
}
