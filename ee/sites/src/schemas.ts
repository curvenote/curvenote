/**
 * Schema for title and description data - used by forms, kinds, collections, etc.
 * Contains optional title and description properties
 */
export const TITLE_DESCRIPTION_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  description: 'Basic schema for optional title and description fields.',
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'Display title',
    },
    description: {
      type: 'string',
      description: 'Description text',
    },
  },
};
