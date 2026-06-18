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

export type QueueReadResult = {
  message: JobQueueMessage;
  metadata: JobQueueDeliveryMetadata;
  /** pgmq message id, passed back to ack. */
  msgId: bigint;
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
