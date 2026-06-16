import {
  safeWorkVersionJsonUpdate,
  isValidCheckName,
  ChecksMetadataSchema,
  makeDefaultWorkVersionMetadata,
} from '@curvenote/scms-server';
import type { WorkVersionCheckName } from '@curvenote/scms-server';
import { data } from 'react-router';
import type { Prisma } from '@curvenote/scms-db';

/**
 * Toggle a single check in the work version metadata
 * Adds the check if checked=true, removes it if checked=false
 */
export async function toggleWorkVersionCheck(
  workVersionId: string,
  checkName: WorkVersionCheckName,
  checked: boolean,
) {
  if (!isValidCheckName(checkName)) {
    return data(
      {
        error: {
          type: 'validation',
          message: 'Invalid check name',
          details: { workVersionId, checkName },
        },
      },
      { status: 400 },
    );
  }

  try {
    await safeWorkVersionJsonUpdate(workVersionId, (metadata?: Prisma.JsonValue) => {
      const currentMetadata = (metadata as Record<string, any>) || makeDefaultWorkVersionMetadata();
      const currentChecksObject = currentMetadata.checks as { enabled?: WorkVersionCheckName[] };
      const currentChecks = currentChecksObject?.enabled || [];

      let updatedChecks: WorkVersionCheckName[];
      if (checked) {
        updatedChecks = currentChecks.includes(checkName)
          ? currentChecks
          : [...currentChecks, checkName];
      } else {
        updatedChecks = currentChecks.filter((check) => check !== checkName);
      }

      const updatedChecksObject: Record<string, any> = {
        ...(currentChecksObject || {}),
        enabled: updatedChecks,
      };

      const validationResult = ChecksMetadataSchema.safeParse({
        checks: updatedChecksObject,
      });
      if (!validationResult.success) {
        throw new Error(`Invalid checks metadata: ${validationResult.error.message}`);
      }

      return {
        ...currentMetadata,
        checks: updatedChecksObject,
      } as Prisma.JsonObject;
    });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to toggle work version check:', error);
    return data(
      {
        error: {
          type: 'general',
          message: 'Failed to toggle check',
          details: { workVersionId, checkName, checked, error: message },
        },
      },
      { status: 500 },
    );
  }
}
