import type { DoiContentType } from '@curvenote/scms-core';
import { commitDoiWrite, dbGetDoiConfig, toDTO } from './db.server.js';
import { DOI_ERRORS, STALE } from './errors.js';
import { dbGetSiteKinds, dbSetKindContentType } from './kinds.db.server.js';
import type { DoiActor, DoiDeps, DoiFailure, DoiResult } from './types.js';

const UNKNOWN_KIND: DoiFailure = { ok: false, status: 400, error: DOI_ERRORS.unknownKind };

export type KindMappingEntry = { kindId: string; doiContentType: DoiContentType | null };

export type UpdateKindMappingInput = {
  siteId: string;
  actor: DoiActor;
  /** The kinds the admin changed. A kind it does not list keeps its value. */
  kinds: KindMappingEntry[];
};

/**
 * Which Submission Kinds can register DOIs, and as what. Any site admin can change it once the
 * site has a DOI setup, including one still waiting for its role. Each kind is last-write-wins,
 * like its name: the form sends only the kinds the admin changed, so a stale tab cannot put back
 * a kind it did not touch.
 *
 * A kind with registered DOIs can change too: each DOI keeps the content type recorded on its
 * registration, so only registrations that start afterwards use the new one.
 */
export async function updateKindMapping(
  deps: DoiDeps,
  input: UpdateKindMappingInput,
): Promise<DoiResult> {
  const { siteId } = input;
  const existing = await dbGetDoiConfig(deps.prisma, siteId);
  if (!existing) {
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
      for (const { kind, value } of changes) {
        await dbSetKindContentType(tx, { siteId, kindId: kind.id, value });
      }
      return existing;
    },
  );
}
