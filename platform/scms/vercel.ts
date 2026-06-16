import type { VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  functions: {
    // Verify this key against post-build output after deploy (`find .vercel/output -name '*vercel-push*'`)
    'api/v1/jobs/vercel-push/route.js': {
      experimentalTriggers: [
        {
          type: 'queue/v2beta',
          topic: 'job',
          initialDelaySeconds: 0,
        },
      ],
    },
  },
};
