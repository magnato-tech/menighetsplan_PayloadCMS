import type { CollectionConfig } from 'payload'
import { kunAdmin } from '@/lib/tilgang'
import path from 'path'
import { fileURLToPath } from 'url'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Bilde', plural: 'Bilder' },
  admin: {
    group: 'Innhold',
  },
  access: {
    read: () => true,
    create: kunAdmin,
    update: kunAdmin,
    delete: kunAdmin,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      label: 'Alt-tekst',
      required: true,
    },
  ],
  upload: {
    staticDir: path.resolve(dirname, '../../media'),
    mimeTypes: ['image/*'],
  },
}
