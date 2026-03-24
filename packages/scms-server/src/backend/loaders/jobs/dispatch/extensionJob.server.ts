import type { FollowOnEnvelope } from '@curvenote/scms-core';
import type { DispatchJobParams } from '../dispatch.server.js';
import { newDispatchJobId } from './base.js';

export interface ExtensionJobParams {
  job_type: string;
  payload: Record<string, any>;
  invoked_by_id?: string;
  activity_type?: string;
  activity_data?: Record<string, unknown>;
  follow_on?: FollowOnEnvelope;
}

export function dispatchExtensionJob(params: ExtensionJobParams): DispatchJobParams {
  return {
    job_id: newDispatchJobId(),
    job_type: params.job_type,
    payload: params.payload,
    invoked_by_id: params.invoked_by_id,
    activity_type: params.activity_type,
    activity_data: params.activity_data,
    follow_on: params.follow_on,
  };
}
