/* eslint-disable import/no-named-as-default-member */
import { z } from 'zod';
import { KnownBuckets } from '../../../storage/constants.server.js';

/*
 * Zod schemas for validating and typing job payload and result objects
 * We are expecting general validation to happen at the route loader level
 * so cn assume we have a valid job_type and payload & result objects
 */

export const CreatePublishJobPayloadSchema = z.object({
  site_id: z.uuid(),
  user_id: z.string().min(1),
  submission_version_id: z.uuid(),
  cdn: z.url(),
  key: z.uuid(),
  date_published: z.iso.date('Date must be in YYYY-MM-DD format').optional(),
  updates_slug: z.boolean().optional(),
});

export type CreatePublishJobPayload = z.infer<typeof CreatePublishJobPayloadSchema>;

export const PublishJobResultsSchema = z
  .object({
    files_transfered: z.boolean().optional(),
    work_version_updated: z.boolean().optional(),
    submission_updated: z.boolean().optional(),
    slug_updated: z.boolean().optional(),
    date_published_updated: z.boolean().optional(),
    cdn: z.url().optional(),
    key: z.uuid().optional(),
  })
  .refine((input) => {
    if (input.files_transfered) return input.cdn && input.key;
    return true;
  });

export type PublishJobResults = z.infer<typeof PublishJobResultsSchema>;

export const UnpublishJobResultsSchema = z.object({});
export type UnpublishJobResults = z.infer<typeof UnpublishJobResultsSchema>;

export const CreateStorageMoveJobPayloadSchema = z.object({
  from: z.object({
    bucket: z.nativeEnum(KnownBuckets),
    path: z.string().min(1),
  }),
  to: z.object({
    bucket: z.nativeEnum(KnownBuckets),
    path: z.string().min(1),
  }),
});

export type CreateStorageMoveJobPayload = z.infer<typeof CreateStorageMoveJobPayloadSchema>;

export const CreateStorageRemoveJobPayloadSchema = z.object({
  bucket: z.nativeEnum(KnownBuckets),
  path: z.string().min(1),
});

export type CreateStorageRemoveJobPayload = z.infer<typeof CreateStorageRemoveJobPayloadSchema>;
