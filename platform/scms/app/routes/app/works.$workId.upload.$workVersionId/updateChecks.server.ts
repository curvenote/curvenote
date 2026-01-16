import { safeWorkVersionJsonUpdate } from '@curvenote/scms-server';
import { data } from 'react-router';
import type { Prisma } from '@curvenote/scms-db';
import type { WorkVersionCheckName } from '@curvenote/scms-server';
import { isValidCheckName, checksMetadataSchema } from './checks.schema';

/**
 * Toggle a single check in the work version metadata
 * Adds the check if checked=true, removes it if checked=false
 */
export async function toggleWorkVersionCheck(
  workVersionId: string,
  checkName: WorkVersionCheckName,
  checked: boolean,
) {
  // Validate the check name using the schema
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
      const currentMetadata = (metadata as Record<string, any>) || { version: 1 };
      const currentChecksObject = currentMetadata.checks as { enabled?: WorkVersionCheckName[] };
      const currentChecks = currentChecksObject?.enabled || [];

      // Mutate the checks array based on the checked state
      let updatedChecks: WorkVersionCheckName[];
      if (checked) {
        // Add check if not already present
        updatedChecks = currentChecks.includes(checkName)
          ? currentChecks
          : [...currentChecks, checkName];
      } else {
        // Remove check if present
        updatedChecks = currentChecks.filter((check) => check !== checkName);
      }

      // Build the updated checks object, preserving existing status objects
      const updatedChecksObject: Record<string, any> = {
        enabled: updatedChecks,
        ...(currentChecksObject || {}),
      };

      // Validate the updated checks metadata using the schema
      const validationResult = checksMetadataSchema.safeParse({
        checks: updatedChecksObject,
      });
      if (!validationResult.success) {
        throw new Error(`Invalid checks metadata: ${validationResult.error.message}`);
      }

      return {
        ...currentMetadata,
        version: 1,
        checks: updatedChecksObject,
      } as Prisma.JsonObject;
    });

    return { success: true };
  } catch (error: any) {
    console.error('Failed to toggle work version check:', error);
    return data(
      {
        error: {
          type: 'general',
          message: 'Failed to toggle check',
          details: { workVersionId, checkName, checked, error: error.message },
        },
      },
      { status: 500 },
    );
  }
}
