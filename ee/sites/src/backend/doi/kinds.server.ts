import type { DoiContentType } from '@curvenote/scms-core';
import { kindTitle } from '../kinds.utils.js';
import {
  commitDoiWrite,
  dbGetDoiConfig,
  dbUpdateDoiConfig,
  isExpectedRow,
  toDTO,
} from './db.server.js';
import { DOI_ERRORS, DoiWriteRefused, STALE, kindLocked } from './errors.js';
import {
  dbGetSiteKinds,
  dbKindIdsWithLiveRegistrations,
  dbSetKindContentType,
} from './kinds.db.server.js';
import type { DoiActor, DoiDeps, DoiFailure, DoiResult } from './types.js';

const UNKNOWN_KIND: DoiFailure = { ok: false, status: 400, error: DOI_ERRORS.unknownKind };

export type KindMappingEntry = { kindId: string; doiContentType: DoiContentType | null };

export type UpdateKindMappingInput = {
  siteId: string;
  actor: DoiActor;
  occ: number;
  /** The kinds the form showed. A kind it did not list keeps its value. */
  kinds: KindMappingEntry[];
};

/**
 * Which Submission Kinds can register DOIs, and as what. Any site admin can change it once the
 * site has a DOI setup, including one still waiting for its role.
 */
export async function updateKindMapping(
  deps: DoiDeps,
  input: UpdateKindMappingInput,
): Promise<DoiResult> {
  const { siteId } = input;
  const existing = await dbGetDoiConfig(deps.prisma, siteId);
  if (!isExpectedRow(existing, { occ: input.occ })) {
    return STALE;
  }
  const current = new Map(
    (await dbGetSiteKinds(deps.prisma, siteId)).map((kind) => [kind.id, kind]),
  );
  if (input.kinds.some((entry) => !current.has(entry.kindId))) {
    return UNKNOWN_KIND;
  }
  const changes = input.kinds.flatMap((entry) => {
    const kind = current.get(entry.kindId);
    return kind && kind.doi_content_type !== entry.doiContentType
      ? [{ kind, value: entry.doiContentType }]
      : [];
  });
  if (changes.length === 0) {
    return { ok: true, config: toDTO(existing) };
  }
  const snapshot = changes.map(({ kind, value }) => ({
    id: kind.id,
    name: kind.name,
    doi_content_type: value,
  }));
  return commitDoiWrite(
    deps,
    { siteId, actor: input.actor, action: 'update-kind-mapping', onUnique: STALE, kinds: snapshot },
    async (tx) => {
      // Starting a registration bumps this occ too, so the two serialize on the config row: a
      // registration that started after the page loaded makes this save stale.
      const row = await dbUpdateDoiConfig(tx, existing, {});
      // The page disables locked kinds; this refuses a crafted or outdated form.
      const locked = await dbKindIdsWithLiveRegistrations(tx, {
        siteId,
        kindIds: changes.map(({ kind }) => kind.id),
      });
      const blocked = changes.find(({ kind }) => locked.has(kind.id));
      if (blocked) {
        throw new DoiWriteRefused(kindLocked(kindTitle(blocked.kind)));
      }
      for (const { kind, value } of changes) {
        if (!(await dbSetKindContentType(tx, { siteId, kindId: kind.id, value }))) {
          throw new DoiWriteRefused(UNKNOWN_KIND);
        }
      }
      return row;
    },
  );
}
