import { getConfig } from '../../../app-config.server.js';
import { sendJobPubSubMessage } from '../pubsub.server.js';

export type ConverterMessageAttributes = {
  handshake: string;
  jobUrl: string;
  userId: string;
  statusUrl?: string;
  successState?: string;
  failureState?: string;
} & Record<string, string>;

/**
 * Start a converter job processing service via Pub/Sub.
 *
 * Routing (handled by sendJobPubSubMessage):
 *  - test → fake ID, no publish
 *  - PUBSUB_EMULATOR_HOST set → publishes to emulator
 *  - development (no emulator) → HTTP stub POST to localhost:8080
 *  - production → real GCP Pub/Sub
 */
export async function startConverterService(
  attributes: ConverterMessageAttributes,
  data: Record<string, unknown>,
): Promise<string> {
  // Match `sendJobPubSubMessage` test short-circuit: avoid loading/validating Pub/Sub config
  // when we never publish (tests often omit converterTopic / SA keyfile).
  if (process.env.NODE_ENV === 'test' || process.env.APP_CONFIG_ENV === 'test') {
    return 'testPubSubId';
  }

  const config = await getConfig();

  return sendJobPubSubMessage({
    attributes,
    data,
    pubSub: {
      projectId: config.api.pubsubProjectId ?? 'local-dev',
      credentialsJson: config.api.converterSASecretKeyfile ?? '{}',
      topicName: config.api.converterTopic ?? 'scmsTaskConverterTopic',
    },
    devLocalPush: { url: 'http://127.0.0.1:8080/' },
  });
}
