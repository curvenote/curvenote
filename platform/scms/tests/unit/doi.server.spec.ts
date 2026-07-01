import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseDoiFormat } from '../../app/routes/app/works.$workId.details/doiFormat.js';
import {
  validateAndNormalizeDoi,
  checkDoiReachability,
} from '../../app/routes/app/works.$workId.details/doi.server.js';

describe('parseDoiFormat', () => {
  it('accepts a DOI prefix/suffix', () => {
    expect(parseDoiFormat('10.1234/example')).toEqual({
      ok: true,
      normalized: '10.1234/example',
    });
  });

  it('accepts a full doi.org URL', () => {
    expect(parseDoiFormat('https://doi.org/10.1234/example')).toEqual({
      ok: true,
      normalized: '10.1234/example',
    });
  });

  it('rejects invalid DOI format', () => {
    expect(parseDoiFormat('not-a-doi')).toEqual({ ok: false, error: 'Invalid DOI format' });
  });

  it('rejects empty input', () => {
    expect(parseDoiFormat('   ')).toEqual({ ok: false, error: 'DOI is required' });
  });
});

describe('validateAndNormalizeDoi', () => {
  it('does not require reachability', () => {
    expect(validateAndNormalizeDoi('10.1234/example')).toEqual({
      ok: true,
      normalized: '10.1234/example',
    });
  });
});

describe('checkDoiReachability', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('returns ok when HEAD succeeds', async () => {
    fetchMock.mockResolvedValueOnce({ status: 302 });

    await expect(checkDoiReachability('10.1234/example')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith('https://doi.org/10.1234/example', {
      method: 'HEAD',
      redirect: 'manual',
    });
  });

  it('falls back to GET when HEAD is not reachable', async () => {
    fetchMock
      .mockResolvedValueOnce({ status: 404 })
      .mockResolvedValueOnce({ status: 302 });

    await expect(checkDoiReachability('10.1234/example')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://doi.org/10.1234/example', {
      method: 'HEAD',
      redirect: 'manual',
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://doi.org/10.1234/example', {
      method: 'GET',
      redirect: 'manual',
    });
  });

  it('returns error when DOI is unreachable', async () => {
    fetchMock.mockResolvedValue({ status: 404 });

    await expect(checkDoiReachability('10.1234/unreachable')).resolves.toEqual({
      ok: false,
      error: 'DOI does not resolve to a reachable URL',
    });
  });

  it('returns error when HEAD request fails', async () => {
    fetchMock.mockRejectedValue(new Error('network error'));

    await expect(checkDoiReachability('10.1234/network-fail')).resolves.toEqual({
      ok: false,
      error: 'DOI lookup failed',
    });
  });
});
