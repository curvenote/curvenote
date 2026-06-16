import { send } from '@vercel/queue';
import type {
  JobQueueMessage,
  JobQueueProvider,
  JobQueueSendOptions,
  JobQueueSendResult,
} from './types.js';

export const vercelQueueProvider: JobQueueProvider = {
  async send(message: JobQueueMessage, options: JobQueueSendOptions): Promise<JobQueueSendResult> {
    const { messageId } = await send('job', message, { idempotencyKey: options.idempotencyKey });
    return { messageId: messageId ?? options.idempotencyKey };
  },
};
