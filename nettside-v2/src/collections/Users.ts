import type { CollectionConfig } from 'payload'
import { foerPersonSlettes } from '@/lib/kaskade'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Person', plural: 'Personer' },
  admin: {
    useAsTitle: 'navn',
    defaultColumns: ['navn', 'email', 'globalRolle'],
    group: 'Brukere',
  },
  auth: true,
  hooks: {
    beforeDelete: [foerPersonSlettes],
  },
  fields: [
    {
      name: 'navn',
      type: 'text',
      required: true,
    },
    {
      name: 'globalRolle',
      type: 'select',
      options: [
        { label: 'Medlem', value: 'member' },
        { label: 'Administrator', value: 'admin' },
      ],
      defaultValue: 'member',
      required: true,
      admin: {
        description:
          'Tilsvarer Person.globalRole i Menighetsplan-appen. Om noen er gruppeleder styres av Grupper.ledere/varaledere, ikke av et felt her.',
      },
    },
    {
      name: 'telefon',
      type: 'text',
    },
  ],
  versions: false,
}
