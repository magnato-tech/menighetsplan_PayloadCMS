import { postgresAdapter } from '@payloadcms/db-postgres'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import fs from 'fs'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Sider } from './collections/Sider'
import { Nyheter } from './collections/Nyheter'
import { Aktiviteter } from './collections/Aktiviteter'
import { Grupper } from './collections/Grupper'
import { Oppgaver } from './collections/Oppgaver'
import { Tildelinger } from './collections/Tildelinger'
import { GruppeMeldinger } from './collections/GruppeMeldinger'
import { Oppmoter } from './collections/Oppmoter'
import { Forsideinnstillinger } from './globals/Forsideinnstillinger'

// SQLite-filen trenger at mappen finnes (demo uten Postgres).
if (!(process.env.DATABASE_URL || '').startsWith('postgres') && !process.env.SQLITE_URL) {
  fs.mkdirSync(path.resolve(process.cwd(), 'data'), { recursive: true })
}

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      beforeDashboard: ['/components/admin/Dashboard#Dashboard'],
    },
  },
  collections: [Users, Media, Sider, Nyheter, Aktiviteter, Grupper, Oppgaver, Tildelinger, GruppeMeldinger, Oppmoter],
  globals: [Forsideinnstillinger],
  editor: lexicalEditor(),
  // Reserveverdi KUN for demo (AI Studio/lokalt). Sett alltid PAYLOAD_SECRET i ekte drift.
  secret: process.env.PAYLOAD_SECRET || 'demo-hemmelighet-ikke-for-produksjon',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  // Postgres hvis DATABASE_URL peker på en postgres-database, ellers en lokal SQLite-fil (demo/AI Studio).
  db: (process.env.DATABASE_URL || '').startsWith('postgres')
    ? postgresAdapter({
        pool: {
          connectionString: process.env.DATABASE_URL || '',
        },
        // PAYLOAD_DB_PUSH=false: bygg tabellene bare med migrasjoner (brukes når testene kjører mot Neon).
        ...(process.env.PAYLOAD_DB_PUSH === 'false' ? { push: false } : {}),
      })
    : sqliteAdapter({
        client: { url: process.env.SQLITE_URL || 'file:./data/nettside.db' },
      }),
  plugins: [
    // Bilder i Vercel Blob når BLOB_READ_WRITE_TOKEN er satt (Vercel). Ellers lokal disk (media/).
    // alwaysInsertFields holder databaseskjemaet likt i alle miljøer.
    vercelBlobStorage({
      collections: { media: true },
      token: process.env.BLOB_READ_WRITE_TOKEN,
      alwaysInsertFields: true,
    }),
  ],
  sharp,
})
