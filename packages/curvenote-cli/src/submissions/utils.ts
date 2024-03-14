import type { ISession } from '../session/types.js';
import type {
  CreateCliCheckJobPostBody,
  CreateSubmissionBody,
  STATUS_ACTIONS,
  UpdateCliCheckJobPostBody,
  UpdateSubmissionBody,
} from '../utils/index.js';
import { getHeaders } from '../session/tokens.js';
import { tic } from 'myst-cli-utils';
import format from 'date-fns/format';
import type { TransferDataItemData } from './utils.transfer.js';
import type { JsonObject } from '@curvenote/blocks';

export function formatDate(date: string) {
  return format(new Date(date), 'dd MMM, yyyy HH:mm:ss');
}

export async function getFromJournals(session: ISession, pathname: string) {
  const url = `${session.JOURNALS_URL}${pathname}`;
  session.log.debug('Getting from', url);
  const headers = await getHeaders(session, (session as any).$tokens);

  const response = await session.fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  if (response.ok) {
    const json = (await response.json()) as any;
    return json;
  } else {
    throw new Error(
      `GET FAILED ${url}: ${response.status}\n\n${response.statusText}
      Please contact support@curvenote.com`,
    );
  }
}

export async function postToUrl(
  session: ISession,
  url: string,
  body: JsonObject,
  opts: { method?: 'POST' | 'PATCH' | 'PUT' } = {},
) {
  session.log.debug(`${opts?.method ?? 'POST'}ing to`, url);
  const method = opts?.method ?? 'POST';
  const headers = await getHeaders(session, (session as any).$tokens);
  return session.fetch(url, {
    method,
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

export async function postToJournals(
  session: ISession,
  pathname: string,
  body: JsonObject,
  opts: { method?: 'POST' | 'PATCH' } = {},
) {
  const url = `${session.JOURNALS_URL}${pathname}`;
  const resp = await postToUrl(session, url, body, opts);
  return resp;
}

export async function postNewWork(
  session: ISession,
  cdnKey: string,
  cdn: string,
): Promise<{ cdnKey: string; work: TransferDataItemData; workVersion: TransferDataItemData }> {
  const toc = tic();

  session.log.debug(
    `POST to ${session.JOURNALS_URL}works with cdnKey: ${cdnKey} and cdn: ${cdn}...`,
  );
  const resp = await postToJournals(session, 'works', { key: cdnKey, cdn });
  session.log.debug(`${resp.status} ${resp.statusText}`);
  if (resp.ok) {
    const json = (await resp.json()) as any;
    session.log.info(toc(`🚀 Submitted a new work in %s.`));
    session.log.debug(`CDN key: ${cdnKey}`);
    session.log.debug(`Work Id: ${json.id}`);
    session.log.debug(`Work Version Id: ${json.version_id}`);
    return {
      cdnKey,
      work: {
        id: json.id,
        date_created: json.date_created,
      },
      workVersion: {
        id: json.version_id,
        date_created: json.date_created,
      },
    };
  } else {
    throw new Error('Posting new work failed');
  }
}

export async function postNewWorkVersion(
  session: ISession,
  workId: string,
  cdnKey: string,
  cdn: string,
): Promise<{ cdnKey: string; work: TransferDataItemData; workVersion: TransferDataItemData }> {
  const toc = tic();

  session.log.debug(
    `POST to ${session.JOURNALS_URL}works/${workId}/versions with cdnKey: ${cdnKey} and cdn: ${cdn}...`,
  );
  const resp = await postToJournals(session, `works/${workId}/versions`, { key: cdnKey, cdn });
  session.log.debug(`${resp.status} ${resp.statusText}`);

  if (resp.ok) {
    const json = (await resp.json()) as any;
    session.log.info(toc(`🚀 Submitted a new work version in %s.`));
    session.log.debug(`CDN key: ${cdnKey}`);
    session.log.debug(`Work Id: ${json.id}`);
    session.log.debug(`Work Version Id: ${json.version_id}`);
    return {
      cdnKey,
      work: {
        id: json.id,
        date_created: json.date_created,
      },
      workVersion: {
        id: json.version_id,
        date_created: json.date_created,
      },
    };
  } else {
    throw new Error('Posting new version of the work failed');
  }
}

export async function postNewCliCheckJob(
  session: ISession,
  payload: Record<string, any>,
  results: Record<string, any>,
) {
  const toc = tic();
  const body: CreateCliCheckJobPostBody = {
    job_type: 'CLI_CHECK',
    payload,
    results,
  };
  session.log.debug(`POST to ${session.JOURNALS_URL}jobs...`);
  const resp = await postToJournals(session, `jobs`, body);
  session.log.debug(`${resp.status} ${resp.statusText}`);
  if (resp.ok) {
    const json = (await resp.json()) as any;
    session.log.info(toc(`🎉 Posted a new job in %s.`));
    session.log.debug(`Job id: ${json.id}`);
    session.log.debug(`Job status: ${json.status}`);
    return json;
  } else {
    throw new Error('Job creation failed');
  }
}

export async function patchUpdateCliCheckJob(
  session: ISession,
  jobId: string,
  status: string,
  message: string,
  results: Record<string, any>,
) {
  const toc = tic();
  const body: UpdateCliCheckJobPostBody = {
    status,
    message,
    results,
  };
  session.log.debug(`PATCH to ${session.JOURNALS_URL}jobs...`);
  const resp = await postToJournals(session, `jobs/${jobId}`, body, { method: 'PATCH' });
  session.log.debug(`${resp.status} ${resp.statusText}`);
  if (resp.ok) {
    const json = (await resp.json()) as any;
    session.log.info(toc(`🎉 Updated a job in %s.`));
    session.log.debug(`Job id: ${json.id}`);
    session.log.debug(`Job status: ${json.status}`);
    return json;
  } else {
    throw new Error('Job update failed');
  }
}

export async function postNewSubmission(
  session: ISession,
  venue: string,
  kind: string,
  work_version_id: string,
  draft: boolean,
  job_id: string,
  key?: string,
): Promise<{
  submission: TransferDataItemData;
  submissionVersion: TransferDataItemData;
}> {
  const toc = tic();
  const submissionRequest: CreateSubmissionBody = {
    work_version_id,
    kind,
    draft,
    key,
    job_id,
  };
  session.log.debug(`POST to ${session.JOURNALS_URL}sites/${venue}/submissions...`);
  const resp = await postToJournals(session, `sites/${venue}/submissions`, submissionRequest);
  session.log.debug(`${resp.status} ${resp.statusText}`);
  if (resp.ok) {
    const json = (await resp.json()) as any;
    session.log.info(toc(`🚀 Submitted to venue "${venue}" in %s.`));
    session.log.debug(`Submission id: ${json.id}`);
    session.log.debug(`Submitted by: ${json.submitted_by.name ?? json.submitted_by.id}`);
    return {
      submission: {
        id: json.id,
        date_created: json.date_created,
      },
      submissionVersion: {
        id: json.versions[0].id,
        date_created: json.versions[0].date_created,
      },
    };
  } else {
    throw new Error('Creating new submission failed');
  }
}

export async function postUpdateSubmissionWorkVersion(
  session: ISession,
  venue: string,
  submissionId: string,
  work_version_id: string,
  job_id: string,
): Promise<{
  submission: TransferDataItemData;
  submissionVersion: TransferDataItemData;
}> {
  const toc = tic();
  const submissionRequest: UpdateSubmissionBody = { work_version_id, job_id };
  session.log.debug(`POST to ${session.JOURNALS_URL}sites/${venue}/submissions/${submissionId}...`);
  const resp = await postToJournals(
    session,
    `sites/${venue}/submissions/${submissionId}`,
    submissionRequest,
  );
  session.log.debug(`${resp.status} ${resp.statusText}`);
  if (resp.ok) {
    const json = (await resp.json()) as any;
    session.log.info(toc(`🚀 Updated submission accepted by "${venue}" in %s.`));
    session.log.debug(`Submission id: ${json.id}`);
    session.log.debug(`Submitted by: ${json.submitted_by.name ?? json.submitted_by.id}`);
    return {
      submission: {
        id: json.id,
        date_created: json.date_created,
      },
      submissionVersion: {
        id: json.versions[json.versions.length - 1].id,
        date_created: json.versions[json.versions.length - 1].date_created,
      },
    };
  } else {
    throw new Error('Updating submission failed');
  }
}

export async function patchUpdateSubmissionStatus(
  session: ISession,
  venue: string,
  submissionId: string,
  action: STATUS_ACTIONS,
) {
  const toc = tic();
  session.log.debug(`GET to ${session.JOURNALS_URL}sites/${venue}/submissions/${submissionId}...`);
  const submissionJson = await getFromJournals(
    session,
    `sites/${venue}/submissions/${submissionId}`,
  );
  const updateUrl = submissionJson?.links?.[action];
  if (!updateUrl) {
    throw new Error(`Action ${action} not available for submission`);
  }
  session.log.debug(`POST to ${updateUrl}...`);
  const resp = await postToUrl(
    session,
    updateUrl,
    {}, // Currently takes no body
    { method: 'PUT' },
  );
  session.log.debug(`${resp.status} ${resp.statusText}`);
  if (resp.ok) {
    const json = (await resp.json()) as any;
    session.log.info(
      toc(
        `🚀 Submission successfully ${action === 'publish' ? 'publishing to' : 'unpublishing from'} "${venue}" in %s.`,
      ),
    );
    session.log.debug(`Submission id: ${json.id}`);
    session.log.debug(
      `Submission version statuses: ${json.versions.map((v: { status: string }) => v.status)}`,
    );
  } else {
    throw new Error(`Submission failed to ${action}`);
  }
}
