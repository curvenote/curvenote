// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import type { CheckServiceRunRow } from './db.server';
import { isCheckServiceRunSupersededByRetry } from './db.server';
import { getCheckRunSummaryByKind, selectWorkListVisibleRunsByServiceKind } from './checkServiceRunSummaries';

function run(
  id: string,
  kind: string,
  workVersionId: string,
  dateCreated: string,
  overrides: Partial<CheckServiceRunRow> = {},
): CheckServiceRunRow {
  return {
    id,
    kind,
    work_version_id: workVersionId,
    date_created: dateCreated,
    date_modified: dateCreated,
    data: { serviceData: { id } },
    created_by_id: null,
    ...overrides,
  };
}

describe('isCheckServiceRunSupersededByRetry', () => {
  it('returns true when retried or successor_id is set', () => {
    expect(isCheckServiceRunSupersededByRetry({ retried: true })).toBe(true);
    expect(isCheckServiceRunSupersededByRetry({ successor_id: 'run-2' })).toBe(true);
    expect(isCheckServiceRunSupersededByRetry({ retried: false, successor_id: null })).toBe(false);
  });
});

describe('getCheckRunSummaryByKind', () => {
  it('selects the latest run per kind across non-draft versions', () => {
    const summary = getCheckRunSummaryByKind(
      [
        { id: 'wv-3', date_created: '2026-01-03T00:00:00.000Z' },
        { id: 'wv-2', date_created: '2026-01-02T00:00:00.000Z' },
        { id: 'wv-1', date_created: '2026-01-01T00:00:00.000Z' },
      ],
      {
        'wv-3': [run('service-a-new', 'service-a', 'wv-3', '2026-01-05T00:00:00.000Z')],
        'wv-2': [run('service-b-new', 'service-b', 'wv-2', '2026-01-04T00:00:00.000Z')],
        'wv-1': [
          run('service-a-old', 'service-a', 'wv-1', '2026-01-02T12:00:00.000Z'),
          run('service-b-old', 'service-b', 'wv-1', '2026-01-01T12:00:00.000Z'),
        ],
      },
    );

    expect(summary.latestRunByServiceKind['service-a'].run.id).toBe('service-a-new');
    expect(summary.latestRunByServiceKind['service-a'].versionNumber).toBe(3);
    expect(summary.latestRunByServiceKind['service-b'].run.id).toBe('service-b-new');
    expect(summary.latestRunByServiceKind['service-b'].versionNumber).toBe(2);
    expect(summary.previousRunsByServiceKind['service-a']).toHaveLength(1);
  });

  it('dedupes multiple same-kind runs on a version to the first row supplied', () => {
    const summary = getCheckRunSummaryByKind(
      [
        { id: 'wv-2', date_created: '2026-01-02T00:00:00.000Z' },
        { id: 'wv-1', date_created: '2026-01-01T00:00:00.000Z' },
      ],
      {
        'wv-2': [
          run('latest-on-version', 'service-a', 'wv-2', '2026-01-03T00:00:00.000Z'),
          run('older-on-version', 'service-a', 'wv-2', '2026-01-02T12:00:00.000Z'),
        ],
        'wv-1': [run('older-version', 'service-a', 'wv-1', '2026-01-01T12:00:00.000Z')],
      },
    );

    expect(summary.latestRunByServiceKind['service-a'].run.id).toBe('latest-on-version');
    expect(summary.previousRunsByServiceKind['service-a'].map((entry) => entry.run.id)).toEqual([
      'older-version',
    ]);
  });

  it('excludes superseded runs from latest and previous summaries', () => {
    const summary = getCheckRunSummaryByKind(
      [{ id: 'wv-1', date_created: '2026-01-01T00:00:00.000Z' }],
      {
        'wv-1': [
          run('retry-successor', 'service-a', 'wv-1', '2026-01-03T00:00:00.000Z'),
          run('superseded-failure', 'service-a', 'wv-1', '2026-01-02T00:00:00.000Z', {
            retried: true,
            successor_id: 'retry-successor',
          }),
        ],
      },
    );

    expect(summary.latestRunByServiceKind['service-a'].run.id).toBe('retry-successor');
    expect(summary.previousRunsByServiceKind['service-a']).toEqual([]);
  });

  it('promotes an older non-superseded run when the newest same-kind run was retried', () => {
    const summary = getCheckRunSummaryByKind(
      [{ id: 'wv-1', date_created: '2026-01-01T00:00:00.000Z' }],
      {
        'wv-1': [
          run('superseded-only', 'service-a', 'wv-1', '2026-01-03T00:00:00.000Z', {
            retried: true,
            successor_id: 'missing-successor',
          }),
          run('active-failure', 'service-a', 'wv-1', '2026-01-02T00:00:00.000Z'),
        ],
      },
    );

    expect(summary.latestRunByServiceKind['service-a'].run.id).toBe('active-failure');
    expect(summary.previousRunsByServiceKind['service-a']).toEqual([]);
  });
});

describe('selectWorkListVisibleRunsByServiceKind', () => {
  it('falls back to the latest non-hidden run when the newest run is hidden', () => {
    const summary = getCheckRunSummaryByKind(
      [
        { id: 'wv-2', date_created: '2026-01-02T00:00:00.000Z' },
        { id: 'wv-1', date_created: '2026-01-01T00:00:00.000Z' },
      ],
      {
        'wv-2': [
          run('proofig-error', 'proofig', 'wv-2', '2026-01-03T00:00:00.000Z', {
            data: { serviceData: { error: true } },
          }),
        ],
        'wv-1': [
          run('proofig-ok', 'proofig', 'wv-1', '2026-01-02T00:00:00.000Z', {
            data: { serviceData: { error: false } },
          }),
        ],
      },
    );

    const visible = selectWorkListVisibleRunsByServiceKind(summary, (_kind, metadata) => {
      return metadata != null && typeof metadata === 'object' && 'error' in metadata
        ? !(metadata as { error?: boolean }).error
        : true;
    });

    expect(visible.proofig.run.id).toBe('proofig-ok');
    expect(visible.proofig.workVersionId).toBe('wv-1');
  });

  it('returns no entry when every run for a kind is hidden', () => {
    const summary = getCheckRunSummaryByKind(
      [{ id: 'wv-1', date_created: '2026-01-01T00:00:00.000Z' }],
      {
        'wv-1': [
          run('proofig-error', 'proofig', 'wv-1', '2026-01-03T00:00:00.000Z', {
            data: { serviceData: { error: true } },
          }),
        ],
      },
    );

    const visible = selectWorkListVisibleRunsByServiceKind(summary, (_kind, metadata) => {
      return metadata != null && typeof metadata === 'object' && 'error' in metadata
        ? !(metadata as { error?: boolean }).error
        : true;
    });

    expect(visible.proofig).toBeUndefined();
  });
});
