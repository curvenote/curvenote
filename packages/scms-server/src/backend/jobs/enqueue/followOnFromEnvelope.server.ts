import type { DependentJobSpec, FollowOnEnvelope } from '@curvenote/scms-core';
import { uuidv7 } from 'uuidv7';

/**
 * Convert a legacy follow_on envelope into BLOCKED dependent job specs (SUCCESS trigger).
 */
export function followOnFromEnvelope(followOn: FollowOnEnvelope): DependentJobSpec[] {
  const spec = followOn.on_success;
  return [
    {
      job_id: spec.id ?? uuidv7(),
      job_type: spec.job_type,
      payload: spec.payload,
      trigger_on: 'success',
      activity_type: spec.activity_type,
      activity_data: spec.activity_data,
    },
  ];
}
