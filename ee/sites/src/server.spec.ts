// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { extension } from './server.js';

describe('sites extension jobs', () => {
  it('registers the Crossref deposit and poll handlers', () => {
    const jobs = extension.getJobs!();
    expect(jobs.map((j) => j.jobType)).toEqual(['CROSSREF_DEPOSIT', 'CROSSREF_POLL']);
    expect(jobs.every((j) => typeof j.handler === 'function')).toBe(true);
  });
});
