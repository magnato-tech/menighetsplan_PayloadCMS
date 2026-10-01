import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'

async function main() {
  const epost = process.env.BRUKER_EPOST
  const passord = process.env.NYTT_PASSORD
  if (!epost || !passord || passord.length < 12) throw new Error('Mangler e-post eller passord (minst 12 tegn).')
  const payload = await getPayload({ config: await config })
  const { docs } = await payload.find({ collection: 'users', where: { email: { equals: epost } }, limit: 1, overrideAccess: true })
  if (!docs[0]) throw new Error(`Fant ingen bruker med e-post ${epost}.`)
  await payload.update({ collection: 'users', id: docs[0].id, data: { password: passord }, overrideAccess: true })
  console.log(`Passordet for ${epost} er byttet. Logg inn på /admin med det.`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
