import type { CheckDefinition } from './types.js';

export function withTags(
  checks: Pick<CheckDefinition, 'id' | 'title' | 'purpose' | 'options'>[],
  opts: Pick<CheckDefinition, 'tags'>,
): CheckDefinition[] {
  return checks.map((check) => {
    return { ...check, ...opts };
  });
}
