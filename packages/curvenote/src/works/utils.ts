import fetch from 'node-fetch';
import type { ISession } from '../session/types.js';
import type { SubmissionBody, WorkBody } from '../utils/index.js';
import { getHeaders } from '../session/tokens.js';
import { tic } from 'myst-cli-utils';

// export const JOURNALS_API_URL = 'https://journals.curvenote.dev/v1/';
export const JOURNALS_API_URL = 'http://localhost:3031/v1/';

export async function getFromJournals(session: ISession, pathname: string) {
  const url = `${JOURNALS_API_URL}${pathname}`;
  console.debug('Getting from', url);
  const headers = await getHeaders(session.log, (session as any).$tokens);

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  const json = (await response.json()) as any;
  if (!response.ok) {
    const dataString = JSON.stringify(json, null, 2);
    session.log.debug(`GET FAILED ${url}: ${response.status}\n\n${dataString}`);
  }
  return {
    ok: response.ok,
    status: response.status,
    json,
  };
}

export async function postToJournals(
  session: ISession,
  pathname: string,
  body: WorkBody | SubmissionBody,
) {
  const url = `${JOURNALS_API_URL}${pathname}`;
  console.debug('Posting to', url);

  const method = 'POST';
  const headers = await getHeaders(session.log, (session as any).$tokens);
  const response = await fetch(url, {
    method,
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
  const json = (await response.json()) as any;
  if (!response.ok) {
    const dataString = JSON.stringify(json, null, 2);
    session.log.debug(`${method.toUpperCase()} FAILED ${url}: ${response.status}\n\n${dataString}`);
  }
  return {
    ok: response.ok,
    status: response.status,
    json,
  };
}

export async function postNewWork(session: ISession, cdnKey: string, cdn: string) {
  const toc = tic();

  const resp = await postToJournals(session, 'works', { id: cdnKey, cdn });

  if (resp.ok) {
    session.log.info(toc(`🚀 Submitted a new work in %s.`));
    session.log.debug(`CDN key: ${cdnKey}`);
    session.log.debug(`Work Id: ${resp.json.id}`);
    session.log.debug(`Work Version Id: ${resp.json.version_id}`);
    return {
      cdnKey,
      workId: resp.json.id,
      workVersionId: resp.json.version_id,
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

  const resp = await postToJournals(session, `works/${workId}`, { id: cdnKey, cdn });

  if (resp.ok) {
    session.log.info(toc(`🚀 Submitted a new work version in %s.`));
    session.log.debug(`CDN key: ${cdnKey}`);
    session.log.debug(`Work Id: ${resp.json.id}`);
    session.log.debug(`Work Version Id: ${resp.json.version_id}`);
    return {
      cdnKey,
      workId: resp.json.id,
      workVersionId: resp.json.version_id,
    };
  } else {
    throw new Error('Posting new version of the work failed: Please contact support@curvenote.com');
  }
}

export async function submitToVenue(
  session: ISession,
  venue: string,
  work_version_id: string,
  kind: string,
) {
  const toc = tic();
  const submissionRequest: SubmissionBody = { work_version_id, kind };
  const resp = await postToJournals(session, `sites/${venue}/submissions`, submissionRequest);
  if (resp.ok) {
    session.log.info(toc(`🚀 Submitted to venue "${venue}" in %s.`));
    session.log.debug(`Submission id: ${resp.json.id}`);
    session.log.debug(`Submitted by: ${resp.json.submitted_by.name ?? resp.json.submitted_by.id}`);
    return {
      submissionId: resp.json.id,
    };
  } else {
    throw new Error('Submission failed: Please contact support@curvenote.com');
  }
}
