import { describe, expect, it } from 'vitest';
import {
  findImportantVersions,
  mergeListingVersionChips,
  pickListingActiveVersionId,
  type ListingVersionChip,
} from './listing.utils.server.js';

function chip(
  id: string,
  status: string,
  date_created: string,
  submission_id = 'sub-1',
): ListingVersionChip {
  return {
    id,
    submission_id,
    status,
    date_created,
    transition: null,
    job_id: null,
    work_version: { work_id: `work-${id}` },
  };
}

describe('pickListingActiveVersionId', () => {
  it('uses newest PENDING when it is newer than published', () => {
    const newest = chip('v1', 'PENDING', '2024-02-02');
    const published = chip('v2', 'PUBLISHED', '2024-02-01');
    expect(pickListingActiveVersionId(newest, published)).toBe('v1');
  });

  it('uses published when newest is PUBLISHED', () => {
    const newest = chip('v1', 'PUBLISHED', '2024-02-02');
    const published = newest;
    expect(pickListingActiveVersionId(newest, published)).toBe('v1');
  });

  it('uses published when newest is REJECTED and published exists', () => {
    const newest = chip('v1', 'REJECTED', '2024-02-03');
    const published = chip('v2', 'PUBLISHED', '2024-02-01');
    expect(pickListingActiveVersionId(newest, published)).toBe('v2');
  });

  it('falls back to newest when no published version', () => {
    const newest = chip('v1', 'APPROVED', '2024-02-01');
    expect(pickListingActiveVersionId(newest, undefined)).toBe('v1');
  });
});

describe('mergeListingVersionChips + findImportantVersions', () => {
  const cases: ListingVersionChip[][] = [
    [
      chip('v1', 'PENDING', '2024-03-01'),
      chip('v2', 'PUBLISHED', '2024-02-01'),
      chip('v3', 'RETRACTED', '2024-01-01'),
    ],
    [chip('v1', 'PUBLISHED', '2024-03-01'), chip('v2', 'PENDING', '2024-02-01')],
    [chip('v1', 'REJECTED', '2024-03-01'), chip('v2', 'PUBLISHED', '2024-02-01')],
    [chip('v1', 'PUBLISHED', '2024-03-01')],
  ];

  for (const fullVersions of cases) {
    it(`matches findImportantVersions for ${fullVersions.map((v) => v.status).join(',')}`, () => {
      const sorted = [...fullVersions].sort((a, b) => b.date_created.localeCompare(a.date_created));
      const newest = sorted[0];
      const published = sorted.find((v) => v.status === 'PUBLISHED');
      const retracted = sorted.find((v) => v.status === 'RETRACTED');

      const merged = mergeListingVersionChips({ newest, published, retracted });
      const fromFull = findImportantVersions(sorted);
      const fromMerged = findImportantVersions(merged);

      const activeFromFull = sorted[fromFull.active ?? fromFull.published ?? 0]?.id;
      const activeFromMerged = sorted[fromMerged.active ?? fromMerged.published ?? 0]?.id;
      const activeFromPick = pickListingActiveVersionId(newest, published);

      expect(activeFromPick).toBe(activeFromFull);
      expect(activeFromMerged).toBe(activeFromFull);
      expect(fromMerged.published).toBe(fromFull.published);
      expect(fromMerged.retracted).toBe(fromFull.retracted);
    });
  }
});
