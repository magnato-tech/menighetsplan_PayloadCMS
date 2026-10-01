import type { CollectionConfig } from 'payload'

export const GruppeMeldinger: CollectionConfig = {
  slug: 'gruppemeldinger',
  labels: { singular: 'Gruppemelding', plural: 'Gruppemeldinger' },
  admin: {
    useAsTitle: 'innhold',
    defaultColumns: ['gruppe', 'avsender', 'createdAt'],
    group: 'Kommunikasjon',
  },
  defaultSort: '-createdAt',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'gruppe',
      type: 'relationship',
      relationTo: 'grupper',
      required: true,
    },
    {
      name: 'avsender',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'innhold',
      type: 'textarea',
      required: true,
    },
    {
      name: 'bilde',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'type',
      type: 'select',
      options: [
        { label: 'Melding', value: 'melding' },
        { label: 'Systemmelding', value: 'system' },
      ],
      defaultValue: 'melding',
      admin: { description: 'Systemmeldinger skrives automatisk når noen tar en oppgave, melder forfall osv.' },
    },
  ],
}
