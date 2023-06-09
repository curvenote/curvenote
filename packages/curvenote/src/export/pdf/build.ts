import type { ISession } from '../../session/types.js';
import { createPdfGivenTexFile } from './create.js';

export async function buildPdfOnly(session: ISession, filename: string) {
  await createPdfGivenTexFile(session.log, filename, false);
}
