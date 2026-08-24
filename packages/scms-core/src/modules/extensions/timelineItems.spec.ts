// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import {
  buildExtensionTimelineEntriesForWorkVersion,
  extensionTimelineEnabledFromClientConfig,
  extensionTimelineEnabledFromServerConfig,
  getExtensionTimelineItemsFromClientConfig,
  getExtensionTimelineItemsFromServerConfig,
} from './timelineItems.js';
import type { ClientExtension, ClientExtensionTimelineItem } from './types.js';

function noopTimelineComponent() {
  return null;
}

const mockTimelineItem: ClientExtensionTimelineItem = {
  id: 'mock-item',
  surfaces: ['work-version'],
  sortRank: 10,
  isVisible: ({ metadata, draft }) =>
    !draft && Boolean((metadata as { foundry?: unknown } | null)?.foundry),
  component: noopTimelineComponent,
};

const mockTimelineExtension = {
  id: 'mock-ext',
  name: 'Mock Ext',
  description: 'Test',
  registerNavigation: () => [],
  getTimelineItems: () => [mockTimelineItem],
} satisfies ClientExtension;

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

describe('buildExtensionTimelineEntriesForWorkVersion', () => {
  const version = {
    id: 'wv-1',
    work_id: 'work-1',
    date_created: '2026-01-01T10:00:00.000Z',
    date_modified: '2026-01-02T12:00:00.000Z',
    draft: false,
    metadata: { foundry: {} },
  };

  it('returns visible extension entries for matching metadata', () => {
    const entries = buildExtensionTimelineEntriesForWorkVersion('work-1', version, [
      { extensionId: 'mock-ext', item: mockTimelineItem },
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.key).toBe('extension-timeline-mock-ext-mock-item-wv-1');
    expect(entries[0]?.date).toBe('2026-01-02T12:00:00.000Z');
    expect(entries[0]?.sortRank).toBe(10);
    expect(entries[0]?.ctx.surface).toBe('work-version');
  });

  it('hides entries on draft versions', () => {
    const entries = buildExtensionTimelineEntriesForWorkVersion(
      'work-1',
      { ...version, draft: true },
      [{ extensionId: 'mock-ext', item: mockTimelineItem }],
    );
    expect(entries).toHaveLength(0);
  });

  it('skips items that do not include the requested surface', () => {
    const entries = buildExtensionTimelineEntriesForWorkVersion('work-1', version, [
      {
        extensionId: 'mock-ext',
        item: { ...mockTimelineItem, surfaces: ['submission-version'] },
      },
    ]);
    expect(entries).toHaveLength(0);
  });
});
