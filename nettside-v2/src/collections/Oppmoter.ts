import type { CollectionConfig } from 'payload'
import { innlogget, kunAdmin } from '@/lib/tilgang'

export const Oppmoter: CollectionConfig = {
  slug: 'oppmoter',
  labels: { singular: 'Oppmøte (RSVP)', plural: 'Oppmøter (RSVP)' },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['aktivitet', 'person', 'status'],
    group: 'Kommunikasjon',
  },
  access: {
    read: innlogget,
    create: kunAdmin,
    update: kunAdmin,
    delete: kunAdmin,
  },
  fields: [
    {
      name: 'aktivitet',
      type: 'relationship',
      relationTo: 'aktiviteter',
      required: true,
    },
    {
      name: 'person',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Kommer', value: 'attending' },
        { label: 'Kommer ikke', value: 'declined' },
      ],
      required: true,
    },
  ],
}
