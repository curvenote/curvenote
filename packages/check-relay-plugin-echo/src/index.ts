import {
  WebhookSignatureInvalidError,
  type IngestInstanceConfig,
  type ServicePlugin,
  type PluginOperationResult,
  type PluginConfigureContext,
  type PluginReportResult,
  type WebhookRequest,
  type WebhookParseResult,
  type WebhookVerifyRequest,
  type PluginUploadPayload,
} from '@curvenote/check-plugin-types';

const ECHO_OPERATIONS = [
  'instanceStatus',
  'configure',
  'terms',
  'upload',
  'checkStatus',
  'reportViewerUrl',
  'checkArtifacts',
  'startReportGeneration',
  'fetchReport',
  'triggerProcessingStage',
] as const;

function notImplemented(): PluginOperationResult {
  return {
    status: 'error',
    message: 'Not implemented for echo service',
    result: null,
  };
}

const echoPlugin: ServicePlugin = {
  name: 'echo',

  manifest: {
    name: 'echo',
    title: 'Echo Check Service',
    description: 'A test plugin that echoes submissions and simulates a multi-step check workflow',
    version: '1.0.0',
    logo: '/api/assets/echo/logo.svg',
    metadata: {
      provider: 'checks-relay',
      environment: 'development',
    },
  },

  async getInstanceStatus(_credentials: Record<string, unknown>, _body: Record<string, unknown>) {
    return {
      apiVersion: '1',
      service: 'echo',
      operations: [...ECHO_OPERATIONS],
      note: 'Echo service status is a static catalog; use POST …/instances/:instanceId/upload for checks; artifacts and report routes live under …/check/:externalId/…',
    };
  },

  async configure(
    _credentials: Record<string, unknown>,
    _body: Record<string, unknown>,
    _context?: PluginConfigureContext,
  ): Promise<PluginOperationResult> {
    return {
      status: 'completed',
      result: {
        provider: 'checks-relay',
        note: 'Echo has no external provider instance configuration.',
      },
    };
  },

  async getTerms(
    _credentials: Record<string, unknown>,
    _body: Record<string, unknown>,
  ): Promise<PluginOperationResult> {
    return {
      status: 'completed',
      result: {
        type: 'none',
        message: 'Echo has no provider EULA.',
      },
    };
  },

  async upload(
    _credentials: Record<string, unknown>,
    payload: PluginUploadPayload,
  ): Promise<PluginOperationResult> {
    const id = payload.clientId ?? 'unknown';
    return {
      status: 'submitted',
      result: { externalId: `echo-${id}` },
    };
  },

  async getCheckStatus(
    _credentials: Record<string, unknown>,
    _externalId: string,
    _body: Record<string, unknown>,
  ): Promise<PluginOperationResult | null> {
    return null;
  },

  async getReportViewerUrl(
    _credentials: Record<string, unknown>,
    _externalId: string,
    _body: Record<string, unknown>,
  ): Promise<PluginOperationResult> {
    return notImplemented();
  },

  async getCheckArtifacts(
    _credentials: Record<string, unknown>,
    _externalId: string,
    _body: Record<string, unknown>,
  ): Promise<PluginOperationResult> {
    return notImplemented();
  },

  async startReportGeneration(
    _credentials: Record<string, unknown>,
    _externalId: string,
    _body: Record<string, unknown>,
  ): Promise<PluginOperationResult> {
    return notImplemented();
  },

  async triggerProcessingStage(
    _credentials: Record<string, unknown>,
    externalId: string,
    body: Record<string, unknown>,
  ): Promise<PluginOperationResult> {
    const phase = body.phase;
    return {
      status: 'completed',
      result: {
        externalId,
        phase: typeof phase === 'string' ? phase : String(phase),
        note: 'Echo does not run real stages; this acknowledges the trigger.',
      },
    };
  },

  async fetchReport(
    _credentials: Record<string, unknown>,
    _externalId: string,
    _body: Record<string, unknown>,
  ): Promise<PluginReportResult> {
    return {
      kind: 'json',
      response: notImplemented(),
    };
  },

  async verifyWebhook(
    _request: WebhookVerifyRequest,
    _instance: IngestInstanceConfig,
  ): Promise<void> {
    throw new WebhookSignatureInvalidError('Webhook ingestion is disabled for the echo service');
  },

  async parseWebhook(
    request: WebhookRequest,
    _instance: IngestInstanceConfig,
  ): Promise<WebhookParseResult> {
    const body = request.body as Record<string, unknown>;
    const step = body.step as string | undefined;
    const externalId = (body.externalId ?? body.externalRef) as string | undefined;

    switch (step) {
      case 'analyzing':
        return {
          externalId,
          status: 'processing',
          message: 'Analyzing document',
          result: null,
        };

      case 'complete':
        return {
          externalId,
          status: 'completed',
          message: 'Analysis complete',
          result: {
            summary: 'Echo analysis complete',
            filesProcessed: body.filesProcessed ?? 1,
            findings: body.findings ?? [],
            ...((body.result as Record<string, unknown>) ?? {}),
          },
        };

      case 'failed':
        return {
          externalId,
          status: 'failed',
          message: (body.reason as string) ?? 'Processing failed',
          result: {
            error: (body.reason as string) ?? 'Unknown error',
          },
        };

      default:
        return {
          externalId,
          status: 'processing',
          message: `Received update: ${JSON.stringify(body)}`,
          result: null,
        };
    }
  },
};

export default echoPlugin;
