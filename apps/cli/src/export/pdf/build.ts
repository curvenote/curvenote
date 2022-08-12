import type { ISession } from '../../session/types';
import type { TexExportOptions } from '../tex/types';
import { createPdfGivenTexFile } from './create';

export async function buildPdfOnly(session: ISession, filename: string, opts: TexExportOptions) {
  await createPdfGivenTexFile(session.log, filename, opts.command, false);
}
