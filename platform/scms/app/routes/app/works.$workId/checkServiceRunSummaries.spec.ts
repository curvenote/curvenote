// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import type { CheckServiceRunRow } from './db.server';
import { getCheckRunSummaryByKind } from './checkServiceRunSummaries';

function run(
  id: string,
  kind: string,
  workVersionId: string,
  dateCreated: string,
): CheckServiceRunRow {
  return {
    id,
    kind,
    work_version_id: workVersionId,
    date_created: dateCreated,
    date_modified: dateCreated,
    data: { serviceData: { id } },
    created_by_id: null,
  };
}

describe('getCheckRunSummaryByKind', () => {
  it('selects the latest run per kind across non-draft versions', () => {
    const summary = getCheckRunSummaryByKind(
      [
        { id: 'wv-3', date_created: '2026-01-03T00:00:00.000Z' },
        { id: 'wv-2', date_created: '2026-01-02T00:00:00.000Z' },
        { id: 'wv-1', date_created: '2026-01-01T00:00:00.000Z' },
      ],
      {
        'wv-3': [run('proofig-new', 'proofig', 'wv-3', '2026-01-05T00:00:00.000Z')],
        'wv-2': [
          run('text-integrity-new', 'checks-text-integrity', 'wv-2', '2026-01-04T00:00:00.000Z'),
        ],
        'wv-1': [
          run('proofig-old', 'proofig', 'wv-1', '2026-01-02T12:00:00.000Z'),
          run('text-integrity-old', 'checks-text-integrity', 'wv-1', '2026-01-01T12:00:00.000Z'),
        ],
      },
    );

    expect(summary.latestRunByServiceKind.proofig.run.id).toBe('proofig-new');
    expect(summary.latestRunByServiceKind.proofig.versionNumber).toBe(3);
    expect(summary.latestRunByServiceKind['checks-text-integrity'].run.id).toBe(
      'text-integrity-new',
    );
    expect(summary.latestRunByServiceKind['checks-text-integrity'].versionNumber).toBe(2);
    expect(summary.previousRunsByServiceKind.proofig).toHaveLength(1);
  });

  it('dedupes multiple same-kind runs on a version to the first row supplied', () => {
    const summary = getCheckRunSummaryByKind(
      [
        { id: 'wv-2', date_created: '2026-01-02T00:00:00.000Z' },
        { id: 'wv-1', date_created: '2026-01-01T00:00:00.000Z' },
      ],
      {
        'wv-2': [
          run('latest-on-version', 'proofig', 'wv-2', '2026-01-03T00:00:00.000Z'),
          run('older-on-version', 'proofig', 'wv-2', '2026-01-02T12:00:00.000Z'),
        ],
        'wv-1': [run('older-version', 'proofig', 'wv-1', '2026-01-01T12:00:00.000Z')],
      },
    );

    expect(summary.latestRunByServiceKind.proofig.run.id).toBe('latest-on-version');
    expect(summary.previousRunsByServiceKind.proofig.map((entry) => entry.run.id)).toEqual([
      'older-version',
    ]);
  });
});
