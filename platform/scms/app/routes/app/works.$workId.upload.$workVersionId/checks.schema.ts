import { z } from 'zod';
import type { WorkVersionCheckName } from '@curvenote/scms-server';

/**
 * Schema for work version check names
 * Defines the available integrity checks that can be run on a work version
 */
export const workVersionCheckNameSchema = z.string(); //z.enum(['curvenote-structure', ...]);

/**
 * Schema for individual check status (generic)
 */
export const checkStatusSchema = z.object({
  dispatched: z.boolean().default(false),
});

/**
 * Schema for the checks object structure
 * Contains an enabled array of check names and optional status objects for each check type
 */
export const checksObjectSchema = z.object({
  enabled: z.array(workVersionCheckNameSchema).default([]),
  'curvenote-structure': checkStatusSchema.optional(),
});

/**
 * Schema for the checks metadata section
 * Contains a checks object with enabled array and check status objects
 */
export const checksMetadataSchema = z.object({
  checks: checksObjectSchema.optional(),
});

export type CheckStatus = z.infer<typeof checkStatusSchema>;
export type ChecksMetadataSection = z.infer<typeof checksMetadataSchema>;
export type ChecksObject = z.infer<typeof checksObjectSchema>;

/**
 * Validation schema for checks metadata
 * Ensures the checks array is valid and contains unique values
 */
export const validateChecksMetadataSchema = checksMetadataSchema.refine(
  (data) => {
    if (!data.checks?.enabled) return true;
    // Ensure no duplicate checks
    const uniqueChecks = new Set(data.checks.enabled);
    return uniqueChecks.size === data.checks.enabled.length;
  },
  {
    message: 'Checks array must not contain duplicates',
    path: ['checks', 'enabled'],
  },
);

// Helper function to validate a single check name
export function isValidCheckName(name: string): name is WorkVersionCheckName {
  return workVersionCheckNameSchema.safeParse(name).success;
}
