/**
 * This is a server action that updates the metadata field of
 * a work version using OCC with a parameterised number of maxretries
 */

import type { Prisma } from '@curvenote/scms-db';
import { getPrismaClient } from './prisma.server.js';
import { httpError, delay } from '@curvenote/scms-core';

// Model types that support OCC with metadata
type ModelType =
  | 'workVersion'
  | 'submissionVersion'
  | 'submissionKind'
  | 'object'
  | 'siteData'
  | 'siteMetadata';

// Type map for model return types
// This maps the modelType string to the correct Prisma return type
export type ModelReturnType<T extends ModelType> = T extends 'workVersion'
  ? Prisma.WorkVersionGetPayload<Record<string, never>>
  : T extends 'submissionVersion'
    ? Prisma.SubmissionVersionGetPayload<Record<string, never>>
    : T extends 'submissionKind'
      ? Prisma.SubmissionKindGetPayload<Record<string, never>>
      : T extends 'object'
        ? Prisma.ObjectGetPayload<Record<string, never>>
        : T extends 'siteData' | 'siteMetadata'
          ? Prisma.SiteGetPayload<Record<string, never>>
          : never;

// Configuration for each model type
const modelConfig = {
  workVersion: {
    table: 'workVersion' as const,
    metadataField: 'metadata' as const,
    occField: 'occ' as const,
    errorPrefix: 'WorkVersion',
  },
  submissionVersion: {
    table: 'submissionVersion' as const,
    metadataField: 'metadata' as const,
    occField: 'occ' as const,
    errorPrefix: 'SubmissionVersion',
  },
  submissionKind: {
    table: 'submissionKind' as const,
    metadataField: 'content' as const, // Different field name for SubmissionKind
    occField: 'occ' as const,
    errorPrefix: 'SubmissionKind',
  },
  object: {
    table: 'object' as const,
    metadataField: 'data' as const, // Object model uses 'data' field
    occField: 'occ' as const,
    errorPrefix: 'Object',
  },
  siteData: {
    table: 'site' as const,
    metadataField: 'data' as const,
    occField: 'occ' as const,
    errorPrefix: 'Site (data)',
  },
  siteMetadata: {
    table: 'site' as const,
    metadataField: 'metadata' as const,
    occField: 'occ' as const,
    errorPrefix: 'Site (metadata)',
  },
} as const;

/**
 * Generic OCC function that can update any model with metadata and occ fields
 */
export async function safeJsonUpdateGeneric<T extends Prisma.JsonObject, M extends ModelType>(
  modelType: M,
  recordId: string,
  modifyFn: (metadata?: Prisma.JsonValue) => T,
  maxRetries: number = 5,
): Promise<ModelReturnType<M>> {
  const prisma = await getPrismaClient();
  const config = modelConfig[modelType];
  let retries = 0;

  while (retries < maxRetries) {
    // Get the current record with its OCC value
    const currentRecord = await (prisma as any)[config.table].findUnique({
      where: { id: recordId },
    });

    if (!currentRecord) {
      throw httpError(404, `${config.errorPrefix} not found`);
    }

    const newMetadata = modifyFn(currentRecord[config.metadataField]);

    // Attempt to update with OCC check
    try {
      const timestamp = new Date().toISOString();
      const updated = await (prisma as any)[config.table].update({
        where: {
          id: recordId,
          [config.occField]: currentRecord[config.occField], // This ensures we only update if OCC matches
        },
        data: {
          [config.metadataField]: newMetadata,
          [config.occField]: { increment: 1 }, // Increment OCC on successful update
          date_modified: timestamp,
        },
      });

      return updated as ModelReturnType<M>;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      retries++;
      if (retries >= maxRetries) {
        // could not update
        console.log(
          `OCC: Could not update ${config.errorPrefix} ${recordId} after ${maxRetries} retries`,
        );
        throw httpError(
          409,
          `OCC: Could not update ${config.errorPrefix} after ${maxRetries} retries`,
        );
      }
      console.log(
        `OCC Update ${config.errorPrefix} ${recordId} Retrying... ${retries + 1}/${maxRetries}`,
      );

      // Wait for 100ms before retrying
      await delay(100);
    }
  }
  // If we exit the loop without returning, something went wrong
  throw httpError(500, `OCC: Unexpected error in safeJsonUpdateGeneric for ${config.errorPrefix}`);
}

/**
 * OCC function specifically for WorkVersion (maintains backward compatibility)
 */
export async function safeWorkVersionJsonUpdate<T extends Prisma.JsonObject>(
  workVersionId: string,
  modifyFn: (metadata?: Prisma.JsonValue) => T,
  maxRetries: number = 5,
): Promise<Prisma.WorkVersionGetPayload<Record<string, never>>> {
  return safeJsonUpdateGeneric('workVersion', workVersionId, modifyFn, maxRetries);
}

/**
 * OCC function specifically for SubmissionVersion
 */
export async function safeSubmissionVersionJsonUpdate<T extends Prisma.JsonObject>(
  submissionVersionId: string,
  modifyFn: (metadata?: Prisma.JsonValue) => T,
  maxRetries: number = 5,
): Promise<Prisma.SubmissionVersionGetPayload<Record<string, never>>> {
  return safeJsonUpdateGeneric('submissionVersion', submissionVersionId, modifyFn, maxRetries);
}

/**
 * OCC function specifically for SubmissionKind
 */
export async function safeSubmissionKindJsonUpdate<T extends Prisma.JsonObject>(
  submissionKindId: string,
  modifyFn: (metadata?: Prisma.JsonValue) => T,
  maxRetries: number = 5,
): Promise<Prisma.SubmissionKindGetPayload<Record<string, never>>> {
  return safeJsonUpdateGeneric('submissionKind', submissionKindId, modifyFn, maxRetries);
}

/**
 * OCC function specifically for Object table
 */
export async function safeObjectDataUpdate<T extends Prisma.JsonObject>(
  objectId: string,
  modifyFn: (data?: Prisma.JsonValue) => T,
  maxRetries: number = 5,
): Promise<Prisma.ObjectGetPayload<Record<string, never>>> {
  return safeJsonUpdateGeneric('object', objectId, modifyFn, maxRetries);
}

/**
 * OCC function specifically for Site table, data field
 */
export async function safeSiteDataUpdate<T extends Prisma.JsonObject>(
  siteId: string,
  modifyFn: (data?: Prisma.JsonValue) => T,
  maxRetries: number = 5,
): Promise<Prisma.SiteGetPayload<Record<string, never>>> {
  return safeJsonUpdateGeneric('siteData', siteId, modifyFn, maxRetries);
}

/**
 * OCC function specifically for Site table, metadata field
 */
export async function safeSiteMetadataUpdate<T extends Prisma.JsonObject>(
  siteId: string,
  modifyFn: (metadata?: Prisma.JsonValue) => T,
  maxRetries: number = 5,
): Promise<Prisma.SiteGetPayload<Record<string, never>>> {
  return safeJsonUpdateGeneric('siteMetadata', siteId, modifyFn, maxRetries);
}
