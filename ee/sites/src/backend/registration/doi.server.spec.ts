// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ generateDoi: vi.fn() }));
vi.mock('crossref-utils-sdk', () => ({ generateDoi: mocks.generateDoi }));

import type { DoiReader } from './doi.server.js';
import { generateFreeDoi } from './doi.server.js';

const PREFIX = '10.9999';

function mockTable() {
  return { findFirst: vi.fn().mockResolvedValue(null) };
}

function reader() {
  return {
    doiRegistration: mockTable(),
    work: mockTable(),
    workVersion: mockTable(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.generateDoi
    .mockReset()
    .mockReturnValueOnce(`${PREFIX}/aaaa2222`)
    .mockReturnValueOnce(`${PREFIX}/bbbb3333`)
    .mockReturnValue(`${PREFIX}/cccc4444`);
});

describe('generateFreeDoi', () => {
  it('returns a DOI under the prefix when it is free', async () => {
    const db = reader();

    const doi = await generateFreeDoi(db as unknown as DoiReader, PREFIX);

    expect(doi).toBe(`${PREFIX}/aaaa2222`);
    expect(mocks.generateDoi).toHaveBeenCalledWith(PREFIX);
    expect(db.doiRegistration.findFirst).toHaveBeenCalledWith({
      where: { doi: `${PREFIX}/aaaa2222` },
      select: { id: true },
    });
    expect(db.work.findFirst).toHaveBeenCalledWith({
      where: { doi: `${PREFIX}/aaaa2222` },
      select: { id: true },
    });
    expect(db.workVersion.findFirst).toHaveBeenCalledWith({
      where: { doi: `${PREFIX}/aaaa2222` },
      select: { id: true },
    });
  });

  it.each(['doiRegistration', 'work', 'workVersion'] as const)(
    'skips a DOI already used by a %s',
    async (table) => {
      const db = reader();
      db[table].findFirst.mockResolvedValueOnce({ id: 'taken' });

      const doi = await generateFreeDoi(db as unknown as DoiReader, PREFIX);

      expect(doi).toBe(`${PREFIX}/bbbb3333`);
      expect(mocks.generateDoi).toHaveBeenCalledTimes(2);
    },
  );

  it('gives up after five taken attempts', async () => {
    const db = reader();
    db.doiRegistration.findFirst.mockResolvedValue({ id: 'taken' });

    await expect(generateFreeDoi(db as unknown as DoiReader, PREFIX)).rejects.toThrow(/5 attempts/);
    expect(mocks.generateDoi).toHaveBeenCalledTimes(5);
  });
});
