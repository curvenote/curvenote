export type JobQueueMessage = {
  job_id: string;
  job_type: string;
  handshake: string;
};

export type JobQueueSendOptions = {
  idempotencyKey: string;
};

export type JobQueueSendResult = {
  messageId: string;
};

export type JobQueueDeliveryMetadata = {
  deliveryCount: number;
  messageId: string;
};

/** Provider-specific receipt returned from readOne (pgmq msg_id, mock entry ref, etc.). */
export type QueueReadReceipt = unknown;

export type QueueReadResult = {
  message: JobQueueMessage;
  metadata: JobQueueDeliveryMetadata;
  receipt: QueueReadReceipt;
};

export interface JobQueueProvider {
  send(message: JobQueueMessage, options: JobQueueSendOptions): Promise<JobQueueSendResult>;
  readOne(): Promise<QueueReadResult | null>;
  ack(receipt: QueueReadReceipt): Promise<void>;
  /** Leave message for retry (pgmq visibility timeout) or re-queue (mock). */
  nack(receipt: QueueReadReceipt): Promise<void>;
  getDepth(): Promise<number>;
}
