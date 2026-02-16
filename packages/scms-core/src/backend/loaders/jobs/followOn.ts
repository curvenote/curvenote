import { z } from 'zod';
import type { FollowOnEnvelope, FollowOnSpec } from './types.js';

/** Inline JSON Schema for the follow_on object (stored in Job.follow_on.$schema). */
export const FOLLOW_ON_JSON_SCHEMA: Record<string, any> = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'urn:curvenote:scms:job-follow-on:1-0-0',
  type: 'object',
  additionalProperties: false,
  properties: {
    on_success: {
      type: 'object',
      required: ['job_type', 'payload'],
      additionalProperties: false,
      properties: {
        job_type: { type: 'string' },
        id: { type: 'string', format: 'uuid' },
        payload: { type: 'object' },
        activity_type: { type: 'string' },
        activity_data: { type: 'object' },
      },
    },
  },
  required: ['on_success'],
};

/**
 * Build the canonical follow_on envelope with $schema for storage.
 * Call this when creating a job with follow-on so the stored JSON always includes the schema.
 */
export function buildFollowOnEnvelope(spec: FollowOnSpec): FollowOnEnvelope {
  return {
    $schema: { ...FOLLOW_ON_JSON_SCHEMA },
    on_success: spec,
  };
}

/**
 * Create Zod schemas for validating follow_on.
 * - FollowOnSchema: strict (job_type must be in jobTypes); use for API create body.
 * - FollowOnSchemaRelaxed: job_type is any string; use when consuming stored follow_on (e.g. trigger).
 */
export function createFollowOnSchemas(jobTypes: readonly string[]) {
  const JobTypeEnum = z.enum(jobTypes as [string, ...string[]]);

  const OnSuccessSpecSchema = z.object({
    job_type: JobTypeEnum,
    id: z.string().uuid().optional(),
    payload: z.record(z.string().min(1), z.any()),
    activity_type: z.string().optional(),
    activity_data: z.record(z.string(), z.unknown()).optional(),
  });

  const OnSuccessSpecSchemaRelaxed = z.object({
    job_type: z.string(),
    id: z.string().uuid().optional(),
    payload: z.record(z.string().min(1), z.any()),
    activity_type: z.string().optional(),
    activity_data: z.record(z.string(), z.unknown()).optional(),
  });

  const FollowOnSchema = z.object({
    $schema: z.record(z.string(), z.any()),
    on_success: OnSuccessSpecSchema,
  });

  const FollowOnSchemaRelaxed = z.object({
    $schema: z.record(z.string(), z.any()),
    on_success: OnSuccessSpecSchemaRelaxed,
  });

  return { FollowOnSchema, FollowOnSchemaRelaxed };
}
