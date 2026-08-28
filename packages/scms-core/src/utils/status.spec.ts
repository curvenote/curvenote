// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { getStatusBannerTone } from './status.js';

describe('getStatusBannerTone', () => {
  it('treats pending as pending regardless of case', () => {
    expect(getStatusBannerTone('PENDING')).toBe('pending');
    expect(getStatusBannerTone('pending')).toBe('pending');
  });

  it('treats published as published regardless of case', () => {
    expect(getStatusBannerTone('PUBLISHED')).toBe('published');
    expect(getStatusBannerTone('Published')).toBe('published');
  });

  it('treats other statuses as neutral', () => {
    expect(getStatusBannerTone('UNPUBLISHED')).toBe('neutral');
    expect(getStatusBannerTone('IN_REVIEW')).toBe('neutral');
    expect(getStatusBannerTone('REJECTED')).toBe('neutral');
    expect(getStatusBannerTone(undefined)).toBe('neutral');
  });
});
