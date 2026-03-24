/**
 * Typed factory functions for creating DispatchJobParams with correct payload shapes.
 * Each factory generates a job_id and sets the appropriate job_type, activity_type, etc.
 *
 * Callers that need to control the job_id (e.g. transition flow) can override it
 * on the returned params: `{ ...dispatchConverterTask({...}), job_id: myId }`.
 */

export * from './base.js';
export * from './converterTask.server.js';
export * from './publish.server.js';
export * from './unpublish.server.js';
export * from './check.server.js';
export * from './extensionJob.server.js';
