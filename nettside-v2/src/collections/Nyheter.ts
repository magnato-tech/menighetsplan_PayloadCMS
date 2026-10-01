import type { CollectionConfig } from 'payload'
import { kunAdmin } from '@/lib/tilgang'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

export const Nyheter: CollectionConfig = {
  slug: 'nyheter',
  labels: { singular: 'Nyhet', plural: 'Nyheter' },
  admin: {
    useAsTitle: 'tittel',
    defaultColumns: ['tittel', '_status', 'publisertDato'],
    group: 'Innhold',
  },
  versions: {
    drafts: true,
  },
  access: {
    read: ({ req }) => {
      if (req.user) return true
      return { _status: { equals: 'published' } }
    },
    create: kunAdmin,
    update: kunAdmin,
    delete: kunAdmin,
  },
  fields: [
    {
      name: 'tittel',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Brukes i URL-en, f.eks. "menighetsskolen-modul-3".',
      },
    },
    {
      name: 'bilde',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'ingress',
      type: 'textarea',
      admin: {
        description: 'Kort tekst som vises på forsiden sammen med bildet.',
      },
    },
    {
      name: 'innhold',
      type: 'richText',
      editor: lexicalEditor(),
    },
    {
      name: 'publisertDato',
      type: 'date',
      defaultValue: () => new Date().toISOString(),
    },
  ],
}
