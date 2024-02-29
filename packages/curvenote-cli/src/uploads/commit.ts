import type { ISession } from '../session/types.js';
import { postToJournals } from '../submissions/utils.js';

export async function commitUploads(
  session: ISession,
  data: { cdn: string; cdnKey: string; files: any[] },
) {
  session.log.debug(`📦 Committing uploads - ${data.files.length} items`);
  const resp = await postToJournals(session, `uploads/commit`, data, { method: 'POST' });

  if (resp.ok) {
    const { message } = (await resp.json()) as { message: string };
    session.log.info(`🚚 Transfer complete`);
    session.log.info(`${message}`);
    return;
  }

  try {
    session.log.debug(await resp.text());
  } catch (e) {
    session.log.debug('Error received but response has no text.');
  }
  throw new Error(`🤕 Failed to commit uploads: ${resp.status} ${resp.statusText}`);
}
