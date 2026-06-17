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

/** A read-only view of a queued message for admin/monitoring (not a consume). */
export type QueuePeekEntry = {
  messageId: string;
  jobId: string;
  jobType: string;
  /** pgmq read_ct: number of times the message has been read (delivery attempts). */
  deliveryCount: number;
  /** ISO timestamp the message was enqueued, when known. */
  enqueuedAt: string | null;
  /** ISO timestamp the message next becomes visible (pgmq vt), when known. */
  visibleAt: string | null;
  /** True when the message is currently leased/being processed (vt in the future). */
  inFlight: boolean;
};

export interface JobQueueProvider {
  /**
   * True when the provider guarantees a drain wake on enqueue without the
   * caller self-calling push-to-drain (e.g. a Postgres pg_net trigger on the
   * pgmq queue table). When true, `dispatchJob` skips the app-side wake.
   */
  wakesOnEnqueue?: boolean;
  send(message: JobQueueMessage, options: JobQueueSendOptions): Promise<JobQueueSendResult>;
  readOne(): Promise<QueueReadResult | null>;
  ack(receipt: QueueReadReceipt): Promise<void>;
  /** Leave message for retry (pgmq visibility timeout) or re-queue (mock). */
  nack(receipt: QueueReadReceipt): Promise<void>;
  getDepth(): Promise<number>;
  /**
   * Read-only tail of the queue for admin/monitoring. Returns the most recent
   * messages still in the queue (including in-flight/unacked). Does not consume.
   */
  peek?(limit: number): Promise<QueuePeekEntry[]>;
}
