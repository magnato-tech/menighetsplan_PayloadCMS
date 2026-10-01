import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { erDemo } from '@/lib/demo'
import { tilbakestillDemodata } from '@/lib/demoReset'

// Seeding kan ta litt tid (bilder og mange poster).
export const maxDuration = 300
export const dynamic = 'force-dynamic'

/** Knappen i demolinjen. Fungerer bare i demomodus. Maks én gang i minuttet. */
export async function POST() {
  if (!erDemo()) return new NextResponse('Ikke tilgjengelig', { status: 404 })
  const payload = await getPayload({ config: await config })
  await tilbakestillDemodata(payload)
  // Relativ adresse, så nettleseren holder seg på samme vert.
  return new NextResponse(null, { status: 303, headers: { Location: '/' } })
}

/**
 * Nattlig tilbakestilling (Vercel Cron, se vercel.json). Krever CRON_SECRET (Vercel sender den som Bearer),
 * og fungerer bare i demomodus. Uten CRON_SECRET avvises alle kall.
 */
export async function GET(request: Request) {
  if (!erDemo()) return new NextResponse('Ikke tilgjengelig', { status: 404 })
  const hemmelig = process.env.CRON_SECRET
  if (!hemmelig || request.headers.get('authorization') !== `Bearer ${hemmelig}`) {
    return new NextResponse('Ikke autorisert', { status: 401 })
  }
  const payload = await getPayload({ config: await config })
  const r = await tilbakestillDemodata(payload, { ignorerGrense: true })
  return NextResponse.json(r)
}
