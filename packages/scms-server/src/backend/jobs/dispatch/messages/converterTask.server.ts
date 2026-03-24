import { KnownJobTypes } from '@curvenote/scms-core';
import type { FollowOnEnvelope } from '@curvenote/scms-core';
import type { DispatchJobParams } from '../dispatch.js';
import { newDispatchJobId } from '../utils.js';

export interface ConverterTaskParams {
  work_version_id: string;
  target?: 'pdf';
  conversion_type?: 'docx-pandoc-myst-pdf' | 'docx-lowriter-pdf';
  invoked_by_id?: string;
  follow_on?: FollowOnEnvelope;
}

export function createConverterTaskDispatchMessageBody(
  params: ConverterTaskParams,
): DispatchJobParams {
  const target = params.target ?? 'pdf';
  const conversion_type = params.conversion_type ?? 'docx-pandoc-myst-pdf';
  return {
    job_id: newDispatchJobId(),
    job_type: KnownJobTypes.CONVERTER_TASK,
    payload: {
      work_version_id: params.work_version_id,
      target,
      conversion_type,
    },
    invoked_by_id: params.invoked_by_id,
    activity_type: 'CONVERTER_TASK_STARTED',
    activity_data: { converter: { target, type: conversion_type } },
    follow_on: params.follow_on,
  };
}
