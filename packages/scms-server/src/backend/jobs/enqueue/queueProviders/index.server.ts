import type { JobQueueProvider } from './types.js';
import { mockQueueProvider } from './mock.server.js';
import { supabaseQueueProvider } from './supabase.server.js';

export type QueueProviderName = 'mock' | 'supabase';

export function resolveQueueProviderName(): QueueProviderName {
  const explicit = process.env.QUEUES_PROVIDER as QueueProviderName | undefined;
  if (explicit === 'mock' || explicit === 'supabase') {
    return explicit;
  }
  if (process.env.VERCEL === '1') {
    return 'supabase';
  }
  // Tests use the in-process mock queue (no Postgres pgmq/pg_net in CI).
  if (process.env.NODE_ENV === 'test') {
    return 'mock';
  }
  // Local dev now runs the real pgmq + pg_net stack against the Docker
  // Postgres (parity with staging/prod). Set QUEUES_PROVIDER=mock to opt back
  // into the in-memory queue (e.g. when the local container lacks pgmq).
  return 'supabase';
}

let cachedProvider: JobQueueProvider | null = null;
let cachedName: QueueProviderName | null = null;

export function getJobQueueProvider(): JobQueueProvider {
  const name = resolveQueueProviderName();
  if (cachedProvider && cachedName === name) {
    return cachedProvider;
  }

  switch (name) {
    case 'supabase':
      cachedProvider = supabaseQueueProvider;
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
export { resolveMockQueueDrainUrl, resetMockQueueState } from './mock.server.js';
export { PGMQ_JOB_QUEUE_NAME, PGMQ_VISIBILITY_TIMEOUT_SECONDS } from './supabase.server.js';
