// eslint-disable-next-line import/no-extraneous-dependencies
import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => {
  const file = { writeString: vi.fn(), download: vi.fn() };
  return {
    file,
    File: vi.fn(function File() {
      return file;
    }),
    StorageBackend: vi.fn(function StorageBackend() {
      return { backend: true };
    }),
    KnownBuckets: { prv: 'prv' },
  };
});
vi.mock('@curvenote/scms-server', () => storage);

import { depositXmlKey, readPrivateXml, resultXmlKey, writePrivateXml } from './storage.server.js';

const ctx = { ctx: true } as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('deposit storage keys', () => {
  it('places deposits under crossref/ in the private bucket', () => {
    expect(depositXmlKey('019a.xml')).toBe('crossref/deposits/019a.xml');
  });

  it('keeps result XML under crossref/results by file name', () => {
    expect(resultXmlKey('dep-1.xml')).toBe('crossref/results/dep-1.xml');
  });
});

describe('writePrivateXml', () => {
  it('writes the XML to the private bucket as application/xml', async () => {
    await writePrivateXml(ctx, 'crossref/deposits/019a.xml', '<doi_batch/>');
    expect(storage.StorageBackend).toHaveBeenCalledWith(ctx, ['prv']);
    expect(storage.File).toHaveBeenCalledWith(
      { backend: true },
      'crossref/deposits/019a.xml',
      'prv',
    );
    expect(storage.file.writeString).toHaveBeenCalledWith('<doi_batch/>', 'application/xml');
  });
});

describe('readPrivateXml', () => {
  it('reads the XML back from the private bucket as UTF-8', async () => {
    storage.file.download.mockResolvedValue(Buffer.from('<doi_batch>é</doi_batch>', 'utf8'));
    expect(await readPrivateXml(ctx, 'crossref/deposits/019a.xml')).toBe(
      '<doi_batch>é</doi_batch>',
    );
    expect(storage.File).toHaveBeenCalledWith(
      { backend: true },
      'crossref/deposits/019a.xml',
      'prv',
    );
  });
});
