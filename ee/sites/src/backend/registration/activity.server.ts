import { uuidv7 } from 'uuidv7';
import { ActivityType } from '@curvenote/scms-db';
import type { DoiTx } from '../doi/types.js';

export type RegistrationActivityInput = {
  type: 'DOI_REGISTRATION_STARTED' | 'DOI_REGISTRATION_COMPLETED' | 'DOI_REGISTRATION_FAILED';
  siteId: string;
  submissionId: string;
  submissionVersionId: string;
  userId: string;
  /** `{ doi, depositId, message? }`; the submission timeline shows the DOI and the message. */
  data: { doi: string; depositId: string; message?: string };
};

/** One activity per registration transition, in the same transaction as the write. */
export async function writeRegistrationActivity(
  tx: DoiTx,
  input: RegistrationActivityInput,
): Promise<void> {
  const timestamp = new Date().toISOString();
  await tx.activity.create({
    data: {
      id: uuidv7(),
      date_created: timestamp,
      date_modified: timestamp,
      activity_by: { connect: { id: input.userId } },
      site: { connect: { id: input.siteId } },
      submission: { connect: { id: input.submissionId } },
      submission_version: { connect: { id: input.submissionVersionId } },
      activity_type: ActivityType[input.type],
      data: input.data,
    },
    select: { id: true },
  });
}
