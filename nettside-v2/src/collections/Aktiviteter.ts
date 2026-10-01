import type { CollectionConfig } from 'payload'
import { foerAktivitetSlettes } from '@/lib/kaskade'

export const Aktiviteter: CollectionConfig = {
  slug: 'aktiviteter',
  labels: { singular: 'Aktivitet', plural: 'Aktiviteter' },
  admin: {
    useAsTitle: 'tittel',
    defaultColumns: ['tittel', 'gruppe', 'start', 'erGudstjeneste', 'avlyst'],
    group: 'Program',
  },
  defaultSort: 'start',
  access: {
    read: () => true,
  },
  hooks: {
    beforeDelete: [foerAktivitetSlettes],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Grunninfo',
          fields: [
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
              name: 'bilde',
              type: 'upload',
              relationTo: 'media',
              required: true,
              admin: {
                description: 'Vises i arrangementslisten på forsiden, i kalenderen og på arrangementets egen side.',
              },
            },
            {
              name: 'start',
              type: 'date',
              required: true,
              admin: { date: { pickerAppearance: 'dayAndTime' } },
            },
            {
              name: 'slutt',
              type: 'date',
              admin: { date: { pickerAppearance: 'dayAndTime' } },
            },
            {
              name: 'sted',
              type: 'text',
            },
            {
              name: 'type',
              type: 'select',
              options: [
                { label: 'Arrangement', value: 'arrangement' },
                { label: 'Gruppesamling', value: 'gruppesamling' },
              ],
              defaultValue: 'arrangement',
            },
          ],
        },
        {
          label: 'Innhold og program',
          fields: [
            {
              name: 'tema',
              type: 'text',
            },
            {
              name: 'bibeltekst',
              type: 'text',
            },
            {
              name: 'program',
              type: 'array',
              label: 'Programpunkter',
              fields: [
                { name: 'klokkeslett', type: 'text', required: true },
                { name: 'tittel', type: 'text', required: true },
                { name: 'beskrivelse', type: 'textarea' },
                { name: 'oppgave', type: 'relationship', relationTo: 'oppgaver' },
              ],
            },
          ],
        },
        {
          label: 'Status og varsling',
          fields: [
            {
              name: 'vert',
              type: 'relationship',
              relationTo: 'users',
            },
            {
              name: 'invitasjonSendt',
              type: 'checkbox',
              defaultValue: false,
            },
            {
              name: 'invitasjonSendtDato',
              type: 'date',
              admin: { condition: (data) => data?.invitasjonSendt },
            },
            {
              name: 'offentlig',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                description: 'Tilsvarer Gathering.isPublic — vises på den offentlige nettsiden når huket av.',
              },
            },
            {
              name: 'erGudstjeneste',
              type: 'checkbox',
              defaultValue: false,
            },
            {
              name: 'avlyst',
              type: 'checkbox',
              defaultValue: false,
            },
          ],
        },
      ],
    },
  ],
}
