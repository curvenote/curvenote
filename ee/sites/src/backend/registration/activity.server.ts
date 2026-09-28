import { uuidv7 } from 'uuidv7';
import { ActivityType } from '@curvenote/scms-db';
import type { DoiTx } from '../doi/types.js';

type RegistrationActivityInput = {
  type: 'DOI_REGISTRATION_STARTED' | 'DOI_REGISTRATION_COMPLETED' | 'DOI_REGISTRATION_FAILED';
  siteId: string;
  submissionId: string;
  submissionVersionId: string;
  userId: string;
  /**
   * `error` is what a failure stored in `DoiDeposit.error`, `warning` what a registration stored in
   * `DoiDeposit.warning`; kept apart as on the attempt so the timeline never has to tell them apart.
   */
  data: { doi: string; depositId: string; error?: string; warning?: string };
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
