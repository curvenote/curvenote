import { works } from '@curvenote/scms-server';
import { WORK_UPLOAD_CONFIGURATION } from './uploadConfig.server';
import type { FileUploadConfig } from '@curvenote/scms-core';

type WorkAndVersionsDBO = NonNullable<Awaited<ReturnType<typeof works.dbGetWork>>>;
type WorkVersionDBO = NonNullable<WorkAndVersionsDBO['versions']>[number];

type ValidationError = {
  error: {
    type: string;
    message: string;
    details?: any;
  };
  status: number;
};

type ValidationSuccess = {
  success: true;
  work: NonNullable<WorkAndVersionsDBO>;
  workVersion: WorkVersionDBO;
  uploadConfig: FileUploadConfig;
  cdn: string;
};

export type ValidationResult = ValidationError | ValidationSuccess;

/**
 * Validates work, work version, and upload configuration for upload actions.
 * Returns either an error object or the validated data.
 *
 * @param workId - The work ID
 * @param workVersionId - The work version ID
 * @param slot - The upload slot name
 * @returns Either an error object or a success object with validated data
 */
export async function validateUploadParams(
  workId: string,
  workVersionId: string,
  slot: string,
): Promise<ValidationResult> {
  // Get the full work with versions
  const work = await works.dbGetWork(workId);

  if (!work || !work.versions || work.versions.length === 0) {
    return {
      error: {
        type: 'general',
        message: 'Work not found',
      },
      status: 404,
    };
  }

  // Find the specific work version
  const workVersion = work.versions.find((v) => v.id === workVersionId);

  if (!workVersion) {
    return {
      error: {
        type: 'general',
        message: 'Work version not found',
      },
      status: 404,
    };
  }

  if (!workVersion.draft) {
    return {
      error: { type: 'general', message: 'Cannot upload to non-draft work version' },
      status: 400,
    };
  }

  const cdn = workVersion.cdn;
  if (!cdn) {
    return {
      error: { type: 'general', message: 'Work version has no CDN configured' },
      status: 400,
    };
  }

  const uploadConfig = WORK_UPLOAD_CONFIGURATION[slot];
  if (!uploadConfig) {
    return {
      error: {
        type: 'general',
        message: `Invalid slot ${slot} provided`,
        details: {
          slot,
          configuredSlots: Object.keys(WORK_UPLOAD_CONFIGURATION),
        },
      },
      status: 400,
    };
  }

  return {
    success: true,
    work,
    workVersion,
    uploadConfig,
    cdn,
  };
}
