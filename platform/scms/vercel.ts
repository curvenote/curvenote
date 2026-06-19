import type { VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  functions: {
    'app/routes/api/v1.jobs.push-to-drain/route.tsx': {
      maxDuration: 300,
    },
  },
};
