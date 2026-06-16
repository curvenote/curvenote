import type { VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  functions: {
    // Flat project-root `api/` file (nested api/v1/... is not detected with React Router).
    // deploy-curvenote prebuilds with the submodule checked out before `vercel build`.
    // Local dev uses POST /v1/jobs/mock-push via the mock queue provider instead.
    'api/job-queue-consumer.ts': {
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
