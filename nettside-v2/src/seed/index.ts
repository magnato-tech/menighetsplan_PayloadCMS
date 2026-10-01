import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@/payload.config'
import sharp from 'sharp'

// Passord for de seedede demobrukerne. Lokalt brukes et kjent demopassord.
// På Vercel (offentlig) kreves SEED_PASSORD (minst 12 tegn), ellers stoppes seeding,
// slik at en kjent admin-innlogging aldri havner på en offentlig side.
const SEED_PASSORD = process.env.SEED_PASSORD || 'endre-meg-123'
if (process.env.VERCEL && (!process.env.SEED_PASSORD || process.env.SEED_PASSORD.length < 12)) {
  console.error('Avbryter seeding: sett SEED_PASSORD (minst 12 tegn) som miljøvariabel i Vercel.')
  process.exit(1)
}
const placeholderFarger = ['#1f4e5f', '#c8873a', '#2e8b57', '#7a3b8c', '#a33', '#1a6e8e']
let placeholderTeller = 0

async function lagPlaceholderBilde(
  payload: Awaited<ReturnType<typeof getPayload>>,
  alt: string,
  bredde = 800,
  hoyde = 500,
): Promise<number> {
  const { docs } = await payload.find({ collection: 'media', where: { alt: { equals: alt } }, limit: 1 })
  if (docs.length > 0) return docs[0].id as number

  const farge = placeholderFarger[placeholderTeller % placeholderFarger.length]
  placeholderTeller += 1
  const escapedAlt = alt.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const svg = `
    <svg width="${bredde}" height="${hoyde}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${farge}" />
      <text x="50%" y="50%" font-family="sans-serif" font-size="${Math.round(bredde / 22)}" fill="white"
        text-anchor="middle" dominant-baseline="middle">${escapedAlt}</text>
    </svg>
  `
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer()
  const opprettet = await payload.create({
    collection: 'media',
    data: { alt },
    file: {
      data: buffer,
      mimetype: 'image/png',
      name: `${alt.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`,
      size: buffer.length,
    },
  })
  return opprettet.id as number
}

const richText = (tekst: string) => ({
  root: {
    type: 'root',
    children: tekst.split('\n\n').map((avsnitt) => ({
      type: 'paragraph',
      children: [{ type: 'text', text: avsnitt, version: 1 }],
      version: 1,
    })),
    direction: 'ltr' as const,
    format: '' as const,
    indent: 0,
    version: 1,
  },
})

async function finnEllerOpprett<T extends { id: string | number }>(
  payload: Awaited<ReturnType<typeof getPayload>>,
  collection: string,
  where: Record<string, unknown>,
  data: Record<string, unknown>,
): Promise<T> {
  const { docs } = await payload.find({ collection: collection as never, where: where as never, limit: 1 })
  if (docs.length > 0) return docs[0] as T
  return (await payload.create({ collection: collection as never, data: data as never })) as T
}

async function main() {
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  console.log('Sår personer (fra Menighetsplan sin mockData.ts)...')
  const kari = await finnEllerOpprett<{ id: string | number }>(
    payload,
    'users',
    { email: { equals: 'kari.nordmann@eksempel.no' } },
    {
      email: 'kari.nordmann@eksempel.no',
      password: SEED_PASSORD,
      navn: 'Kari Nordmann',
      telefon: '912 34 567',
      globalRolle: 'admin',
    },
  )
  const ola = await finnEllerOpprett<{ id: string | number }>(
    payload,
    'users',
    { email: { equals: 'ola.hansen@eksempel.no' } },
    {
      email: 'ola.hansen@eksempel.no',
      password: SEED_PASSORD,
      navn: 'Ola Hansen',
      telefon: '987 65 432',
      globalRolle: 'member',
    },
  )
  const ingrid = await finnEllerOpprett<{ id: string | number }>(
    payload,
    'users',
    { email: { equals: 'ingrid.berg@eksempel.no' } },
    {
      email: 'ingrid.berg@eksempel.no',
      password: SEED_PASSORD,
      navn: 'Ingrid Berg',
      telefon: '456 78 901',
      globalRolle: 'member',
    },
  )
  const jonas = await finnEllerOpprett<{ id: string | number }>(
    payload,
    'users',
    { email: { equals: 'jonas.lie@eksempel.no' } },
    {
      email: 'jonas.lie@eksempel.no',
      password: SEED_PASSORD,
      navn: 'Jonas Lie',
      telefon: '923 45 678',
      globalRolle: 'member',
    },
  )

  console.log('Sår grupper (tjenestegrupper og husgruppe)...')
  const gruppeLyd = await finnEllerOpprett<{ id: string | number }>(
    payload,
    'grupper',
    { navn: { equals: 'Lyd og bilde' } },
    {
      navn: 'Lyd og bilde',
      kategori: 'tjenestegruppe',
      medlemmer: [kari.id, ola.id],
      ledere: [ola.id],
      varaledere: [kari.id],
      moteplan: { ukedag: 'Søndag', klokkeslett: '09:30', frekvens: 'hver uke' },
    },
  )
  const gruppeKaffe = await finnEllerOpprett<{ id: string | number }>(
    payload,
    'grupper',
    { navn: { equals: 'Kirkekaffe & vertskap' } },
    {
      navn: 'Kirkekaffe & vertskap',
      kategori: 'tjenestegruppe',
      medlemmer: [kari.id, ola.id, jonas.id],
      ledere: [kari.id],
      varaledere: [ola.id],
      moteplan: { ukedag: 'Søndag', klokkeslett: '10:30', frekvens: 'annenhver uke' },
    },
  )
  const gruppeBarn = await finnEllerOpprett<{ id: string | number }>(
    payload,
    'grupper',
    { navn: { equals: 'Søndagsskole & barn' } },
    {
      navn: 'Søndagsskole & barn',
      kategori: 'tjenestegruppe',
      medlemmer: [ingrid.id],
      ledere: [ingrid.id],
      varaledere: [],
      moteplan: { ukedag: 'Søndag', klokkeslett: '11:15', frekvens: 'annenhver uke' },
    },
  )
  const gruppeHus = await finnEllerOpprett<{ id: string | number }>(
    payload,
    'grupper',
    { navn: { equals: 'Husfellesskap Sentrum' } },
    {
      navn: 'Husfellesskap Sentrum',
      kategori: 'husgruppe',
      medlemmer: [kari.id, ola.id, ingrid.id, jonas.id],
      ledere: [ola.id],
      varaledere: [kari.id],
      moteplan: { ukedag: 'Onsdag', klokkeslett: '19:30', frekvens: 'annenhver uke' },
    },
  )

  console.log('Sår aktiviteter (gudstjenester, arrangementer, gruppesamlinger)...')
  // Datoene regnes ut relativt til kjøretidspunktet, slik at "Kommende arrangementer" på
  // forsiden/kalenderen alltid viser fremtidige aktiviteter, uansett når npm run seed kjøres.
  function fremtidigDato(dagerFraNaa: number, klokkeslett: string): string {
    const d = new Date()
    d.setUTCHours(0, 0, 0, 0)
    d.setUTCDate(d.getUTCDate() + dagerFraNaa)
    const [time, minutt] = klokkeslett.split(':').map(Number)
    d.setUTCHours(time, minutt, 0, 0)
    return d.toISOString()
  }
  type AktData = {
    gruppe: string | number
    tittel: string
    start: string
    slutt?: string
    sted?: string
    type: 'arrangement' | 'gruppesamling'
    tema?: string
    erGudstjeneste?: boolean
    offentlig?: boolean
  }
  const aktiviteterData: AktData[] = [
    {
      gruppe: gruppeHus.id,
      tittel: 'Husfellesskap hos Jonas',
      start: fremtidigDato(16, '19:30'),
      slutt: fremtidigDato(16, '21:30'),
      sted: 'Hos Jonas Lie (Skogveien 4)',
      type: 'gruppesamling',
      tema: 'Nåde og tilgivelse i hverdagen',
    },
    {
      gruppe: gruppeLyd.id,
      tittel: 'Semesteroppstart & testkveld',
      start: fremtidigDato(2, '18:00'),
      slutt: fremtidigDato(2, '20:00'),
      sted: 'Hovedsalen',
      type: 'gruppesamling',
    },
    {
      gruppe: gruppeKaffe.id,
      tittel: 'Gudstjeneste & velkomstkaffe',
      start: fremtidigDato(6, '11:00'),
      slutt: fremtidigDato(6, '13:00'),
      sted: 'Hovedsalen og kafeen',
      type: 'arrangement',
      erGudstjeneste: true,
      offentlig: true,
    },
    {
      gruppe: gruppeKaffe.id,
      tittel: 'Gudstjeneste & dåp',
      start: fremtidigDato(13, '11:00'),
      slutt: fremtidigDato(13, '13:00'),
      sted: 'Hovedsalen og kafeen',
      type: 'arrangement',
      erGudstjeneste: true,
      offentlig: true,
    },
    {
      gruppe: gruppeBarn.id,
      tittel: 'Søndagsskole semesteroppstart',
      start: fremtidigDato(13, '11:15'),
      slutt: fremtidigDato(13, '12:30'),
      sted: 'Kjellersalen',
      type: 'arrangement',
    },
    {
      gruppe: gruppeLyd.id,
      tittel: 'Ungdomsmøte & lovsang',
      start: fremtidigDato(18, '19:00'),
      slutt: fremtidigDato(18, '21:00'),
      sted: 'Ungdomssalen',
      type: 'arrangement',
      offentlig: true,
    },
    {
      gruppe: gruppeKaffe.id,
      tittel: 'Høstgudstjeneste & kirkelunsj',
      start: fremtidigDato(20, '11:00'),
      slutt: fremtidigDato(20, '13:00'),
      sted: 'Hovedsalen og kafeen',
      type: 'arrangement',
      erGudstjeneste: true,
      offentlig: true,
    },
    {
      gruppe: gruppeLyd.id,
      tittel: 'Lydteknisk opplæring & rigging',
      start: fremtidigDato(29, '19:00'),
      slutt: fremtidigDato(29, '21:00'),
      sted: 'Hovedsalen',
      type: 'gruppesamling',
    },
    {
      gruppe: gruppeLyd.id,
      tittel: 'Familiegudstjeneste & barnekor',
      start: fremtidigDato(34, '11:00'),
      slutt: fremtidigDato(34, '12:30'),
      sted: 'Hovedsalen',
      type: 'arrangement',
      erGudstjeneste: true,
      offentlig: true,
    },
  ]

  const aktIder: Record<string, string | number> = {}
  for (const a of aktiviteterData) {
    const bildeId = await lagPlaceholderBilde(payload, a.tittel)
    const { docs: eksisterendeAkt } = await payload.find({
      collection: 'aktiviteter',
      where: { tittel: { equals: a.tittel } },
      limit: 1,
    })
    const data = {
      gruppe: a.gruppe,
      tittel: a.tittel,
      bilde: bildeId,
      start: a.start,
      slutt: a.slutt,
      sted: a.sted,
      type: a.type,
      tema: a.tema,
      erGudstjeneste: a.erGudstjeneste || false,
      offentlig: a.offentlig || false,
      avlyst: false,
    }
    const opprettet =
      eksisterendeAkt.length > 0
        ? await payload.update({ collection: 'aktiviteter', id: eksisterendeAkt[0].id, data: data as never })
        : await payload.create({ collection: 'aktiviteter', data: data as never })
    aktIder[a.tittel] = (opprettet as { id: string | number }).id
  }

  console.log('Sår oppgaver og tildelinger (dekket/mangler/forfall)...')
  type OppgData = {
    aktivitet: string | number
    gruppe: string | number
    tittel: string
    status: 'open' | 'assigned' | 'confirmed' | 'vacant' | 'cancelled'
    tildeltTil?: string | number
    svar?: 'pending' | 'confirmed' | 'declined' | 'withdrawn'
  }
  const oppgaverData: OppgData[] = [
    {
      aktivitet: aktIder['Semesteroppstart & testkveld'],
      gruppe: gruppeLyd.id,
      tittel: 'Teknisk riggansvarlig',
      status: 'confirmed',
      tildeltTil: ola.id,
      svar: 'confirmed',
    },
    {
      aktivitet: aktIder['Gudstjeneste & velkomstkaffe'],
      gruppe: gruppeKaffe.id,
      tittel: 'Velkomstkaffe vert',
      status: 'confirmed',
      tildeltTil: kari.id,
      svar: 'confirmed',
    },
    {
      aktivitet: aktIder['Gudstjeneste & dåp'],
      gruppe: gruppeLyd.id,
      tittel: 'Lydtekniker søndag',
      status: 'confirmed',
      tildeltTil: ola.id,
      svar: 'confirmed',
    },
    {
      aktivitet: aktIder['Gudstjeneste & dåp'],
      gruppe: gruppeLyd.id,
      tittel: 'Prosjektor & streaming',
      status: 'confirmed',
      tildeltTil: kari.id,
      svar: 'confirmed',
    },
    {
      aktivitet: aktIder['Gudstjeneste & dåp'],
      gruppe: gruppeLyd.id,
      tittel: 'Kamerastyring',
      status: 'vacant',
    },
    {
      aktivitet: aktIder['Ungdomsmøte & lovsang'],
      gruppe: gruppeLyd.id,
      tittel: 'Lovsang med ungdomsbandet',
      status: 'vacant',
    },
    {
      aktivitet: aktIder['Høstgudstjeneste & kirkelunsj'],
      gruppe: gruppeKaffe.id,
      tittel: 'Felles varm høstlunsj i kafeen',
      status: 'vacant',
    },
    {
      aktivitet: aktIder['Familiegudstjeneste & barnekor'],
      gruppe: gruppeLyd.id,
      tittel: 'Barnekor opptreden (flere mikrofoner)',
      status: 'assigned',
      tildeltTil: ola.id,
      svar: 'pending',
    },
    {
      aktivitet: aktIder['Søndagsskole semesteroppstart'],
      gruppe: gruppeBarn.id,
      tittel: 'Lede formingsaktivitet',
      status: 'confirmed',
      tildeltTil: ingrid.id,
      svar: 'confirmed',
    },
  ]

  for (const o of oppgaverData) {
    const oppgave = await finnEllerOpprett<{ id: string | number }>(
      payload,
      'oppgaver',
      { tittel: { equals: o.tittel }, aktivitet: { equals: o.aktivitet } },
      {
        aktivitet: o.aktivitet,
        gruppe: o.gruppe,
        tittel: o.tittel,
        status: o.status,
        antallTrengs: 1,
      },
    )
    if (o.tildeltTil) {
      await finnEllerOpprett(
        payload,
        'tildelinger',
        { oppgave: { equals: oppgave.id }, person: { equals: o.tildeltTil } },
        { oppgave: oppgave.id, person: o.tildeltTil, svar: o.svar || 'pending' },
      )
    }
  }

  console.log('Sår gruppemeldinger...')
  const meldinger = [
    {
      gruppe: gruppeKaffe.id,
      avsender: kari.id,
      innhold:
        'Velkommen til nytt semester i kaffegruppen! Husk å sjekke datoene dine for september og høsten.',
    },
    {
      gruppe: gruppeLyd.id,
      avsender: ola.id,
      innhold: 'Vi har en teknisk opplæringskveld tirsdag 22. september kl. 19:00. Vel møtt!',
    },
    {
      gruppe: gruppeHus.id,
      avsender: ola.id,
      innhold:
        'Gleder meg til høstsemesteret i husfellesskapet vårt! Vi starter opp hos Jonas onsdag 9. september kl. 19:30.',
    },
    {
      gruppe: gruppeHus.id,
      avsender: jonas.id,
      innhold: 'Velkommen hjem til oss! Jeg setter over kaffe og te.',
    },
  ]
  for (const m of meldinger) {
    const { docs } = await payload.find({
      collection: 'gruppemeldinger',
      where: { gruppe: { equals: m.gruppe }, avsender: { equals: m.avsender }, innhold: { equals: m.innhold } },
      limit: 1,
    })
    if (docs.length === 0) {
      await payload.create({
        collection: 'gruppemeldinger',
        data: { gruppe: m.gruppe as number, avsender: m.avsender as number, innhold: m.innhold },
      })
    }
  }

  console.log('Sår faste sider (om-oss/barn-og-unge/kontakt)...')
  const sider = [
    {
      slug: 'om-oss',
      tittel: 'Om oss',
      rekkefolge: 1,
      tekst:
        'Lillesand Misjonskirke er en del av det globale misjonsarbeidet. Vi fokuserer på å bygge en levende menighet basert på evangeliet.\n\nVi arbeider med både lokale og internasjonale prosjekter for å gjøre en positiv forskjell i verden.',
    },
    {
      slug: 'barn-og-unge',
      tittel: 'Barn og unge',
      rekkefolge: 2,
      tekst:
        'Vi tilbyr aktiviteter for barn og unge fra barnehagealder og oppover. Alle er velkommen til å delta i våre program og arrangementer.',
    },
    {
      slug: 'kontakt',
      tittel: 'Kontakt',
      rekkefolge: 3,
      tekst:
        'Har du spørsmål eller ønsker å komme i kontakt med oss? Vi setter pris på å høre fra deg.\n\nVi holder gudstjenester hver søndag kl. 11:00. Alle er velkomne!',
    },
    {
      slug: 'gi',
      tittel: 'Gi',
      rekkefolge: 10,
      tekst:
        'Din gave gjør en forskjell — både lokalt i Lillesand Misjonskirke og i misjonsarbeid ute i verden. Gaver går til drift av menigheten, diakonalt arbeid i Lillesand og faste misjonsprosjekter menigheten støtter.\n\n(Eksempeltekst — PO fyller inn ekte Vipps-nummer og kontonummer)\n\nVipps: #000000\nKontonummer: 0000.00.00000\n\nDu kan også gi fast hver måned ved å opprette en avtalegiro. Ta kontakt med kontoret for å sette dette opp.\n\nTakk for at du gir!',
    },
  ]
  const sideIder: Record<string, string | number> = {}
  for (const side of sider) {
    const { docs } = await payload.find({ collection: 'sider', where: { slug: { equals: side.slug } }, limit: 1 })
    if (docs.length > 0) {
      sideIder[side.slug] = docs[0].id
      continue
    }
    const opprettet = await payload.create({
      collection: 'sider',
      data: {
        tittel: side.tittel,
        slug: side.slug,
        visIMeny: true,
        rekkefolge: side.rekkefolge,
        blokker: [{ blockType: 'tekst', innhold: richText(side.tekst) }],
      },
    })
    sideIder[side.slug] = opprettet.id
  }

  console.log('Sår undersider av Om oss (fløymk.no-inspirert struktur, mockup-tekst)...')
  const omOssUndersider = [
    {
      slug: 'stab-og-lederskap',
      tittel: 'Stab og lederskap',
      rekkefolge: 1,
      tekst:
        '(Eksempeltekst — erstattes med ekte navn og bilder)\n\nKari Nordmann — Pastor\nkari.nordmann@eksempel.no · 912 34 567\n\nOla Hansen — Nestleder i lederskapet, ansvarlig for lyd og bilde\nola.hansen@eksempel.no · 987 65 432\n\nIngrid Berg — Leder for søndagsskolen\ningrid.berg@eksempel.no · 456 78 901\n\nMenighetens lederskap møtes jevnlig for å legge planer, følge opp menighetens drift og be for menigheten.',
    },
    {
      slug: 'bli-medlem',
      tittel: 'Bli medlem',
      rekkefolge: 2,
      tekst:
        '(Eksempeltekst)\n\nAlle som deler menighetens tro og ønsker å høre til fellesskapet er velkomne som medlemmer.\n\nSlik blir du medlem:\n1. Ta kontakt med en av pastorene eller lederskapet\n2. Vi tar en uforpliktende samtale om tro og fellesskap\n3. Du blir presentert for menigheten på en gudstjeneste\n\nSom medlem får du stemmerett på årsmøtet, mulighet til å ta på deg tjenesteoppgaver, og en fast plass i fellesskapet.',
    },
    {
      slug: 'visjon-verdier-vedtekter',
      tittel: 'Visjon, verdier og vedtekter',
      rekkefolge: 3,
      tekst:
        '(Eksempeltekst)\n\nVisjon: Vi vil at alle mennesker skal få del i livet Gud har for dem.\n\nVåre verdier:\n- Nåde — vi møter mennesker der de er\n- Fellesskap — vi vil vokse sammen, ikke alene\n- Tjeneste — vi bruker gavene våre til å bygge menigheten og hjelpe andre\n- Misjon — vi ser utover oss selv, lokalt og globalt\n\nMenighetens vedtekter er tilgjengelige hos lederskapet, og gjennomgås på det årlige årsmøtet.',
    },
  ]
  for (const u of omOssUndersider) {
    const { docs } = await payload.find({ collection: 'sider', where: { slug: { equals: u.slug } }, limit: 1 })
    if (docs.length > 0) continue
    await payload.create({
      collection: 'sider',
      data: {
        tittel: u.tittel,
        slug: u.slug,
        visIMeny: true,
        rekkefolge: u.rekkefolge,
        foreldreside: sideIder['om-oss'] as number,
        blokker: [{ blockType: 'tekst', innhold: richText(u.tekst) }],
      },
    })
  }

  console.log('Sår "Vårt arbeid"-meny og flytter Barn og unge dit...')
  const { docs: eksisterendeVartArbeid } = await payload.find({ collection: 'sider', where: { slug: { equals: 'vart-arbeid' } }, limit: 1 })
  let vartArbeidId: number
  if (eksisterendeVartArbeid.length > 0) {
    vartArbeidId = eksisterendeVartArbeid[0].id as number
  } else {
    const opprettet = await payload.create({
      collection: 'sider',
      data: {
        tittel: 'Vårt arbeid',
        slug: 'vart-arbeid',
        visIMeny: true,
        rekkefolge: 4,
        blokker: [{ blockType: 'tekst', innhold: richText('(Eksempeltekst) Lillesand Misjonskirke er et fellesskap med plass til alle aldre og livsfaser. Under finner du en oversikt over de faste tilbudene våre — gudstjenester, husgrupper og barne- og ungdomsarbeid.') }],
      },
    })
    vartArbeidId = opprettet.id as number
  }

  const { docs: barnDocs } = await payload.find({ collection: 'sider', where: { slug: { equals: 'barn-og-unge' } }, limit: 1 })
  if (barnDocs.length > 0 && !barnDocs[0].foreldreside) {
    await payload.update({
      collection: 'sider',
      id: barnDocs[0].id,
      data: { foreldreside: vartArbeidId, rekkefolge: 1 },
    })
  }

  const vartArbeidUndersider = [
    {
      slug: 'gudstjeneste',
      tittel: 'Gudstjeneste',
      rekkefolge: 2,
      tekst:
        '(Eksempeltekst)\n\nVi feirer gudstjeneste hver søndag kl. 11:00 i hovedsalen. Gudstjenesten varer omtrent 1,5 time og inneholder lovsang, bønn, en preken og — annenhver søndag — kirkekaffe etterpå.\n\nDet er søndagsskole for barna samtidig med gudstjenesten, og alle er velkomne, uansett bakgrunn eller om du er ny.\n\nSe kalenderen for kommende gudstjenester, temaer og eventuelle endringer.',
    },
    {
      slug: 'husgrupper',
      tittel: 'Husgrupper',
      rekkefolge: 3,
      tekst:
        '(Eksempeltekst)\n\nHusgruppene er mindre fellesskap som møtes hjemme hos hverandre annenhver uke — til bibelsamtale, bønn og sosialt samvær. Dette er stedet der man virkelig blir kjent med hverandre.\n\nEksempel: Husfellesskap Sentrum møtes annenhver onsdag kl. 19:30, på omgang hjemme hos medlemmene.\n\nTa kontakt med kontoret eller lederskapet for å bli koblet på en husgruppe nær deg.',
    },
  ]
  for (const u of vartArbeidUndersider) {
    const { docs } = await payload.find({ collection: 'sider', where: { slug: { equals: u.slug } }, limit: 1 })
    if (docs.length > 0) continue
    await payload.create({
      collection: 'sider',
      data: {
        tittel: u.tittel,
        slug: u.slug,
        visIMeny: true,
        rekkefolge: u.rekkefolge,
        foreldreside: vartArbeidId,
        blokker: [{ blockType: 'tekst', innhold: richText(u.tekst) }],
      },
    })
  }

  console.log('Sår hero-seksjon og "Aktuelt"-nyheter (mockup, med plassholderbilder)...')
  const forsideEksisterende = await payload.findGlobal({ slug: 'forsideinnstillinger' }).catch(() => null)
  if (!forsideEksisterende?.heroBilde) {
    const heroBildeId = await lagPlaceholderBilde(payload, 'Hero-bilde forside', 1600, 700)
    await payload.updateGlobal({
      slug: 'forsideinnstillinger',
      data: {
        heroBilde: heroBildeId,
        heroOverskrift: 'Velkommen til Lillesand Misjonskirke',
        heroKnappTekst: 'Les mer om oss',
        heroKnappLenke: '/om-oss',
      },
    })
  }

  const nyheterData = [
    {
      slug: 'folkemote-host',
      tittel: 'Folkemøte om høsten',
      ingress: 'Vi inviterer til folkemøte med informasjon om semesterets satsinger og felles bønn.',
      tekst: '(Eksempeltekst)\n\nVi inviterer hele menigheten til folkemøte, der vi deler planer for høsten, ser tilbake på sommeren og ber sammen for veien videre.\n\nDet blir enkel bevertning. Alle er velkomne, uansett om du er medlem eller ny i fellesskapet.',
    },
    {
      slug: 'konsert-oktober',
      tittel: 'Konsert i kirken',
      ingress: 'En kveld med lovsang og musikk, åpen for hele familien.',
      tekst: '(Eksempeltekst)\n\nVi ønsker velkommen til en konsertkveld med lokale musikere. Dørene åpner en halvtime før konserten, og det blir kaffe og kaker i pausen.\n\nGratis inngang, kollekt til menighetens arbeid.',
    },
  ]
  for (const n of nyheterData) {
    const { docs } = await payload.find({ collection: 'nyheter', where: { slug: { equals: n.slug } }, limit: 1 })
    if (docs.length > 0) continue
    const bildeId = await lagPlaceholderBilde(payload, n.tittel)
    await payload.create({
      collection: 'nyheter',
      data: {
        tittel: n.tittel,
        slug: n.slug,
        bilde: bildeId,
        ingress: n.ingress,
        innhold: richText(n.tekst),
        publisertDato: new Date().toISOString(),
      },
    })
  }

  console.log('Beregner hierarki-sorteringsnøkler og publiserer sider (utkast/publisering ble skrudd på)...')
  const { docs: alleSiderForSortering } = await payload.find({ collection: 'sider', limit: 200, depth: 0, overrideAccess: true })
  for (const side of alleSiderForSortering) {
    await payload.update({
      collection: 'sider',
      id: side.id,
      data: { rekkefolge: side.rekkefolge, foreldreside: side.foreldreside, _status: 'published' },
      overrideAccess: true,
    })
  }

  const { docs: alleNyheterForPublisering } = await payload.find({ collection: 'nyheter', limit: 200, depth: 0, overrideAccess: true })
  for (const nyhet of alleNyheterForPublisering) {
    await payload.update({
      collection: 'nyheter',
      id: nyhet.id,
      data: { _status: 'published' },
      overrideAccess: true,
    })
  }

  console.log('Ferdig.')
  const visPassord = process.env.SEED_PASSORD ? '(passordet du satte i SEED_PASSORD)' : 'endre-meg-123'
  console.log('Admin (globalRolle=admin): kari.nordmann@eksempel.no / ' + visPassord)
  console.log('Gruppeleder-eksempel (leder Lyd og bilde + Kirkekaffe): ola.hansen@eksempel.no / ' + visPassord)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
