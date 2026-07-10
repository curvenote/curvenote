// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import {
  extensionChecksEnabledFromClientConfig,
  extensionChecksEnabledFromServerConfig,
  getCheckServiceRunServiceData,
  getExtensionCheckServicesFromClientConfig,
  getExtensionCheckServicesFromServerConfig,
  isCheckWorkListSummaryVisible,
  resolveExtensionDesignLoaderData,
  resolveUploadCheckLogoUrls,
  sortExtensionCheckServicesByExtensionName,
} from './checks.js';
import type { ClientExtension, ServerExtension } from './types.js';
import type { Context } from '../../backend/types.js';

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

describe('sortExtensionCheckServicesByExtensionName', () => {
  const zebraExtension = {
    id: 'zebra-checks',
    name: 'Zebra Checks',
    description: 'Test',
    registerNavigation: () => [],
    getChecks: () => [
      {
        id: 'zebra-service',
        name: 'Zebra Service',
        description: 'Runs zebra checks',
        sectionHeaderComponent: noopCheckComponent,
        sectionActivityComponent: noopCheckComponent,
      },
    ],
  } satisfies ClientExtension;

  const alphaExtension = {
    id: 'alpha-checks',
    name: 'Alpha Checks',
    description: 'Test',
    registerNavigation: () => [],
    getChecks: () => [
      {
        id: 'alpha-service',
        name: 'Alpha Service',
        description: 'Runs alpha checks',
        sectionHeaderComponent: noopCheckComponent,
        sectionActivityComponent: noopCheckComponent,
      },
    ],
  } satisfies ClientExtension;

  it('orders check services alphabetically by extension name', () => {
    const services = [
      {
        id: 'zebra-service',
        name: 'Zebra Service',
        description: 'Runs zebra checks',
        sectionHeaderComponent: noopCheckComponent,
        sectionActivityComponent: noopCheckComponent,
      },
      {
        id: 'alpha-service',
        name: 'Alpha Service',
        description: 'Runs alpha checks',
        sectionHeaderComponent: noopCheckComponent,
        sectionActivityComponent: noopCheckComponent,
      },
    ];

    expect(
      sortExtensionCheckServicesByExtensionName(services, [zebraExtension, alphaExtension]).map(
        (service) => service.id,
      ),
    ).toEqual(['alpha-service', 'zebra-service']);
  });
});

describe('extension loader helpers', () => {
  const ctx = { $config: { app: { extensions: {} } } } as Context;

  it('resolveUploadCheckLogoUrls collects logos from services that implement the hook', async () => {
    const ext = {
      ...mockCheckExtension,
      getChecks: () => [
        {
          id: 'with-logo',
          name: 'With Logo',
          description: 'Test',
          sectionHeaderComponent: noopCheckComponent,
          sectionActivityComponent: noopCheckComponent,
          resolveUploadLogoUrl: async () => 'https://logo.example/a.svg',
        },
        {
          id: 'without-hook',
          name: 'Without Hook',
          description: 'Test',
          sectionHeaderComponent: noopCheckComponent,
          sectionActivityComponent: noopCheckComponent,
        },
      ],
    } as ServerExtension;

    const serverConfig = {
      app: { extensions: { 'mock-checks': { checks: true } } },
    } as AppConfig;

    await expect(resolveUploadCheckLogoUrls(ctx, serverConfig, [ext])).resolves.toEqual({
      'with-logo': 'https://logo.example/a.svg',
    });
  });

  it('resolveExtensionDesignLoaderData collects data from extensions with getDesignLoaderData', async () => {
    const ext = {
      ...mockCheckExtension,
      getDesignLoaderData: async () => ({ designManifest: { logo: 'https://logo.example/b.svg' } }),
    } as ServerExtension;

    await expect(resolveExtensionDesignLoaderData(ctx, [ext])).resolves.toEqual({
      'mock-checks': { designManifest: { logo: 'https://logo.example/b.svg' } },
    });
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
