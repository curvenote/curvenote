// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { pickLatestVersionTags } from './index.versions.server.js';

describe('pickLatestVersionTags', () => {
  it('uses the first tag from the newest version that has tags', () => {
    const tags = pickLatestVersionTags([
      {
        submission_id: 'sub-1',
        tags: ['v2'],
        work_version: { tags: [] },
      },
      {
        submission_id: 'sub-1',
        tags: ['v1'],
        work_version: { tags: [] },
      },
    ]);

    expect(tags.get('sub-1')).toBe('v2');
  });

  it('prefers submission tags before work version tags', () => {
    const tags = pickLatestVersionTags([
      {
        submission_id: 'sub-1',
        tags: ['sv-tag'],
        work_version: { tags: ['wv-tag'] },
      },
    ]);

    expect(tags.get('sub-1')).toBe('sv-tag');
  });
});
