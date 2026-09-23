// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { extension } from './server.js';

describe('sites extension jobs', () => {
  it('registers the Crossref deposit handler', () => {
    const jobs = extension.getJobs!();
    expect(jobs.map((j) => j.jobType)).toEqual(['CROSSREF_DEPOSIT']);
    expect(typeof jobs[0].handler).toBe('function');
  });
});
