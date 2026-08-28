import type { Context } from '../../backend/types.js';
import type { ClientExtension, ServerExtension, WorkCreateOption } from '../extensions/types.js';
import {
  BUILTIN_ARTICLE_WORK_CREATE_OPTION,
  BUILTIN_ARTICLE_WORK_CREATE_OPTION_ID,
} from './builtinArticleOption.js';
import { getAllRegisteredWorkCreateOptions } from './workCreateOptions.js';
import { resolveWorkCreateOptionFromMetadata } from './resolveWorkCreateOption.js';

function asMetadataRecord(metadata: unknown): Record<string, unknown> | null {
  if (metadata == null || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  return metadata as Record<string, unknown>;
}

/** Article plus every registered extension option (extensionId stamped). */
export function workCreateOptionsForResume(
  clientExtensions: ClientExtension[],
): WorkCreateOption[] {
  return [
    BUILTIN_ARTICLE_WORK_CREATE_OPTION,
    ...getAllRegisteredWorkCreateOptions(clientExtensions),
  ];
}

export function interpolateResumePath(
  template: string,
  ids: { workId: string; workVersionId: string },
  from?: string | null,
): string {
  let path = template
    .replaceAll(':workId', ids.workId)
    .replaceAll(':workVersionId', ids.workVersionId);
  if (from) {
    const sep = path.includes('?') ? '&' : '?';
    path = `${path}${sep}from=${encodeURIComponent(from)}`;
  }
  return path;
}

export function isOnCreateFormPath(
  pathname: string,
  workId: string,
  options: WorkCreateOption[],
): boolean {
  const workPrefix = `/app/works/${workId}`;
  return options.some((option) => {
    const fragment = option.formPathIncludes;
    if (!fragment) return false;
    return pathname.includes(`${workPrefix}${fragment}`);
  });
}

export function isArticleReusableDraft(metadata: unknown, options: WorkCreateOption[]): boolean {
  const meta = asMetadataRecord(metadata);
  if (!meta || !('checks' in meta)) return false;
  return (
    resolveWorkCreateOptionFromMetadata(meta, options).id === BUILTIN_ARTICLE_WORK_CREATE_OPTION_ID
  );
}

export async function resolveDraftResumePath(args: {
  workId: string;
  workVersionId: string;
  metadata: unknown;
  options: WorkCreateOption[];
  from?: string | null;
  serverExtensions?: ServerExtension[];
  ctx?: Context;
}): Promise<string> {
  const ids = { workId: args.workId, workVersionId: args.workVersionId };
  const option = resolveWorkCreateOptionFromMetadata(asMetadataRecord(args.metadata), args.options);

  if (option.extensionId && args.serverExtensions && args.ctx) {
    const ext = args.serverExtensions.find((candidate) => candidate.id === option.extensionId);
    const hooked = await ext?.resolveResumeDraftPath?.({
      ctx: args.ctx,
      workId: args.workId,
      workVersionId: args.workVersionId,
      metadata: args.metadata,
    });
    if (hooked) return hooked;
  }

  const template = option.resumePath ?? BUILTIN_ARTICLE_WORK_CREATE_OPTION.resumePath;
  return interpolateResumePath(
    template ?? '/app/works/:workId/upload/:workVersionId',
    ids,
    args.from,
  );
}
