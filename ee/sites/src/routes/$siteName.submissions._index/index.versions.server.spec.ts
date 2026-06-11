// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import {
  firstVersionTag,
  queueFromMetadata,
  queueNameFromMetadata,
  staffQueueFromMetadata,
} from './index.versions.server.js';

describe('firstVersionTag', () => {
  it('returns the first submission version tag', () => {
    expect(firstVersionTag({ tags: ['v2'] })).toBe('v2');
  });

  it('returns undefined when the submission version has no tags', () => {
    expect(firstVersionTag({ tags: [] })).toBeUndefined();
  });
});

describe('queueFromMetadata', () => {
  it('returns name and staff when queue object is present', () => {
    expect(queueFromMetadata({ queue: { name: 'new-papers', staff: true } })).toEqual({
      name: 'new-papers',
      staff: true,
    });
  });

  it('returns undefined when metadata or queue is absent', () => {
    expect(queueFromMetadata(undefined)).toBeUndefined();
    expect(queueFromMetadata(null)).toBeUndefined();
    expect(queueFromMetadata({})).toBeUndefined();
    expect(queueFromMetadata({ queue: null })).toBeUndefined();
  });

  it('returns undefined for non-object queue values', () => {
    expect(queueFromMetadata({ queue: 'new-papers' })).toBeUndefined();
    expect(queueFromMetadata({ queue: ['new-papers'] })).toBeUndefined();
  });

  it('returns undefined when name is missing or blank', () => {
    expect(queueFromMetadata({ queue: {} })).toBeUndefined();
    expect(queueFromMetadata({ queue: { staff: true } })).toBeUndefined();
    expect(queueFromMetadata({ queue: { name: '' } })).toBeUndefined();
    expect(queueFromMetadata({ queue: { name: '   ' } })).toBeUndefined();
  });

  it('does not read legacy metadata.queue.current', () => {
    expect(queueFromMetadata({ queue: { current: 'new-papers', staff: true } })).toBeUndefined();
  });
});

describe('queueNameFromMetadata', () => {
  it('returns metadata.queue.name when present', () => {
    expect(queueNameFromMetadata({ queue: { name: 'new-papers' } })).toBe('new-papers');
  });

  it('trims whitespace from the queue name', () => {
    expect(queueNameFromMetadata({ queue: { name: '  affiliates  ' } })).toBe('affiliates');
  });
});

describe('staffQueueFromMetadata', () => {
  it('returns true only when queue name and staff flag are present', () => {
    expect(staffQueueFromMetadata({ queue: { name: 'new-papers', staff: true } })).toBe(true);
  });

  it('returns false when staff is set without a queue name', () => {
    expect(staffQueueFromMetadata({ queue: { staff: true } })).toBe(false);
  });

  it('returns false when queue metadata is absent', () => {
    expect(staffQueueFromMetadata({ queue: { name: 'new-papers', staff: false } })).toBe(false);
    expect(staffQueueFromMetadata({})).toBe(false);
    expect(staffQueueFromMetadata(null)).toBe(false);
    expect(staffQueueFromMetadata({ other: true })).toBe(false);
  });
});
