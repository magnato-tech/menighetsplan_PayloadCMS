import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { demoPersona } from '@/lib/demo'

/**
 * Henter admin for admin-oversikten: enten innlogget Payload-bruker (samme innlogging som /admin) med rollen admin,
 * eller, KUN i demomodus (DEMO_MODUS=true), en demo-rolle som er admin. Ellers null.
 * Må kalles i hver server-handling som endrer data, ikke bare når siden vises.
 */
export async function hentAdmin() {
  const payload = await getPayload({ config: await config })
  const { user } = await payload.auth({ headers: await headers() })
  if (user && user.collection === 'users' && user.globalRolle === 'admin') {
    return { payload, user: { id: user.id, globalRolle: user.globalRolle, navn: user.navn } }
  }

  const persona = await demoPersona(payload)
  if (persona && persona.globalRolle === 'admin') {
    return { payload, user: { id: persona.id, globalRolle: persona.globalRolle, navn: persona.navn } }
  }
  return null
}

export function relId(rel: unknown): number | undefined {
  if (typeof rel === 'object' && rel !== null && 'id' in rel) {
    return (rel as { id: number }).id
  }
  return typeof rel === 'number' ? rel : undefined
}
