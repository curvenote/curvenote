import { uuidv7 } from 'uuidv7';
import { KnownJobTypes } from '@curvenote/scms-core';
import type { FollowOnEnvelope } from '@curvenote/scms-core';
import type { DispatchJobParams } from './dispatch.server.js';

/**
 * Typed factory functions for creating DispatchJobParams with correct payload shapes.
 * Each factory generates a job_id and sets the appropriate job_type, activity_type, etc.
 *
 * Callers that need to control the job_id (e.g. transition flow) can override it
 * on the returned params: `{ ...dispatchConverterTask({...}), job_id: myId }`.
 */

// -- CONVERTER_TASK --

export interface ConverterTaskParams {
  work_version_id: string;
  target?: 'pdf';
  conversion_type?: 'docx-pandoc-myst-pdf' | 'docx-lowriter-pdf';
  invoked_by_id?: string;
  follow_on?: FollowOnEnvelope;
}

export function dispatchConverterTask(params: ConverterTaskParams): DispatchJobParams {
  const target = params.target ?? 'pdf';
  const conversion_type = params.conversion_type ?? 'docx-pandoc-myst-pdf';
  return {
    job_id: uuidv7(),
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

// -- PUBLISH --

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

export function dispatchPublish(params: PublishJobParams): DispatchJobParams {
  return {
    job_id: uuidv7(),
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

// -- UNPUBLISH --

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
    job_id: uuidv7(),
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

// -- CHECK --

export interface CheckJobParams {
  payload: Record<string, any>;
  invoked_by_id?: string;
  activity_type?: string;
  activity_data?: Record<string, unknown>;
}

export function dispatchCheck(params: CheckJobParams): DispatchJobParams {
  return {
    job_id: uuidv7(),
    job_type: KnownJobTypes.CHECK,
    payload: params.payload,
    invoked_by_id: params.invoked_by_id,
    activity_type: params.activity_type,
    activity_data: params.activity_data,
  };
}

// -- Generic extension job --

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
    job_id: uuidv7(),
    job_type: params.job_type,
    payload: params.payload,
    invoked_by_id: params.invoked_by_id,
    activity_type: params.activity_type,
    activity_data: params.activity_data,
    follow_on: params.follow_on,
  };
}
