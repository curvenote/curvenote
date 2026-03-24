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
  const topicName = config.api.converterTopic;

  const useDevHttpStub =
    process.env.NODE_ENV === 'development' && process.env.DEV_PUBSUB_CONVERTER !== 'true';
  const devLocalPush = useDevHttpStub ? { url: 'http://127.0.0.1:8080/' } : undefined;

  if (useDevHttpStub) {
    console.log('publishing converter message to localhost', attributes.jobUrl);
  }

  return sendJobPubSubMessage({
    attributes,
    data,
    pubSub: {
      projectId: config.api.pubsubProjectId,
      credentialsJson: config.api.converterSASecretKeyfile,
      topicName,
    },
    devLocalPush,
  });
}
