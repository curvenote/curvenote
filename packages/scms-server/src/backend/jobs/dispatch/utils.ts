import { uuidv7 } from 'uuidv7';

/** Shared job id generator for dispatch factories. */
export function newDispatchJobId(): string {
  return uuidv7();
}
