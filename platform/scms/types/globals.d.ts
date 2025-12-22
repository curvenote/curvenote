import type { Config } from './app-config';

declare module 'react-syntax-highlighter/dist/esm/styles/*';

declare global {
  export type AppConfig = Config;
}
