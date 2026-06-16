import type { JobQueueProvider } from './types.js';
import { mockQueueProvider } from './mock.server.js';
import { vercelQueueProvider } from './vercel.server.js';

export type QueueProviderName = 'mock' | 'vercel';

export function resolveQueueProviderName(): QueueProviderName {
  const explicit = process.env.QUEUES_PROVIDER as QueueProviderName | undefined;
  if (explicit === 'mock' || explicit === 'vercel') {
    return explicit;
  }
  if (process.env.VERCEL === '1') {
    return 'vercel';
  }
  if (process.env.NODE_ENV === 'test') {
    return 'mock';
  }
  if (process.env.NODE_ENV === 'development') {
    return 'mock';
  }
  return 'vercel';
}

/** True when mock queue loopback delivery to /v1/jobs/vercel-push is enabled. */
export function isLocalMockQueueDeliveryEnabled(): boolean {
  return resolveQueueProviderName() === 'mock';
}

let cachedProvider: JobQueueProvider | null = null;
let cachedName: QueueProviderName | null = null;

export function getJobQueueProvider(): JobQueueProvider {
  const name = resolveQueueProviderName();
  if (cachedProvider && cachedName === name) {
    return cachedProvider;
  }

  switch (name) {
    case 'vercel':
      cachedProvider = vercelQueueProvider;
      break;
    default:
      cachedProvider = mockQueueProvider;
      break;
  }

  cachedName = name;
  return cachedProvider;
}

/** Reset cached provider — for tests only. */
export function resetJobQueueProviderCache(): void {
  cachedProvider = null;
  cachedName = null;
}

export * from './types.js';
export {
  LOCAL_MOCK_QUEUE_HEADER,
  resetMockQueueState,
  resolveMockQueueConsumerUrl,
} from './mock.server.js';
