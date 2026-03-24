import { getConfig } from '../../../app-config.server.js';
import { sendJobPubSubMessage } from '../pubsub.server.js';

export type CheckMessageAttributes = {
  handshake: string;
  job_url?: string;
} & Record<string, string>;

/**
 * Start a check job processing service via Pub/Sub.
 * `data` is the JSON body for the message (aligned with dispatch/converter); attributes may omit `job_id` — it is filled from `data.job_id` when missing.
 */
export async function startCheckProcessingService(
  attributes: CheckMessageAttributes,
  data: Record<string, unknown>,
) {
  const config = await getConfig();
  const devLocalPush =
    process.env.NODE_ENV === 'development' ? { url: 'http://127.0.0.1:8080/' } : undefined;

  return sendJobPubSubMessage({
    attributes,
    data,
    pubSub: {
      projectId: config.api.pubsubProjectId,
      credentialsJson: config.api.checkSASecretKeyfile,
      topicName: config.api.checkTopic,
    },
    devLocalPush,
  });
}
