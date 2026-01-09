import type { Config } from '@react-router/dev/config';
import { vercelPreset } from '@vercel/react-router/vite';

export default {
  ssr: true,
  presets: [vercelPreset()],
  serverModuleFormat: 'esm',
  serverBuildFile: 'index.js',
  future: {
    v8_middleware: false,
  },
} satisfies Config;
