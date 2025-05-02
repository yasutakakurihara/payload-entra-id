import { CollectionConfig } from 'payload/types'

export const Redirects: CollectionConfig = {
  slug: 'redirects',
  admin: {
    useAsTitle: 'from',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'from',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'to',
      type: 'text',
      required: true,
    },
    {
      name: 'permanent',
      type: 'checkbox',
      defaultValue: false,
      label: 'Is this a permanent (301) redirect?',
    },
  ],
}
