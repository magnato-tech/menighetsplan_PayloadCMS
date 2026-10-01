// Kommandolinje: `npm run seed`. Selve seedingen ligger i demodata.ts (som også brukes til tilbakestilling av demo).
import 'dotenv/config'
import { seedDemodata } from './demodata'

seedDemodata()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })