import { KnownJobTypes } from '@curvenote/scms-core';
import type { DispatchJobParams } from '../dispatch.js';
import { newDispatchJobId } from '../utils.js';

export interface CheckJobParams {
  payload: Record<string, any>;
  invoked_by_id?: string;
  activity_type?: string;
  activity_data?: Record<string, unknown>;
}

export function createCheckDispatchMessageBody(params: CheckJobParams): DispatchJobParams {
  return {
    job_id: newDispatchJobId(),
    job_type: KnownJobTypes.CHECK,
    payload: params.payload,
    invoked_by_id: params.invoked_by_id,
    activity_type: params.activity_type,
    activity_data: params.activity_data,
  };
}
