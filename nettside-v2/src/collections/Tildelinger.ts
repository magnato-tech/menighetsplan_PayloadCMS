import type { CollectionConfig } from 'payload'
import { innlogget, kunAdmin } from '@/lib/tilgang'

export const Tildelinger: CollectionConfig = {
  slug: 'tildelinger',
  labels: { singular: 'Tildeling', plural: 'Tildelinger' },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['oppgave', 'person', 'svar'],
    group: 'Program',
  },
  access: {
    read: innlogget,
    create: kunAdmin,
    update: kunAdmin,
    delete: kunAdmin,
  },
  fields: [
    {
      name: 'oppgave',
      type: 'relationship',
      relationTo: 'oppgaver',
      required: true,
    },
    {
      name: 'person',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'svar',
      type: 'select',
      options: [
        { label: 'Venter', value: 'pending' },
        { label: 'Bekreftet', value: 'confirmed' },
        { label: 'Avslått', value: 'declined' },
        { label: 'Trukket tilbake', value: 'withdrawn' },
      ],
      defaultValue: 'pending',
    },
  ],
}
