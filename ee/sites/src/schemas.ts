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

/**
 * JSON Schema for form submission metadata fields (object.data and workVersion.metadata.fields).
 * Matches the example form: title, abstract, keywords, format, license, authors, affiliations,
 * contact details, and collectionId.
 */
export const FORM_METADATA_FIELDS_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  description:
    'Schema for form submission metadata fields stored in draft object.data and work version metadata.fields.',
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Work title' },
    abstract: { type: 'string', description: 'Abstract / description' },
    keywords: {
      type: 'array',
      items: { type: 'string' },
      description: 'Keywords',
    },
    format: { type: 'string', description: 'Presentation format (e.g. poster, presentation)' },
    license: { type: 'string', description: 'License choice (e.g. CC-BY-4.0, Other)' },
    authors: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          corresponding: { type: 'boolean' },
          orcid: { type: 'string' },
          affiliationIds: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['id', 'name'],
      },
      description: 'Authors with optional email, corresponding, orcid, affiliationIds',
    },
    affiliations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          ror: { type: 'string' },
          department: { type: 'string' },
          address: { type: 'string' },
          city: { type: 'string' },
          country: { type: 'string' },
          email: { type: 'string' },
        },
        required: ['id', 'name'],
      },
      description: 'Affiliations list referenced by authors',
    },
    contactName: { type: 'string', description: 'Submitter display name' },
    contactEmail: { type: 'string', description: 'Submitter email' },
    contactOrcidId: { type: 'string', description: 'Submitter ORCID id' },
    collectionId: { type: 'string', description: 'Selected collection id for submission' },
  },
};
