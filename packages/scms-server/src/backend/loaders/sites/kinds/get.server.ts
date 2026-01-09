import type { SubmissionKindDTO, CheckDTO, SubmissionKindSummaryDTO } from '@curvenote/common';
import type { Prisma } from '@prisma/client';
import type { SiteContext } from '../../../context.site.server.js';
import { getPrismaClient } from '../../../prisma.server.js';
import { coerceToObject } from '@curvenote/scms-core';

export async function dbGetKind(ctx: SiteContext, where: Prisma.SubmissionKindWhereInput) {
  const prisma = await getPrismaClient();
  return prisma.submissionKind.findFirst({ where: { site: { id: ctx.site.id }, ...where } });
}

export type DBO = Exclude<Prisma.PromiseReturnType<typeof dbGetKind>, null>;

export function formatSubmissionKindSummaryDTO(dbo: DBO): SubmissionKindSummaryDTO {
  return {
    id: dbo.id,
    name: dbo.name,
    content: coerceToObject(dbo.content),
    default: dbo.default ?? false,
  };
}

export function formatSubmissionKindDTO(ctx: SiteContext, dbo: DBO): SubmissionKindDTO {
  return {
    id: dbo.id,
    date_created: dbo.date_created,
    date_modified: dbo.date_modified,
    name: dbo.name,
    content: coerceToObject(dbo.content),
    default: dbo.default ?? false,
    checks: Array.isArray(dbo.checks)
      ? (dbo.checks.reduce<CheckDTO[]>((acc, check) => {
          if (!check) return acc;
          const obj = check as CheckDTO;
          return [...acc, obj];
        }, []) ?? [])
      : [],
    links: {
      self: ctx.asApiUrl(`/sites/${ctx.site.name}/kinds/${dbo.id}`),
      site: ctx.asApiUrl(`/sites/${ctx.site.name}`),
    },
  };
}

export default async function (ctx: SiteContext, where: Prisma.SubmissionKindWhereInput) {
  const dbo = await dbGetKind(ctx, where);
  if (!dbo) return null;
  return formatSubmissionKindDTO(ctx, dbo);
}
