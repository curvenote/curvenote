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

export interface JobQueueProvider {
  send(message: JobQueueMessage, options: JobQueueSendOptions): Promise<JobQueueSendResult>;
}

export type JobQueueDeliveryMetadata = {
  deliveryCount: number;
  messageId: string;
};
