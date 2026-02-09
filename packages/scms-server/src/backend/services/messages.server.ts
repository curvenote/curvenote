import { uuidv7 } from 'uuidv7';
import type { Prisma } from '@curvenote/scms-db';
import { getPrismaClient } from '../prisma.server.js';

export type MessageStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'SUCCESS'
  | 'ERROR'
  | 'PARTIAL'
  | 'IGNORED'
  | 'BOUNCED';

export interface CreateMessageRecordOptions {
  module: string;
  type: string;
  status?: MessageStatus;
  payload: unknown;
  payloadSchema?: Record<string, any>;
  results?: unknown;
  resultsSchema?: Record<string, any>;
}

/**
 * Creates a new `Message` record (messages table).
 *
 * We keep `module`, `type`, and `status` as strings in the database so extensions can
 * add new message types without schema changes.
 *
 * If a JSON schema is provided, it is embedded on the data as `$schema` for UI rendering.
 */
export async function createMessageRecord(options: CreateMessageRecordOptions): Promise<string> {
  const prisma = await getPrismaClient();
  const now = new Date().toISOString();

  const payload: Prisma.InputJsonValue =
    options.payloadSchema && options.payload && typeof options.payload === 'object'
      ? ({ ...(options.payload as Record<string, any>), $schema: options.payloadSchema } as Prisma.InputJsonValue)
      : options.payloadSchema
        ? ({ $schema: options.payloadSchema, payload: options.payload } as Prisma.InputJsonValue)
        : ({ payload: options.payload } as Prisma.InputJsonValue);

  const results: Prisma.InputJsonValue | undefined =
    options.results === undefined
      ? undefined
      : options.resultsSchema && options.results && typeof options.results === 'object'
        ? ({ ...(options.results as Record<string, any>), $schema: options.resultsSchema } as Prisma.InputJsonValue)
        : options.resultsSchema
          ? ({ $schema: options.resultsSchema, results: options.results } as Prisma.InputJsonValue)
          : ({ results: options.results } as Prisma.InputJsonValue);

  const message = await prisma.message.create({
    data: {
      id: uuidv7(),
      date_created: now,
      date_modified: now,
      module: options.module,
      type: options.type,
      status: options.status ?? 'PENDING',
      payload,
      results,
    },
  });

  return message.id;
}

/**
 * Updates a message record's status and merges results (if provided).
 *
 * This is intended for "create pending" -> "accepted/error" flows.
 */
export async function updateMessageStatus(
  messageId: string,
  status: MessageStatus,
  results?: Prisma.InputJsonValue,
): Promise<void> {
  const prisma = await getPrismaClient();
  const current = await prisma.message.findUnique({ where: { id: messageId } });
  const data: Record<string, any> = {
    status,
    date_modified: new Date().toISOString(),
  };
  if (results !== undefined) {
    data.results = {
      ...((current?.results as any) ?? {}),
      ...(results as any),
    };
  }
  await prisma.message.update({ where: { id: messageId }, data });
}

