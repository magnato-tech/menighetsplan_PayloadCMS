// Brukes av scripts/vercel-build.mjs: avslutter med kode 10 hvis databasen mangler brukere (tom),
// 0 hvis den allerede har data. Endrer ingenting.
import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@/payload.config'

const payload = await getPayload({ config })
const { totalDocs } = await payload.count({ collection: 'users', overrideAccess: true })
console.log(`Antall brukere i databasen: ${totalDocs}`)
process.exit(totalDocs === 0 ? 10 : 0)
