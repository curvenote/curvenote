import type {
  IngestInstanceConfig,
  ServicePlugin,
  PluginOperationResult,
  PluginReportResult,
  WebhookRequest,
  WebhookParseResult,
  WebhookVerifyRequest,
  PluginUploadPayload,
} from "@curvenote/check-plugin-types";

const NI: PluginOperationResult = {
  status: "error",
  message: "Not implemented",
  result: null,
};

/**
 * Minimal ServicePlugin for relay tests; override methods as needed.
 */
export function makeTestPlugin(
  name: string,
  overrides?: Partial<ServicePlugin>,
): ServicePlugin {
  const base: ServicePlugin = {
    name,
    manifest: {
      name,
      title: `${name} Service`,
      description: `Test plugin ${name}`,
      version: "1.0.0",
      logo: `https://example.com/${name}/logo.svg`,
      metadata: {},
    },
    getInstanceStatus: async () => ({ test: true, service: name }),
    configure: async (_c, _b, _ctx) => ({
      status: "completed",
      result: { ok: true },
    }),
    getTerms: async () => ({ status: "completed", result: {} }),
    upload: async (
      _c: Record<string, unknown>,
      payload: PluginUploadPayload,
    ) => ({
      status: "submitted",
      result: { externalId: `ext-${payload.clientId ?? "123"}` },
    }),
    getCheckStatus: async () => null,
    getReportViewerUrl: async () => NI,
    getCheckArtifacts: async () => NI,
    startReportGeneration: async () => ({
      status: "processing",
      message: "started",
      result: null,
    }),
    triggerProcessingStage: async (
      _c: Record<string, unknown>,
      externalId: string,
      body: Record<string, unknown>,
    ) => ({
      status: "completed" as const,
      result: { phase: body.phase, externalId },
    }),
    fetchReport: async (): Promise<PluginReportResult> => ({
      kind: "json",
      response: NI,
    }),
    verifyWebhook: async (
      _r: WebhookVerifyRequest,
      _instance: IngestInstanceConfig,
    ): Promise<void> => {},

    parseWebhook: async (
      _r: WebhookRequest,
      _instance: IngestInstanceConfig,
    ): Promise<WebhookParseResult> => ({
      status: "completed",
      externalId: "test-webhook-ext",
      result: {},
    }),
  };
  return {
    ...base,
    ...overrides,
    manifest: overrides?.manifest ?? base.manifest,
  };
}
