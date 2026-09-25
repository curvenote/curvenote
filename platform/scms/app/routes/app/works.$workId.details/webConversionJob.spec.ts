// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import type { LinkedJobWithStatus } from '../works.$workId/db.server';
import {
  isMystCurvenoteWebJob,
  pickLatestWebConversionJob,
  resolveWebConversionTimelineModel,
  webConversionJobError,
} from './webConversionJob';

function job(
  partial: Partial<LinkedJobWithStatus> & Pick<LinkedJobWithStatus, 'id' | 'status'>,
): LinkedJobWithStatus {
  return {
    job_type: 'CONVERTER_TASK',
    payload: { conversion_type: 'myst-curvenote-web', target: 'web' },
    messages: [],
    results: null,
    date_created: '2026-09-23T10:00:00.000Z',
    date_modified: '2026-09-23T10:01:00.000Z',
    ...partial,
  };
}

describe('webConversionJob', () => {
  it('identifies myst-curvenote-web jobs and ignores pdf converter jobs', () => {
    expect(isMystCurvenoteWebJob(job({ id: 'w1', status: 'FAILED' }))).toBe(true);
    expect(
      isMystCurvenoteWebJob(
        job({
          id: 'p1',
          status: 'FAILED',
          payload: { conversion_type: 'docx-pd-curvenote-pdf', target: 'pdf' },
        }),
      ),
    ).toBe(false);
  });

  it('picks the latest web conversion job by date_created', () => {
    const latest = pickLatestWebConversionJob([
      job({ id: 'old', status: 'FAILED', date_created: '2026-09-23T09:00:00.000Z' }),
      job({ id: 'new', status: 'RUNNING', date_created: '2026-09-23T11:00:00.000Z' }),
      job({
        id: 'pdf',
        status: 'FAILED',
        date_created: '2026-09-23T12:00:00.000Z',
        payload: { conversion_type: 'docx-pd-curvenote-pdf', target: 'pdf' },
      }),
    ]);
    expect(latest?.id).toBe('new');
  });

  it('prefers last job message for error text', () => {
    expect(
      webConversionJobError(
        job({
          id: 'f1',
          status: 'FAILED',
          messages: ['step 1', 'Site build did not produce config.json'],
        }),
      ),
    ).toBe('Site build did not produce config.json');
  });

  it('resolves building / failed / available / hidden phases', () => {
    expect(
      resolveWebConversionTimelineModel({
        available: false,
        versionDateCreated: '2026-09-23T08:00:00.000Z',
        versionDateModified: '2026-09-23T08:00:00.000Z',
        latestJob: undefined,
      }),
    ).toBeNull();

    expect(
      resolveWebConversionTimelineModel({
        available: false,
        versionDateCreated: 'a',
        versionDateModified: 'b',
        latestJob: job({ id: 'q', status: 'QUEUED' }),
      })?.phase,
    ).toBe('building');

    const failed = resolveWebConversionTimelineModel({
      available: false,
      versionDateCreated: 'a',
      versionDateModified: 'b',
      latestJob: job({ id: 'f', status: 'FAILED', messages: ['boom'] }),
    });
    expect(failed?.phase).toBe('failed');
    expect(failed?.canRetry).toBe(true);
    expect(failed?.error).toBe('boom');

    expect(
      resolveWebConversionTimelineModel({
        available: true,
        versionDateCreated: 'a',
        versionDateModified: 'b',
        latestJob: job({ id: 'c', status: 'COMPLETED' }),
      })?.phase,
    ).toBe('available');
  });
});
