import type { SrcId } from './types/index.js';
import type { BlockFrontMatterProps, ProjectFrontMatterProps } from './types/frontMatter.js';
import { BLOCK_FRONT_MATTER_KEYS, PROJECT_FRONT_MATTER_KEYS } from './types/frontMatter.js';

export const srcIdToJson = (object: SrcId): SrcId => ({
  project: object.project,
  block: object.block,
  version: object.version ?? null,
  draft: object.draft ?? null,
});

function extractFrontMatter<T extends BlockFrontMatterProps | ProjectFrontMatterProps>(
  keys: (keyof T)[],
  obj: T,
): T {
  const frontMatter: T = keys.reduce((acc, cur) => {
    const value = obj[cur];
    if (typeof value !== 'undefined') {
      (acc as any)[cur] = obj[cur];
    }
    return acc;
  }, {} as T);
  return frontMatter;
}

export function extractBlockFrontMatter(obj: BlockFrontMatterProps) {
  return extractFrontMatter(BLOCK_FRONT_MATTER_KEYS, obj);
}

export function extractProjectFrontMatter(obj: ProjectFrontMatterProps) {
  return extractFrontMatter(PROJECT_FRONT_MATTER_KEYS, obj);
}
