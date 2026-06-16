import type { VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  functions: {
    // Source route path (same convention as Next.js `app/api/.../route.ts` in queue docs).
    // Do not use `api/...` here — that only matches standalone files under project-root `api/`.
    'app/routes/api/v1.jobs.vercel-push/route.tsx': {
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
