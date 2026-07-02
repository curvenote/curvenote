import type { ServerExtension } from '@curvenote/scms-core';
import { extension as clientExtension } from './client.js';

export const extension: ServerExtension = {
  ...clientExtension,
};
