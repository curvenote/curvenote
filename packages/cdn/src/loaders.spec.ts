// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { getJournal, lookupJournal } from './loaders.js';

describe('CDN', () => {
  it('test live API', async () => {
    const journal = await getJournal('physiome');
    expect(journal.name).toBe('physiome');
    expect(journal.links.html).toBe('https://journal.physiomeproject.org');
  });
  it('test live API', async () => {
    const journal = await lookupJournal('proceedings.scipy.org');
    expect(journal.name).toBe('scipy');
    expect(journal.links.html).toBe('https://proceedings.scipy.org');
  });
});
