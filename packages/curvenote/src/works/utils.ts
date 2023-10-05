import fetch from 'node-fetch';
import type { ISession } from '../session/types.js';
import type { CreateSubmissionBody, UpdateSubmissionBody, WorkBody } from '../utils/index.js';
import { getHeaders } from '../session/tokens.js';
import { tic } from 'myst-cli-utils';

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
  body: WorkBody | CreateSubmissionBody | UpdateSubmissionBody,
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

export async function postNewWork(session: ISession, cdnKey: string, cdn: string) {
  const toc = tic();

  const resp = await postToJournals(session, 'works', { id: cdnKey, cdn });

  if (resp.ok) {
    const json = (await resp.json()) as any;
    session.log.info(toc(`🚀 Submitted a new work in %s.`));
    session.log.debug(`CDN key: ${cdnKey}`);
    session.log.debug(`Work Id: ${json.id}`);
    session.log.debug(`Work Version Id: ${json.version_id}`);
    return {
      cdnKey,
      workId: json.id,
      workVersionId: json.version_id,
    };
  } else {
    throw new Error('Posting new work failed: Please contact support@curvenote.com');
  }
}

export async function postNewWorkVersion(
  session: ISession,
  workId: string,
  cdnKey: string,
  cdn: string,
) {
  const toc = tic();

  const resp = await postToJournals(session, `works/${workId}/versions`, { id: cdnKey, cdn });

  if (resp.ok) {
    const json = (await resp.json()) as any;
    session.log.info(toc(`🚀 Submitted a new work version in %s.`));
    session.log.debug(`CDN key: ${cdnKey}`);
    session.log.debug(`Work Id: ${json.id}`);
    session.log.debug(`Work Version Id: ${json.version_id}`);
    return {
      cdnKey,
      workId: json.id,
      workVersionId: json.version_id,
    };
  } else {
    throw new Error('Posting new version of the work failed: Please contact support@curvenote.com');
  }
}

export async function postNewSubmission(
  session: ISession,
  venue: string,
  kind: string,
  work_version_id: string,
) {
  const toc = tic();
  const submissionRequest: CreateSubmissionBody = { work_version_id, kind };
  const resp = await postToJournals(session, `sites/${venue}/submissions`, submissionRequest);
  if (resp.ok) {
    const json = (await resp.json()) as any;
    session.log.info(toc(`🚀 Submitted to venue "${venue}" in %s.`));
    session.log.debug(`Submission id: ${json.id}`);
    session.log.debug(`Submitted by: ${json.submitted_by.name ?? json.submitted_by.id}`);
    return json;
  } else {
    throw new Error('Submission failed: Please contact support@curvenote.com');
  }
}

export async function postUpdateSubmissionWorkVersion(
  session: ISession,
  venue: string,
  submissionId: string,
  work_version_id: string,
) {
  const toc = tic();
  const submissionRequest: UpdateSubmissionBody = { work_version_id };
  const resp = await postToJournals(
    session,
    `sites/${venue}/submissions/${submissionId}`,
    submissionRequest,
  );
  if (resp.ok) {
    const json = (await resp.json()) as any;
    session.log.info(toc(`🚀 Updated submission accepted by "${venue}" in %s.`));
    session.log.debug(`Submission id: ${json.id}`);
    session.log.debug(`Submitted by: ${json.submitted_by.name ?? json.submitted_by.id}`);
    return json;
  } else {
    throw new Error('Submission failed: Please contact support@curvenote.com');
  }
}
