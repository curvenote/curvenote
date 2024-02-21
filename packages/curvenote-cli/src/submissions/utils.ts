import fetch from 'node-fetch';
import type { ISession } from '../session/types.js';
import type {
  CreateCliCheckJobPostBody,
  CreateSubmissionBody,
  UpdateSubmissionBody,
  WorkBody,
} from '../utils/index.js';
import { getHeaders } from '../session/tokens.js';
import { tic } from 'myst-cli-utils';
import format from 'date-fns/format';
import type { TransferDataItemData } from './utils.transfer.js';

export function formatDate(date: string) {
  return format(new Date(date), 'dd MMM, yyyy HH:mm:ss');
}

export async function getFromJournals(session: ISession, pathname: string) {
  const url = `${session.JOURNALS_URL}${pathname}`;
  session.log.debug('Getting from', url);
  const headers = await getHeaders(session.log, (session as any).$tokens);

  const response = await fetch(url, {
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

async function postToJournals(
  session: ISession,
  pathname: string,
  body: WorkBody | CreateSubmissionBody | UpdateSubmissionBody | CreateCliCheckJobPostBody,
) {
  const url = `${session.JOURNALS_URL}${pathname}`;
  session.log.debug('Posting to', url);

  const method = 'POST';
  const headers = await getHeaders(session.log, (session as any).$tokens);
  return fetch(url, {
    method,
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
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
    session.log.debug(`${resp.status} ${resp.statusText}`);
    throw new Error('Posting new work failed: Please contact support@curvenote.com');
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
    throw new Error('Posting new version of the work failed: Please contact support@curvenote.com');
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
    session.log.info(toc(`📑 Posted a build report in %s.`));
    session.log.debug(`Job id: ${json.id}`);
    session.log.debug(`Job status: ${json.status}`);
    return json;
  } else {
    throw new Error('Job creation failed: Please contact support@curvenote.com');
  }
}

export async function postNewSubmission(
  session: ISession,
  venue: string,
  kind: string,
  work_version_id: string,
  draft: boolean,
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
    throw new Error('Submission failed: Please contact support@curvenote.com');
  }
}

export async function postUpdateSubmissionWorkVersion(
  session: ISession,
  venue: string,
  submissionId: string,
  work_version_id: string,
): Promise<{
  submission: TransferDataItemData;
  submissionVersion: TransferDataItemData;
}> {
  const toc = tic();
  const submissionRequest: UpdateSubmissionBody = { work_version_id };
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
    throw new Error('Submission failed: Please contact support@curvenote.com');
  }
}
