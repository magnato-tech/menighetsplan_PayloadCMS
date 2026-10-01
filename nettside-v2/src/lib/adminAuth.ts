import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@/payload.config'

/**
 * Henter innlogget bruker fra Payload-innloggingen (samme innlogging som /admin) og
 * returnerer den bare hvis brukeren er admin. Ellers null.
 * Må kalles i hver server-handling som endrer data, ikke bare når siden vises.
 */
export async function hentAdmin() {
  const payload = await getPayload({ config: await config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user || user.collection !== 'users' || user.globalRolle !== 'admin') {
    return null
  }
  return { payload, user }
}

export function relId(rel: unknown): number | undefined {
  if (typeof rel === 'object' && rel !== null && 'id' in rel) {
    return (rel as { id: number }).id
  }
  return typeof rel === 'number' ? rel : undefined
}
