// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import {
  extensionChecksEnabledFromClientConfig,
  extensionChecksEnabledFromServerConfig,
  getCheckServiceRunServiceData,
  getExtensionCheckServicesFromClientConfig,
  getExtensionCheckServicesFromServerConfig,
  isCheckWorkListSummaryVisible,
} from './checks.js';
import type { ClientExtension, ServerExtension } from './types.js';

/** Minimal React stubs — tests only assert service ids from getChecks(). */
function noopCheckComponent() {
  return null;
}

const mockCheckExtension = {
  id: 'mock-checks',
  name: 'Mock Checks',
  description: 'Test',
  registerNavigation: () => [],
  getChecks: () => [
    {
      id: 'mock-service',
      name: 'Mock Service',
      description: 'Runs mock checks',
      sectionHeaderComponent: noopCheckComponent,
      sectionActivityComponent: noopCheckComponent,
    },
  ],
} satisfies ClientExtension;

describe('extension checks config gates', () => {
  it('server gate only accepts checks === true', () => {
    expect(extensionChecksEnabledFromServerConfig(undefined)).toBe(false);
    expect(extensionChecksEnabledFromServerConfig({})).toBe(false);
    expect(extensionChecksEnabledFromServerConfig({ checks: false })).toBe(false);
    expect(extensionChecksEnabledFromServerConfig({ checks: 'yes' as unknown as boolean })).toBe(
      false,
    );
    expect(extensionChecksEnabledFromServerConfig({ checks: true })).toBe(true);
  });

  it('client gate only accepts capabilities including checks', () => {
    expect(extensionChecksEnabledFromClientConfig(undefined)).toBe(false);
    expect(extensionChecksEnabledFromClientConfig({ capabilities: [] })).toBe(false);
    expect(extensionChecksEnabledFromClientConfig({ capabilities: ['routes'] })).toBe(false);
    expect(extensionChecksEnabledFromClientConfig({ capabilities: ['checks'] })).toBe(true);
  });

  it('server and client gates agree for the same deployment flags', () => {
    const serverConfig = {
      app: { extensions: { 'mock-checks': { checks: true } } },
    } as AppConfig;
    const clientConfig = {
      name: 'test',
      editorApiUrl: 'https://example.com',
      renderServiceUrl: undefined,
      authProviders: [],
      navigation: { items: [] },
      extensions: { 'mock-checks': { name: 'mock-checks', capabilities: ['checks'] } },
    };

    const serverServices = getExtensionCheckServicesFromServerConfig(serverConfig, [
      mockCheckExtension as ServerExtension,
    ]);
    const clientServices = getExtensionCheckServicesFromClientConfig(clientConfig, [
      mockCheckExtension,
    ]);

    expect(serverServices.map((s) => s.id)).toEqual(['mock-service']);
    expect(clientServices.map((s) => s.id)).toEqual(['mock-service']);
  });

  it('truthy non-boolean checks does not enable services on server', () => {
    const serverConfig = {
      app: { extensions: { 'mock-checks': { checks: 'enabled' } } },
    } as AppConfig;
    const services = getExtensionCheckServicesFromServerConfig(serverConfig, [
      mockCheckExtension as ServerExtension,
    ]);
    expect(services).toEqual([]);
  });
});

describe('check work-list summary helpers', () => {
  it('extracts extension serviceData from check run data', () => {
    const serviceData = { score: 73 };

    expect(getCheckServiceRunServiceData({ data: { serviceData } })).toBe(serviceData);
  });

  it('returns undefined when check run data does not contain serviceData', () => {
    expect(getCheckServiceRunServiceData({ data: null })).toBeUndefined();
    expect(getCheckServiceRunServiceData({ data: 'ready' })).toBeUndefined();
    expect(getCheckServiceRunServiceData({ data: { status: 'completed' } })).toBeUndefined();
  });

  it('defaults work-list summaries to visible unless the service predicate hides them', () => {
    expect(isCheckWorkListSummaryVisible({}, { status: 'completed' })).toBe(true);
    expect(
      isCheckWorkListSummaryVisible(
        { isWorkListSummaryVisible: (metadata) => metadata !== 'hide' },
        'show',
      ),
    ).toBe(true);
    expect(
      isCheckWorkListSummaryVisible(
        { isWorkListSummaryVisible: (metadata) => metadata !== 'hide' },
        'hide',
      ),
    ).toBe(false);
  });
});
