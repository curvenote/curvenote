import { KnownJobTypes } from '@curvenote/scms-core';
import type { DispatchJobParams } from '../dispatch.server.js';
import { newDispatchJobId } from './base.js';

export interface UnpublishJobParams {
  site_id: string;
  user_id: string;
  submission_version_id: string;
  cdn: string | null;
  key: string | null;
  invoked_by_id?: string;
}

export function dispatchUnpublish(params: UnpublishJobParams): DispatchJobParams {
  return {
    job_id: newDispatchJobId(),
    job_type: KnownJobTypes.UNPUBLISH,
    payload: {
      site_id: params.site_id,
      user_id: params.user_id,
      submission_version_id: params.submission_version_id,
      cdn: params.cdn,
      key: params.key,
    },
    invoked_by_id: params.invoked_by_id ?? params.user_id,
  };
}
