import type { CollectionConfig } from 'payload'
import { foerGruppeSlettes } from '@/lib/kaskade'

export const Grupper: CollectionConfig = {
  slug: 'grupper',
  labels: { singular: 'Gruppe', plural: 'Grupper' },
  admin: {
    useAsTitle: 'navn',
    defaultColumns: ['navn', 'kategori', 'ledere'],
    group: 'Program',
  },
  access: {
    read: () => true,
  },
  hooks: {
    beforeDelete: [foerGruppeSlettes],
  },
  fields: [
    {
      name: 'navn',
      type: 'text',
      required: true,
    },
    {
      name: 'kategori',
      type: 'select',
      options: [
        { label: 'Tjenestegruppe', value: 'tjenestegruppe' },
        { label: 'Husgruppe', value: 'husgruppe' },
        { label: 'Strategigruppe', value: 'strategigruppe' },
        { label: 'Ledergruppe', value: 'ledergruppe' },
      ],
    },
    {
      name: 'medlemmer',
      type: 'relationship',
      relationTo: 'users',
      hasMany: true,
    },
    {
      name: 'ledere',
      type: 'relationship',
      relationTo: 'users',
      hasMany: true,
      admin: {
        description: 'Tilsvarer Group.leaderIds — vises som "Leder"/"Hovedleder" på Min side.',
      },
    },
    {
      name: 'varaledere',
      type: 'relationship',
      relationTo: 'users',
      hasMany: true,
      admin: {
        description: 'Tilsvarer Group.deputyLeaderIds — vises som "Nestleder" på Min side.',
      },
    },
    {
      name: 'moteplan',
      type: 'group',
      label: 'Fast møteplan',
      fields: [
        {
          name: 'ukedag',
          type: 'select',
          options: [
            'Mandag',
            'Tirsdag',
            'Onsdag',
            'Torsdag',
            'Fredag',
            'Lørdag',
            'Søndag',
          ].map((d) => ({ label: d, value: d })),
        },
        { name: 'klokkeslett', type: 'text', admin: { placeholder: '09:30' } },
        {
          name: 'frekvens',
          type: 'select',
          options: [
            { label: 'Hver uke', value: 'hver uke' },
            { label: 'Annenhver uke', value: 'annenhver uke' },
            { label: 'Hver måned', value: 'hver måned' },
          ],
        },
      ],
    },
  ],
}
