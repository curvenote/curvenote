import { getPrismaClient, jobs } from '@curvenote/scms-server';
import { JobStatus } from '@curvenote/scms-db';

export type DispatchJobParams = Parameters<typeof jobs.dispatchAJob>[0];

export type ParseFailure = {
  reason: string;
  salvage?: {
    job_id?: string;
    job_type?: string;
    payload?: Record<string, any>;
    invoked_by_id?: string;
  };
};

export type ParsePubSubResult =
  | { ok: true; data: DispatchJobParams; attributes: { handshake: string; job_type: string } }
  | ({ ok: false } & ParseFailure);

/**
 * Parse a Pub/Sub push message body.
 * Expected shape: { message: { attributes: { handshake, job_type }, data: "<base64>" } }
 */
export function tryParsePubSubMessage(body: unknown): ParsePubSubResult {
  if (!body || typeof body !== 'object') {
    return { ok: false, reason: 'Missing request body' };
  }
  const message = (body as Record<string, unknown>).message;
  if (!message || typeof message !== 'object') {
    return { ok: false, reason: 'Missing message in body' };
  }

  const { attributes, data: dataBase64 } = message as Record<string, unknown>;
  const attrs =
    attributes && typeof attributes === 'object'
      ? (attributes as Record<string, unknown>)
      : undefined;

  if (!attrs?.handshake || typeof attrs.handshake !== 'string') {
    return { ok: false, reason: 'Missing handshake in message attributes' };
  }
  if (!attrs?.job_type || typeof attrs.job_type !== 'string') {
    return { ok: false, reason: 'Missing job_type in message attributes' };
  }
  if (!dataBase64 || typeof dataBase64 !== 'string') {
    return { ok: false, reason: 'Missing message data' };
  }

  let decoded: string;
  try {
    decoded = Buffer.from(dataBase64, 'base64').toString('utf-8');
  } catch {
    return { ok: false, reason: 'Invalid base64 message data' };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(decoded);
  } catch {
    return { ok: false, reason: 'Message data is not valid JSON' };
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, reason: 'Message data must be a JSON object' };
  }

  const data = raw as Record<string, unknown>;
  const job_id = typeof data.job_id === 'string' ? data.job_id : undefined;
  const job_type = typeof data.job_type === 'string' ? data.job_type : undefined;
  const payload =
    data.payload && typeof data.payload === 'object' && !Array.isArray(data.payload)
      ? (data.payload as Record<string, any>)
      : {};
  const invoked_by_id = typeof data.invoked_by_id === 'string' ? data.invoked_by_id : undefined;

  if (!job_id || !job_type) {
    return {
      ok: false,
      reason: 'Message data must contain job_id and job_type',
      salvage: { job_id, job_type, payload, invoked_by_id },
    };
  }

  const parsed: DispatchJobParams = {
    job_id,
    job_type,
    payload,
    invoked_by_id,
    activity_type: typeof data.activity_type === 'string' ? data.activity_type : undefined,
    activity_data:
      data.activity_data &&
      typeof data.activity_data === 'object' &&
      !Array.isArray(data.activity_data)
        ? (data.activity_data as Record<string, unknown>)
        : undefined,
    follow_on: data.follow_on as DispatchJobParams['follow_on'],
  };

  return {
    ok: true,
    data: parsed,
    attributes: { handshake: attrs.handshake, job_type: attrs.job_type },
  };
}

/** Permanent dispatch failure: ack Pub/Sub (200) so the message is not retried. Persist FAILED when we can identify a job. */
export async function markPermanentDispatchFailure(
  reason: string,
  salvage?: ParseFailure['salvage'],
  logTag = '[dispatch]',
) {
  console.error(`${logTag} Permanent failure: ${reason}`, salvage?.job_id ?? '(no job id)');
  if (!salvage?.job_id) return;

  const jobType = salvage.job_type ?? 'UNKNOWN';
  const payload = salvage.payload ?? {};
  const prisma = await getPrismaClient();
  const existing = await prisma.job.findUnique({ where: { id: salvage.job_id } });
  if (existing) {
    if (existing.status === JobStatus.COMPLETED) {
      console.warn(`${logTag} Permanent failure but job already completed: ${salvage.job_id}`);
      return;
    }
    try {
      await jobs.dbUpdateJob(salvage.job_id, {
        status: JobStatus.FAILED,
        message: reason,
      });
    } catch (e) {
      console.error(`${logTag} Failed to update job to FAILED`, e);
    }
  } else {
    try {
      await jobs.dbCreateJob({
        id: salvage.job_id,
        job_type: jobType,
        payload,
        status: JobStatus.FAILED,
        message: reason,
        invoked_by_id: salvage.invoked_by_id,
      });
    } catch (e) {
      console.error(`${logTag} Failed to create FAILED job row`, e);
    }
  }
}
