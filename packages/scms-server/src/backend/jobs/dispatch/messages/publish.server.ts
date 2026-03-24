import { KnownJobTypes } from '@curvenote/scms-core';
import type { DispatchJobParams } from '../dispatch.js';
import { newDispatchJobId } from '../utils.js';

export interface PublishJobParams {
  site_id: string;
  user_id: string;
  submission_version_id: string;
  cdn: string | null;
  key: string | null;
  date_published?: string;
  updates_slug?: boolean;
  invoked_by_id?: string;
}

export function createPublishDispatchMessageBody(params: PublishJobParams): DispatchJobParams {
  return {
    job_id: newDispatchJobId(),
    job_type: KnownJobTypes.PUBLISH,
    payload: {
      site_id: params.site_id,
      user_id: params.user_id,
      submission_version_id: params.submission_version_id,
      cdn: params.cdn,
      key: params.key,
      date_published: params.date_published,
      updates_slug: params.updates_slug,
    },
    invoked_by_id: params.invoked_by_id ?? params.user_id,
  };
}
