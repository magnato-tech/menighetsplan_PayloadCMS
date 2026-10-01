import type { GlobalConfig } from 'payload'
import { kunAdmin } from '@/lib/tilgang'

export const Forsideinnstillinger: GlobalConfig = {
  slug: 'forsideinnstillinger',
  label: 'Forsideinnstillinger',
  access: {
    read: () => true,
    update: kunAdmin,
  },
  fields: [
    {
      name: 'heroBilde',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Bakgrunnsbilde for hero-seksjonen øverst på forsiden.',
      },
    },
    {
      name: 'heroOverskrift',
      type: 'textarea',
      defaultValue: 'Velkommen til Lillesand Misjonskirke',
    },
    {
      name: 'heroKnappTekst',
      type: 'text',
      defaultValue: 'Les mer',
    },
    {
      name: 'heroKnappLenke',
      type: 'text',
      defaultValue: '/om-oss',
    },
  ],
}
