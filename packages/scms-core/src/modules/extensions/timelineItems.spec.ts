// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it, vi } from 'vitest';
import {
  buildExtensionTimelineEntriesForWorkVersion,
  extensionTimelineEnabledFromClientConfig,
  extensionTimelineEnabledFromServerConfig,
  getExtensionTimelineItemsFromClientConfig,
  getExtensionTimelineItemsFromServerConfig,
  resolveExtensionTimelineDescriptors,
} from './timelineItems.js';
import type {
  ClientExtension,
  ClientExtensionTimelineItem,
  ExtensionTimelineItemDescriptor,
  ServerExtension,
} from './types.js';

function noopTimelineComponent() {
  return null;
}

const mockTimelineItem: ClientExtensionTimelineItem = {
  id: 'mock-item',
  surfaces: ['work-version'],
  sortRank: 10,
  component: noopTimelineComponent,
};

const mockTimelineExtension = {
  id: 'mock-ext',
  name: 'Mock Ext',
  description: 'Test',
  registerNavigation: () => [],
  getTimelineItems: () => [mockTimelineItem],
} satisfies ClientExtension;

const version = {
  id: 'wv-1',
  work_id: 'work-1',
  date_created: '2026-01-01T10:00:00.000Z',
  date_modified: '2026-01-02T12:00:00.000Z',
  draft: false,
  metadata: { files: {} },
};

const matchingDescriptor: ExtensionTimelineItemDescriptor = {
  extensionId: 'mock-ext',
  itemId: 'mock-item',
  workVersionId: 'wv-1',
  sortDate: '2026-01-02T12:00:00.000Z',
  payload: { canOpen: true },
};

describe('extension timeline config gates', () => {
  it('server gate only accepts routes === true', () => {
    expect(extensionTimelineEnabledFromServerConfig(undefined)).toBe(false);
    expect(extensionTimelineEnabledFromServerConfig({})).toBe(false);
    expect(extensionTimelineEnabledFromServerConfig({ routes: false })).toBe(false);
    expect(extensionTimelineEnabledFromServerConfig({ routes: true })).toBe(true);
  });

  it('client gate only accepts capabilities including routes', () => {
    expect(extensionTimelineEnabledFromClientConfig(undefined)).toBe(false);
    expect(extensionTimelineEnabledFromClientConfig({ capabilities: [] })).toBe(false);
    expect(extensionTimelineEnabledFromClientConfig({ capabilities: ['checks'] })).toBe(false);
    expect(extensionTimelineEnabledFromClientConfig({ capabilities: ['routes'] })).toBe(true);
  });

  it('collects timeline items only from route-enabled extensions', () => {
    const serverConfig = {
      app: { extensions: { 'mock-ext': { routes: true } } },
    } as AppConfig;
    const clientConfig = {
      name: 'test',
      editorApiUrl: 'https://example.com',
      renderServiceUrl: undefined,
      workVersionPreviewUrl: 'http://localhost:3810',
      authProviders: [],
      navigation: { items: [] },
      extensions: { 'mock-ext': { name: 'mock-ext', capabilities: ['routes'] } },
    };

    expect(
      getExtensionTimelineItemsFromServerConfig(serverConfig, [mockTimelineExtension]).map(
        (entry) => entry.item.id,
      ),
    ).toEqual(['mock-item']);
    expect(
      getExtensionTimelineItemsFromClientConfig(clientConfig, [mockTimelineExtension]).map(
        (entry) => entry.item.id,
      ),
    ).toEqual(['mock-item']);
  });
});

describe('resolveExtensionTimelineDescriptors', () => {
  it('merges descriptors from route-enabled extensions that implement resolveTimelineItems', async () => {
    const resolveTimelineItems = vi.fn(async () => [matchingDescriptor]);
    const ext = {
      ...mockTimelineExtension,
      resolveTimelineItems,
    } satisfies ServerExtension;

    const result = await resolveExtensionTimelineDescriptors(
      { app: { extensions: { 'mock-ext': { routes: true } } } } as AppConfig,
      [ext],
      {
        ctx: {} as Parameters<typeof resolveExtensionTimelineDescriptors>[2]['ctx'],
        surface: 'work-version',
        workVersions: [version],
      },
    );

    expect(resolveTimelineItems).toHaveBeenCalledOnce();
    expect(result).toEqual([matchingDescriptor]);
  });

  it('skips extensions without routes or resolveTimelineItems', async () => {
    const resolveTimelineItems = vi.fn(async () => [matchingDescriptor]);
    const withResolver = {
      ...mockTimelineExtension,
      resolveTimelineItems,
    } satisfies ServerExtension;

    const disabled = await resolveExtensionTimelineDescriptors(
      { app: { extensions: { 'mock-ext': { routes: false } } } } as AppConfig,
      [withResolver],
      {
        ctx: {} as Parameters<typeof resolveExtensionTimelineDescriptors>[2]['ctx'],
        surface: 'work-version',
        workVersions: [version],
      },
    );
    expect(disabled).toEqual([]);
    expect(resolveTimelineItems).not.toHaveBeenCalled();

    const noResolver = await resolveExtensionTimelineDescriptors(
      { app: { extensions: { 'mock-ext': { routes: true } } } } as AppConfig,
      [mockTimelineExtension],
      {
        ctx: {} as Parameters<typeof resolveExtensionTimelineDescriptors>[2]['ctx'],
        surface: 'work-version',
        workVersions: [version],
      },
    );
    expect(noResolver).toEqual([]);
  });
});

describe('buildExtensionTimelineEntriesForWorkVersion', () => {
  it('builds entries from matching descriptors and registered definitions', () => {
    const entries = buildExtensionTimelineEntriesForWorkVersion(
      'work-1',
      version,
      [{ extensionId: 'mock-ext', item: mockTimelineItem }],
      [matchingDescriptor],
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]?.key).toBe('extension-timeline-mock-ext-mock-item-wv-1-0');
    expect(entries[0]?.date).toBe('2026-01-02T12:00:00.000Z');
    expect(entries[0]?.sortRank).toBe(10);
    expect(entries[0]?.props.surface).toBe('work-version');
    expect(entries[0]?.props.payload).toEqual({ canOpen: true });
    expect(entries[0]?.definition).toBe(mockTimelineItem);
  });

  it('uses descriptor id in the key when provided', () => {
    const entries = buildExtensionTimelineEntriesForWorkVersion(
      'work-1',
      version,
      [{ extensionId: 'mock-ext', item: mockTimelineItem }],
      [{ ...matchingDescriptor, id: 'attempt-a' }],
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]?.key).toBe('extension-timeline-mock-ext-mock-item-wv-1-attempt-a');
  });

  it('produces unique keys for multiple rows of the same item on one version', () => {
    const entries = buildExtensionTimelineEntriesForWorkVersion(
      'work-1',
      version,
      [{ extensionId: 'mock-ext', item: mockTimelineItem }],
      [
        {
          ...matchingDescriptor,
          id: 'ingest-1',
          sortDate: '2026-01-02T10:00:00.000Z',
          payload: { attempt: 1 },
        },
        {
          ...matchingDescriptor,
          id: 'ingest-2',
          sortDate: '2026-01-02T11:00:00.000Z',
          payload: { attempt: 2 },
        },
      ],
    );

    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.key)).toEqual([
      'extension-timeline-mock-ext-mock-item-wv-1-ingest-1',
      'extension-timeline-mock-ext-mock-item-wv-1-ingest-2',
    ]);
  });

  it('falls back to descriptor array index when id is omitted', () => {
    const entries = buildExtensionTimelineEntriesForWorkVersion(
      'work-1',
      version,
      [{ extensionId: 'mock-ext', item: mockTimelineItem }],
      [
        { ...matchingDescriptor, sortDate: '2026-01-02T10:00:00.000Z' },
        { ...matchingDescriptor, sortDate: '2026-01-02T11:00:00.000Z' },
      ],
    );

    expect(entries.map((e) => e.key)).toEqual([
      'extension-timeline-mock-ext-mock-item-wv-1-0',
      'extension-timeline-mock-ext-mock-item-wv-1-1',
    ]);
  });

  it('returns no entries when descriptors are empty even if metadata would match', () => {
    const entries = buildExtensionTimelineEntriesForWorkVersion(
      'work-1',
      { ...version, metadata: { foundry: {} } },
      [{ extensionId: 'mock-ext', item: mockTimelineItem }],
      [],
    );
    expect(entries).toHaveLength(0);
  });

  it('skips descriptors without a registered definition', () => {
    const entries = buildExtensionTimelineEntriesForWorkVersion(
      'work-1',
      version,
      [],
      [matchingDescriptor],
    );
    expect(entries).toHaveLength(0);
  });

  it('skips descriptors for other work versions', () => {
    const entries = buildExtensionTimelineEntriesForWorkVersion(
      'work-1',
      version,
      [{ extensionId: 'mock-ext', item: mockTimelineItem }],
      [{ ...matchingDescriptor, workVersionId: 'wv-other' }],
    );
    expect(entries).toHaveLength(0);
  });

  it('skips definitions that do not include the requested surface', () => {
    const entries = buildExtensionTimelineEntriesForWorkVersion(
      'work-1',
      version,
      [
        {
          extensionId: 'mock-ext',
          item: { ...mockTimelineItem, surfaces: ['submission-version'] },
        },
      ],
      [matchingDescriptor],
    );
    expect(entries).toHaveLength(0);
  });

  it('passes the requested surface through to entry props', () => {
    const submissionItem: ClientExtensionTimelineItem = {
      ...mockTimelineItem,
      surfaces: ['submission-version'],
    };
    const entries = buildExtensionTimelineEntriesForWorkVersion(
      'work-1',
      version,
      [{ extensionId: 'mock-ext', item: submissionItem }],
      [matchingDescriptor],
      'submission-version',
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]?.props.surface).toBe('submission-version');
  });
});
