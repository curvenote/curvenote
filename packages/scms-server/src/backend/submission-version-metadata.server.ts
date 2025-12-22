import {
  makeDefaultSubmissionVersionMetadata,
  type SubmissionVersionMetadata,
} from './metadata.js';
import { safeSubmissionVersionJsonUpdate } from './occ.server.js';
import { coerceToObject } from '@curvenote/scms-core';
import { data as dataResponse } from 'react-router';

/**
 * Safely patch SubmissionVersion metadata with OCC
 */
export async function safelyPatchSubmissionVersionMetadata(
  submissionVersionId: string,
  metadataPatch: Record<string, any>,
) {
  try {
    await safeSubmissionVersionJsonUpdate<SubmissionVersionMetadata>(
      submissionVersionId,
      (metadata) => {
        const readMetadata = coerceToObject(metadata);

        const updatedMetadata: SubmissionVersionMetadata = {
          ...makeDefaultSubmissionVersionMetadata(),
          ...readMetadata,
        };

        Object.keys(metadataPatch).forEach((key) => {
          let value = metadataPatch[key];
          if (
            !Array.isArray(metadataPatch[key]) &&
            typeof metadataPatch[key] === 'object' &&
            metadataPatch[key] !== null
          ) {
            value = {
              ...updatedMetadata[key],
              ...metadataPatch[key],
            };
          }
          updatedMetadata[key] = value;
        });

        return updatedMetadata as any;
      },
    );
    return { success: true };
  } catch (error: any) {
    console.error(error);
    return dataResponse(
      {
        error: {
          type: 'general',
          error: 'Failed to update metadata',
          details: { submissionVersionId, error },
        },
      },
      { status: 500 },
    );
  }
}

/**
 * Safely update SubmissionVersion metadata with OCC
 */
export async function safelyUpdateSubmissionVersionMetadata<T extends SubmissionVersionMetadata>(
  submissionVersionId: string,
  updateFn: (metadata: SubmissionVersionMetadata) => T,
) {
  try {
    await safeSubmissionVersionJsonUpdate<T>(submissionVersionId, (metadata) => {
      const readMetadata = coerceToObject(metadata);

      const updatedMetadata: SubmissionVersionMetadata = {
        ...makeDefaultSubmissionVersionMetadata(),
        ...readMetadata,
      };

      return updateFn(updatedMetadata);
    });

    return { success: true };
  } catch (error: any) {
    console.error(error);
    return dataResponse(
      {
        error: {
          type: 'general',
          error: 'Failed to update metadata',
          details: { submissionVersionId, error },
        },
      },
      { status: 500 },
    );
  }
}
