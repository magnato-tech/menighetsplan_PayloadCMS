import type { CollectionConfig } from 'payload'
import { adminFelt, egenEllerAdmin, kanBrukeAdminpanel, kunAdmin } from '@/lib/tilgang'
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
  access: {
    admin: kanBrukeAdminpanel,
    read: egenEllerAdmin,
    create: kunAdmin,
    update: egenEllerAdmin,
    delete: kunAdmin,
  },
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
      access: { create: adminFelt, update: adminFelt },
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
