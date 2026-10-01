import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { DEMO_COOKIE, erDemo } from '@/lib/demo'

/**
 * Bytter demo-rolle: /demo/bytt?som=ID&retur=/min-side. Fungerer bare i demomodus (DEMO_MODUS=true).
 * som=0 fjerner valget.
 */
export async function GET(request: Request) {
  if (!erDemo()) return new NextResponse('Ikke tilgjengelig', { status: 404 })

  const url = new URL(request.url)
  const id = Number(url.searchParams.get('som'))
  const retur = url.searchParams.get('retur') ?? '/min-side'
  // Bare interne adresser (hindrer videresending til andre nettsteder).
  const trygg = retur.startsWith('/') && !retur.startsWith('//') ? retur : '/min-side'
  // Relativ adresse: nettleseren bruker samme vert som den kom fra, slik at cookien alltid følger med.
  const svar = new NextResponse(null, { status: 307, headers: { Location: trygg } })

  if (id === 0) {
    svar.cookies.delete(DEMO_COOKIE)
    return svar
  }
  if (!Number.isInteger(id)) return new NextResponse('Ugyldig person', { status: 400 })

  const payload = await getPayload({ config: await config })
  const person = await payload.findByID({ collection: 'users', id, depth: 0, overrideAccess: true }).catch(() => null)
  if (!person) return new NextResponse('Ukjent person', { status: 404 })

  svar.cookies.set(DEMO_COOKIE, String(person.id), { path: '/', maxAge: 60 * 60 * 24, sameSite: 'lax', httpOnly: true })
  return svar
}
