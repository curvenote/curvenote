import { KnownJobTypes } from '@curvenote/scms-core';
import type { DispatchJobParams } from '../dispatch.js';
import { newDispatchJobId } from '../utils.js';

export interface LoopbackJobParams {
  invoked_by_id?: string;
}

export function dispatchLoopbackJob(params?: LoopbackJobParams): DispatchJobParams {
  return {
    job_id: newDispatchJobId(),
    job_type: KnownJobTypes.LOOPBACK,
    payload: {},
    invoked_by_id: params?.invoked_by_id,
  };
}
