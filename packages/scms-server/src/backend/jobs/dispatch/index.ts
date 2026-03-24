/**
 * Typed factory functions for creating DispatchJobParams with correct payload shapes.
 * Each factory generates a job_id and sets the appropriate job_type, activity_type, etc.
 *
 * Callers that need to control the job_id (e.g. transition flow) can override it
 * on the returned params: `{ ...dispatchConverterTask({...}), job_id: myId }`.
 */

export * from './dispatch.js';
export * from './utils.js';
export * from './messages/index.js';
