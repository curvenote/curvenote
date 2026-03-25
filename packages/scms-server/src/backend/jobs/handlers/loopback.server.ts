import { JobStatus } from '@curvenote/scms-db';
import type { Context } from '../../context.server.js';
import type { CreateJob } from '@curvenote/scms-core';
import { dbUpdateJob } from './db.server.js';

/**
 * sleep helper — resolves after `ms` milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Loopback job handler — tests the dispatch mechanism end-to-end.
 *
 * This handler is designed to run after a QUEUED row exists (`dispatchAJob` inserts
 * before publish; the dispatch push handler is a fallback). It does NOT create its own DB row.
 *
 * Timeline (~8 seconds total):
 *   0s  → update to RUNNING + message "Loopback started"
 *   3s  → append message "Processing… (step 1/2)"
 *   6s  → append message "Processing… (step 2/2)"
 *   8s  → update to COMPLETED + results { loopback: true, steps: 2, elapsed_ms }
 */
export async function loopbackHandler(_ctx: Context, data: CreateJob) {
  const { id } = data;
  const start = Date.now();

  // Step 1: mark RUNNING
  await dbUpdateJob(id, {
    status: JobStatus.RUNNING,
    message: 'Loopback started',
  });

  // Step 2: simulate work
  await sleep(3000);
  await dbUpdateJob(id, {
    status: JobStatus.RUNNING,
    message: 'Processing… (step 1/2)',
  });

  await sleep(3000);
  await dbUpdateJob(id, {
    status: JobStatus.RUNNING,
    message: 'Processing… (step 2/2)',
  });

  // Step 3: complete
  await sleep(2000);
  const elapsed_ms = Date.now() - start;
  const dbo = await dbUpdateJob(id, {
    status: JobStatus.COMPLETED,
    message: 'Loopback complete',
    results: {
      loopback: true,
      steps: 2,
      elapsed_ms,
    },
  });

  return dbo;
}
