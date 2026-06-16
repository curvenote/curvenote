import { PubSub } from '@google-cloud/pubsub';

/** GCP Pub/Sub client targeting (topic id or full resource name, per @google-cloud/pubsub). */
export type PubSubTarget = {
  projectId: string;
  credentialsJson: string;
  topicName: string;
};

/**
 * Simulated Pub/Sub push to a local HTTP endpoint (dev only).
 * The POST body matches real push shape: `message` + optional base64 `data`.
 */
export type DevLocalPush = {
  url: string;
};

export type PubSubMessageArgs = {
  attributes: Record<string, string>;
  data?: Record<string, unknown>;
  pubSub: PubSubTarget;
  /** Local HTTP endpoint to simulate a Pub/Sub push in development. */
  devLocalPush?: DevLocalPush;
};

type PubSubPayload = {
  projectId: string;
  credentialsJson: string;
  topicName: string;
  attributes: Record<string, string>;
  data?: Record<string, unknown>;
};

/**
 * Ensures `job_id` is present on Pub/Sub attributes when it can be inferred from `data`
 * (`job_id` or `taskId`, e.g. converter payload).
 */
export function withJobIdInAttributes(
  attributes: Record<string, string>,
  data?: Record<string, unknown>,
): Record<string, string> {
  if (attributes.job_id) {
    return attributes;
  }
  const jid = data?.job_id ?? data?.taskId;
  if (typeof jid === 'string' && jid.length > 0) {
    return { ...attributes, job_id: jid };
  }
  return attributes;
}

/** HTTP push envelope matching Pub/Sub push JSON (`message.attributes` + optional base64 `message.data`). */
function buildPubSubPushBody(attributes: Record<string, string>, data?: Record<string, unknown>) {
  return {
    message: {
      attributes,
      ...(data !== undefined
        ? { data: Buffer.from(JSON.stringify(data), 'utf-8').toString('base64') }
        : {}),
    },
  };
}

async function sendViaPubSub(spec: PubSubPayload): Promise<string> {
  const pubSubClient = new PubSub({
    projectId: spec.projectId,
    credentials: JSON.parse(spec.credentialsJson),
  });
  const message =
    spec.data !== undefined
      ? {
          data: Buffer.from(JSON.stringify(spec.data), 'utf-8'),
          attributes: spec.attributes,
        }
      : { attributes: spec.attributes };
  return pubSubClient.topic(spec.topicName).publishMessage(message);
}

/**
 * Shared Pub/Sub publisher with automatic routing:
 *
 * 1. **Test** (`NODE_ENV=test` or `APP_CONFIG_ENV=test`) → returns fake ID, no publishing
 * 2. **Dev HTTP stub** (`NODE_ENV=development`, `devLocalPush` provided)
 *    → POSTs a Pub/Sub-shaped envelope directly to the local URL (fire-and-forget)
 * 3. **Production** → uses `@google-cloud/pubsub` client with real GCP credentials
 */
export async function sendJobPubSubMessage(args: PubSubMessageArgs): Promise<string> {
  const { data, pubSub, devLocalPush } = args;
  const attributes = withJobIdInAttributes(args.attributes, data);

  // 1. Test mode — no publishing
  if (process.env.NODE_ENV === 'test' || process.env.APP_CONFIG_ENV === 'test') {
    return 'testPubSubId';
  }

  // 2. Dev HTTP stub — simulate push to local worker endpoint
  if (process.env.NODE_ENV === 'development' && devLocalPush) {
    const body = buildPubSubPushBody(attributes, data);
    fetch(devLocalPush.url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }).then(
      (res) => console.info('[dev local push]', devLocalPush.url, res.status),
      (err) => console.error('[dev local push]', devLocalPush.url, err),
    );
    return 'devLocalPushId';
  }

  // 3. Production — real GCP Pub/Sub
  return sendViaPubSub({ ...pubSub, attributes, data });
}
