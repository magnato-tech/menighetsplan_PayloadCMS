// Bygg-steg for Vercel (Vercel kjører `vercel-build` i stedet for `build` når den finnes).
//
// 1. Migrerer Postgres-databasen (Payload lager ikke tabeller selv i produksjon).
// 2. Hvis databasen er tom OG SEED_PASSORD er satt: fyller den med demodata.
// 3. Bygger Next.js-appen.
//
// Miljøvariabler (settes i Vercel, aldri i git):
//   DATABASE_URL        postgres://… (Neon). Uten den brukes SQLite (kun lokalt).
//   PAYLOAD_SECRET      lang tilfeldig streng
//   BLOB_READ_WRITE_TOKEN  (settes av Vercel når Blob-lagring kobles til prosjektet)
//   SEED_PASSORD        (valgfri) passord, minst 12 tegn, for demobrukerne ved første fylling
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
// NODE_ENV=production hindrer at Payload kjører «push» i utviklingsmodus mot databasen.
// Uten det legger verktøyene inn en utviklings-markering, og neste payload migrate stopper og spør
// interaktivt (hengende bygg). Bare migrasjoner skal endre skjemaet.
const env = {
  ...process.env,
  NODE_ENV: 'production',
  NODE_OPTIONS: '--no-deprecation --max-old-space-size=4096',
}

function kjor(args, tillat = []) {
  console.log(`\n> npx ${args.join(' ')}`)
  const r = spawnSync(npx, args, { cwd: app, stdio: 'inherit', env, shell: process.platform === 'win32' })
  if (r.status !== 0 && !tillat.includes(r.status)) {
    console.error(`Feilet: npx ${args.join(' ')} (kode ${r.status})`)
    process.exit(r.status ?? 1)
  }
  return r.status
}

const harPostgres = (process.env.DATABASE_URL || '').startsWith('postgres')

if (harPostgres) {
  kjor(['payload', 'migrate'])

  const status = kjor(['tsx', 'src/seed/erTom.ts'], [10])
  if (status === 10) {
    if (process.env.SEED_PASSORD) {
      if (process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN) {
        console.error('\nAvbryter: koble en Vercel Blob-lagring til prosjektet FØR første deploy (Storage → Blob → Connect).')
        console.error('Uten den havner demobildene på byggemaskinens disk og forsvinner.')
        process.exit(1)
      }
      console.log('\nDatabasen er tom: fyller med demodata.')
      kjor(['tsx', 'src/seed/index.ts'])
    } else {
      console.log('\nDatabasen er tom. Sett SEED_PASSORD (minst 12 tegn) i Vercel for å fylle den med demodata.')
    }
  }
} else {
  console.log('Ingen Postgres-DATABASE_URL: hopper over migrering (SQLite brukes bare lokalt).')
}

kjor(['next', 'build'])
