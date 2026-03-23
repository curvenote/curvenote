import { z } from 'zod';

// ---------------------------------------------------------------------------
// Checks section — describes WorkVersion.metadata.checks
// ---------------------------------------------------------------------------

/**
 * Schema for work version check names.
 * Currently a plain string; can be narrowed to an enum as check types stabilize.
 */
export const workVersionCheckNameSchema = z.string();

/** Schema for individual check dispatch status */
export const checkStatusSchema = z.object({
  dispatched: z.boolean().default(false),
});

/**
 * Schema for the checks object structure.
 * Contains an enabled array of check names and optional status objects for each check type.
 */
export const checksObjectSchema = z.object({
  enabled: z.array(workVersionCheckNameSchema).default([]),
  'curvenote-structure': checkStatusSchema.optional(),
});

/** Schema for the checks metadata section */
export const ChecksMetadataSchema = z.object({
  checks: checksObjectSchema.optional(),
});

export type ChecksMetadata = z.infer<typeof ChecksMetadataSchema>;

/**
 * Validation schema for checks metadata.
 * Ensures the checks array contains unique values.
 */
export const validateChecksMetadataSchema = ChecksMetadataSchema.refine(
  (data) => {
    if (!data.checks?.enabled) return true;
    const uniqueChecks = new Set(data.checks.enabled);
    return uniqueChecks.size === data.checks.enabled.length;
  },
  {
    message: 'Checks array must not contain duplicates',
    path: ['checks', 'enabled'],
  },
);

export type WorkVersionCheckName = string;
export type CheckStatus = z.infer<typeof checkStatusSchema>;
export type ChecksObject = z.infer<typeof checksObjectSchema>;
export type ChecksMetadataSection = z.infer<typeof ChecksMetadataSchema>;

/** Helper to validate a single check name */
export function isValidCheckName(name: string): name is WorkVersionCheckName {
  return workVersionCheckNameSchema.safeParse(name).success;
}
