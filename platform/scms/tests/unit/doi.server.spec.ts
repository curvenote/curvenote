import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateAndNormalizeDoi } from '../../app/routes/app/works.$workId.details/doi.server.js';

describe('validateAndNormalizeDoi', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('accepts a DOI prefix/suffix and returns normalized value after HEAD succeeds', async () => {
    fetchMock.mockResolvedValue({ status: 302 });

    const result = await validateAndNormalizeDoi('10.1234/example');

    expect(result).toEqual({ ok: true, normalized: '10.1234/example' });
    expect(fetchMock).toHaveBeenCalledWith('https://doi.org/10.1234/example', {
      method: 'HEAD',
      redirect: 'manual',
    });
  });

  it('accepts a full doi.org URL', async () => {
    fetchMock.mockResolvedValue({ status: 302 });

    const result = await validateAndNormalizeDoi('https://doi.org/10.1234/example');

    expect(result).toEqual({ ok: true, normalized: '10.1234/example' });
  });

  it('rejects invalid DOI format', async () => {
    const result = await validateAndNormalizeDoi('not-a-doi');

    expect(result).toEqual({ ok: false, error: 'Invalid DOI format' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects empty input', async () => {
    const result = await validateAndNormalizeDoi('   ');

    expect(result).toEqual({ ok: false, error: 'DOI is required' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects unreachable DOI', async () => {
    fetchMock.mockResolvedValue({ status: 404 });

    const result = await validateAndNormalizeDoi('10.1234/unreachable');

    expect(result).toEqual({ ok: false, error: 'DOI does not resolve to a reachable URL' });
  });

  it('rejects when HEAD request fails', async () => {
    fetchMock.mockRejectedValue(new Error('network error'));

    const result = await validateAndNormalizeDoi('10.1234/network-fail');

    expect(result).toEqual({ ok: false, error: 'DOI lookup failed' });
  });
});
