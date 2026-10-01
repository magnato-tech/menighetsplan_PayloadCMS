import type { CollectionConfig } from 'payload'
import { innlogget, kunAdmin } from '@/lib/tilgang'
import { foerOppgaveSlettes } from '@/lib/kaskade'

export const Oppgaver: CollectionConfig = {
  slug: 'oppgaver',
  labels: { singular: 'Oppgave', plural: 'Oppgaver' },
  admin: {
    useAsTitle: 'tittel',
    defaultColumns: ['tittel', 'aktivitet', 'gruppe', 'status'],
    group: 'Program',
  },
  access: {
    read: innlogget,
    create: kunAdmin,
    update: kunAdmin,
    delete: kunAdmin,
  },
  hooks: {
    beforeDelete: [foerOppgaveSlettes],
  },
  fields: [
    {
      name: 'aktivitet',
      type: 'relationship',
      relationTo: 'aktiviteter',
      required: true,
    },
    {
      name: 'gruppe',
      type: 'relationship',
      relationTo: 'grupper',
      required: true,
    },
    {
      name: 'tittel',
      type: 'text',
      required: true,
    },
    {
      name: 'beskrivelse',
      type: 'textarea',
    },
    {
      name: 'instruksjon',
      type: 'textarea',
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Åpen', value: 'open' },
        { label: 'Tildelt', value: 'assigned' },
        { label: 'Bekreftet', value: 'confirmed' },
        { label: 'Ledig (vakant)', value: 'vacant' },
        { label: 'Avlyst', value: 'cancelled' },
      ],
      defaultValue: 'open',
    },
    {
      name: 'antallTrengs',
      type: 'number',
      defaultValue: 1,
      admin: { description: 'Tilsvarer Task.neededCount' },
    },
  ],
}
