/* eslint-disable import/no-named-as-default-member */
import type { ZodError } from 'zod';
import { z } from 'zod';
import { $Enums } from '@curvenote/scms-db';
import type { ClientExtension, ServerExtension } from '@curvenote/scms-core';
import { httpError, KnownJobTypes } from '@curvenote/scms-core';
import { registerExtensionJobs } from './modules/extensions/jobs.js';

/**
 * Validates data against a Zod schema and returns the parsed result.
 * Throws a Bad Request error if validation fails.
 *
 * @template U The Zod schema type extending AnyZodObject
 * @param {U} schema - The Zod schema to validate against
 * @param {any} data - The data to validate
 * @returns {z.infer<typeof schema>} The validated and parsed data
 * @throws {Error} Throws an HTTP 400 error with detailed validation issues if validation fails
 */
export function validate<U extends z.ZodObject<any>>(schema: U, data: any): z.infer<typeof schema> {
  try {
    return schema.parse(data) as z.infer<typeof schema>;
  } catch (error: any) {
    const statusText = (error as ZodError).issues.reduce((acc, issue) => {
      const { message, code, path, expected, received } = issue as any;
      let msg = `${message}[${code}](path: ${path.join('.')}`;
      if (expected) msg += `, expected: ${expected}`;
      if (received) msg += `, received: ${received}`;
      msg += ')';
      return acc.length > 0 ? `${acc}, ${msg}` : msg;
    }, '');
    throw httpError(400, statusText);
  }
}

export const CreateMystWorkPostBodySchema = z.object({
  cdn: z.url({
    error: (issue) => (issue.input === undefined ? 'cdn is required (url)' : undefined),
  }),
  cdn_key: z.uuid({
    error: (issue) => (issue.input === undefined ? 'cdn_key is required (uuid)' : undefined),
  }),
  // unique user-provided identifier for work
  key: z
    .string({
      error: (issue) =>
        issue.input === undefined ? 'key is required ([a-zA-Z][a-zA-Z0-9_-])' : undefined,
    })
    .min(8, { error: 'key must be at least 8 characters' })
    .max(128, { error: 'key must be less than 128 characters' })
    .regex(/[a-zA-Z][a-zA-Z0-9_-]{7,127}/)
    .optional(),
});

export type CreateMystWorkPostBody = z.infer<typeof CreateMystWorkPostBodySchema>;

export const UpdateWorkPatchBodySchema = z.object({
  // unique user-provided identifier for work
  key: z
    .string()
    .regex(/[a-zA-Z][a-zA-Z0-9_-]{7,49}/)
    .describe('unique user-provided identifier for work'),
});

export type UpdateWorkPatchBody = z.infer<typeof UpdateWorkPatchBodySchema>;

export const UpdateWorkPostBodySchema = CreateMystWorkPostBodySchema.extend({
  workId: z.uuid({
    error: (issue) =>
      issue.input === undefined ? 'the id of an existing Work is required (uuid)' : undefined,
  }),
});

export type UpdateWorkPostBody = z.infer<typeof UpdateWorkPostBodySchema>;

export const CreateSubmissionPostBodySchema = z.object({
  work_version_id: z.uuid(),
  kind: z.string().min(1).max(255).optional(), // TODO deprecate in favor of kind_id
  kind_id: z.uuid().optional(),
  draft: z.boolean().optional(),
  job_id: z.uuid(),
  collection_id: z.uuid().optional(),
});

export type CreateSubmissionPostBody = z.infer<typeof CreateSubmissionPostBodySchema>;

export const CreateSubmissionVersionPostBodySchema = z.object({
  work_version_id: z.uuid(),
  job_id: z.uuid(),
});

export type CreateSubmissionVersionPostBody = z.infer<typeof CreateSubmissionVersionPostBodySchema>;

async function getJobTypes(extensions: ServerExtension[]): Promise<readonly string[]> {
  const coreJobTypes = [
    KnownJobTypes.CHECK,
    KnownJobTypes.CLI_CHECK,
    KnownJobTypes.PUBLISH,
    KnownJobTypes.UNPUBLISH,
  ];
  const extensionJobTypes = registerExtensionJobs(extensions).map((job) => job.jobType);
  return [...coreJobTypes, ...extensionJobTypes] as const;
}

export async function createJobPostBodySchema(extensions: ClientExtension[]) {
  const JOB_TYPES = await getJobTypes(extensions);
  return z.object({
    id: z.uuid().optional(),
    job_type: z
      .enum(JOB_TYPES as [string, ...string[]], {
        error: () => `job_type must be ${JOB_TYPES.join(', ')} (case sensitive)`,
      })
      .default('CHECK'),
    payload: z.record(z.string().min(0), z.any(), {
      error: (issue) => (issue.input === undefined ? 'a payload object is required' : undefined),
    }),
    results: z
      .record(z.string().min(0), z.any(), {
        error: (issue) => (issue.code === 'invalid_type' ? 'results must be an object' : undefined),
      })
      .optional(),
  });
}

export const UpdateJobPatchBodySchema = z.object({
  status: z.nativeEnum($Enums.JobStatus, {
    error: () => `status must be ${Object.values($Enums.JobStatus).join(', ')}`,
  }),
  message: z
    .string({
      error: (issue) => (issue.code === 'invalid_type' ? `message must be a string` : undefined),
    })
    .optional(),
  results: z
    .record(z.string().min(0), z.any(), {
      error: (issue) => (issue.code === 'invalid_type' ? 'an object is required' : undefined),
    })
    .optional(),
});

export const CreateSignedUrlPostBodySchema = z.object({
  baseUrl: z.string().url('baseUrl must be a valid url'),
});

export type CreateSignedUrlPostBody = z.infer<typeof CreateSignedUrlPostBodySchema>;

export const UploadStagePostBodySchema = z.object({
  files: z.array(
    z.object({
      path: z.string(),
      content_type: z.string(),
      md5: z.string(),
      size: z.number(),
    }),
  ),
});
export type UploadStagePostBody = z.infer<typeof UploadStagePostBodySchema>;

export const UploadCommitPostBodySchema = z.object({
  cdn: z.url(),
  cdnKey: z.uuid(),
  files: z.array(
    z.object({
      path: z.string(),
      content_type: z.string(),
      md5: z.string(),
      size: z.number(),
    }),
  ),
});
export type UploadCommitPostBody = z.infer<typeof UploadCommitPostBodySchema>;

const CURVE_SPACE = /^(?:(?:https?:)?\/\/)?([a-z0-9_]{3,20})(?:-([a-z0-9_]{1,30}))?\.curve\.space$/;

/**
 * Test if the string is a valid curvespace domain.
 *
 * For example: `https://some.curve.space`
 *
 * @param test the URL to test
 * @returns
 */
export function isCurvespaceDomain(test: string): boolean {
  if (!test) return false;
  return !!test.match(CURVE_SPACE);
}

/**
 * Extract the information from a valid curvespace domain.
 * There is one subdomain per team/user, with an optional sub-site,
 * which is separated by a `-`.
 *
 * For example:
 *  - `username.curve.space`
 *  - `username-mysite.curve.space`
 *
 * Usernames and sites can include
 *
 * @param test the URL to test
 * @returns
 */
export function getCurvespaceParts(test: string): [string | null, string | null] {
  const match = test.match(CURVE_SPACE);
  if (!match) return [null, null];
  return [match[1], match[2] ?? null];
}

export function createCurvespaceDomain(name: string, sub?: string | null): string {
  const url = (sub ? `${name}-${sub}.curve.space` : `${name}.curve.space`).toLowerCase();
  if (!isCurvespaceDomain(url)) throw new Error(`The domain "${url}" is not valid`);
  return url;
}

export function createCurvespaceUrl(name: string, sub?: string | null): string {
  return `https://${createCurvespaceDomain(name, sub)}`;
}

/**
 * Return true if value is (1) valid .curve.space domain or (2) unrelated subdomain
 */
function isCurvespaceOrSubdomain(value: string) {
  if (isCurvespaceDomain(value)) return true;
  if (value.toLowerCase().endsWith('.curve.space')) return false;
  if (!value.startsWith('https://') && !value.startsWith('http://')) {
    value = `http://${value}`;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  const { hash, host, pathname, protocol, search } = url;
  if (protocol !== 'http:' && protocol !== 'https:') return false;
  if ((pathname && pathname !== '/') || hash || search) return false;
  const numParts = host.split('.').length;
  if (numParts < 3) return false;
  return true;
}

export const CreateDnsRouterPostBodySchema = z.object({
  cdn: z
    .string({
      error: (issue) => (issue.input === undefined ? 'cdn is required (url)' : undefined),
    })
    .url(),
  cdn_key: z
    .string({
      error: (issue) => (issue.input === undefined ? 'cdn_key is required (uuid)' : undefined),
    })
    .uuid(),
  domain: z.string().refine(isCurvespaceOrSubdomain, {
    message: 'domain must be valid .curve.space domain or a subdomain you own',
  }),
});
