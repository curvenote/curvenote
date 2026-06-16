import type { VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  functions: {
    // Production queue consumer — must live under project-root `api/` (see api/v1/jobs/vercel-push.ts).
    // Local dev uses POST /v1/jobs/mock-push via the mock queue provider instead.
    'api/v1/jobs/vercel-push.ts': {
      maxDuration: 300,
      experimentalTriggers: [
        {
          type: 'queue/v2beta',
          topic: 'job',
          retryAfterSeconds: 60,
          initialDelaySeconds: 0,
        },
      ],
    },
  },
};
