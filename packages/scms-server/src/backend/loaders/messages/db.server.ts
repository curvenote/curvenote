import type { Context } from '../../context.server.js';
import { getPrismaClient } from '../../prisma.server.js';

export interface MessageDTO {
  id: string;
  date_created: string;
  date_modified: string;
  module: string;
  type: string;
  status: string;
  payload: any;
  results: any;
}

export interface MessageCounts {
  total: number;
  byModule: Record<string, number>;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
}

export interface MessageQuery {
  search?: string;
  module?: string;
  status?: string;
  type?: string;
}

export async function dbGetMessages(ctx: Context, query: MessageQuery = {}): Promise<MessageDTO[]> {
  const prisma = await getPrismaClient();

  const where: any = {};

  // Apply filters
  if (query.module) {
    where.module = query.module;
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.type) {
    where.type = query.type;
  }

  // Apply search
  if (query.search?.trim()) {
    const searchTerm = query.search.trim();
    where.OR = [
      { id: { contains: searchTerm, mode: 'insensitive' } },
      { module: { contains: searchTerm, mode: 'insensitive' } },
      { type: { contains: searchTerm, mode: 'insensitive' } },
      { status: { contains: searchTerm, mode: 'insensitive' } },
    ];
  }

  const messages = await prisma.message.findMany({
    where,
    orderBy: { date_created: 'desc' },
    take: 1000, // limit for now, paginate later if/when there is demand
    select: {
      id: true,
      date_created: true,
      date_modified: true,
      module: true,
      type: true,
      status: true,
      payload: true,
      results: true,
    },
  });

  return messages;
}

export async function dbGetMessage(ctx: Context, messageId: string): Promise<MessageDTO | null> {
  const prisma = await getPrismaClient();

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      date_created: true,
      date_modified: true,
      module: true,
      type: true,
      status: true,
      payload: true,
      results: true,
    },
  });

  return message;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function dbGetMessageCounts(ctx: Context): Promise<MessageCounts> {
  const prisma = await getPrismaClient();

  // Get total count
  const total = await prisma.message.count();

  // Get counts by module
  const moduleGroups = await prisma.message.groupBy({
    by: ['module'],
    _count: { _all: true },
  });

  // Get counts by status
  const statusGroups = await prisma.message.groupBy({
    by: ['status'],
    _count: { _all: true },
  });

  // Get counts by type
  const typeGroups = await prisma.message.groupBy({
    by: ['type'],
    _count: { _all: true },
  });

  const byModule: Record<string, number> = {};
  moduleGroups.forEach((group) => {
    byModule[group.module] = group._count._all;
  });

  const byStatus: Record<string, number> = {};
  statusGroups.forEach((group) => {
    byStatus[group.status] = group._count._all;
  });

  const byType: Record<string, number> = {};
  typeGroups.forEach((group) => {
    byType[group.type] = group._count._all;
  });

  return {
    total,
    byModule,
    byStatus,
    byType,
  };
}
