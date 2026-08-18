import { z } from 'zod';

const ExtractedAuthorSchema = z.object({
  name: z.string(),
  id: z.string().optional(),
  orcid: z.string().optional(),
  corresponding: z.boolean().optional(),
  email: z.string().optional(),
  affiliations: z.array(z.string()).optional(),
  equal_contributor: z.boolean().optional(),
  deceased: z.boolean().optional(),
  note: z.string().optional(),
});

const ExtractedAffiliationSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  institution: z.string().optional(),
  department: z.string().optional(),
  ror: z.string().optional(),
  doi: z.string().optional(),
  isni: z.string().optional(),
});

/**
 * MyST Markdown frontmatter subset extracted from the first page of a document.
 * Shared by upload UI and server-side extraction.
 */
export const ExtractedMetadataSchema = z.object({
  title: z.string().optional(),
  authors: z.array(ExtractedAuthorSchema).optional(),
  affiliations: z.array(ExtractedAffiliationSchema).optional(),
  doi: z.string().optional(),
});

export type ExtractedMetadata = z.infer<typeof ExtractedMetadataSchema>;
