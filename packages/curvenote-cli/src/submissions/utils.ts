import type { ISession } from '../session/types.js';
import type {
  CreateCliCheckJobPostBody,
  CreateSubmissionBody,
  STATUS_ACTIONS,
  UpdateCliCheckJobPostBody,
  UpdateSubmissionBody,
  JobResponse,
  NewCheckJobPayload,
  NewCheckJobResults,
} from './types.js';
import { tic } from 'myst-cli-utils';
import format from 'date-fns/format';
import type { SubmissionDTO, SubmissionVersionDTO } from '@curvenote/common';
import { getFromUrl, postToJournals, postToUrl } from '../utils/api.js';

export function formatDate(date: string) {
  return format(new Date(date), 'dd MMM, yyyy HH:mm:ss');
}

export async function postNewCliCheckJob(
  session: ISession,
  payload: NewCheckJobPayload,
  results: NewCheckJobResults,
) {
  const toc = tic();
  const body: CreateCliCheckJobPostBody = {
    job_type: 'CLI_CHECK',
    payload,
    results,
  };
  session.log.debug(`POST to ${session.config?.apiUrl}/jobs...`);
  const resp = await postToJournals(session, `/jobs`, body);
  session.log.debug(`${resp.status} ${resp.statusText}`);
  if (resp.ok) {
    const json = (await resp.json()) as JobResponse;
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
  session.log.debug(`PATCH to ${session.config?.apiUrl}/jobs...`);
  const resp = await postToJournals(session, `/jobs/${jobId}`, body, { method: 'PATCH' });
  session.log.debug(`${resp.status} ${resp.statusText}`);
  if (resp.ok) {
    const json = (await resp.json()) as JobResponse;
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
  collection_id: string,
  kind_id: string,
  work_version_id: string,
  draft: boolean,
  job_id: string,
): Promise<SubmissionDTO> {
  const toc = tic();
  const submissionRequest: CreateSubmissionBody = {
    work_version_id,
    collection_id,
    kind_id,
    draft,
    job_id,
  };
  session.log.debug(`POST to ${session.config?.apiUrl}/sites/${venue}/submissions...`);
  const resp = await postToJournals(session, `/sites/${venue}/submissions`, submissionRequest);
  session.log.debug(`${resp.status} ${resp.statusText}`);
  if (resp.ok) {
    const json = (await resp.json()) as SubmissionDTO;
    session.log.info(toc(`🚀 Submitted to venue "${venue}" in %s.`));
    session.log.debug(`Submission id: ${json.id}`);
    session.log.debug(`Submitted by: ${json.submitted_by.name ?? json.submitted_by.id}`);
    return json;
  } else {
    throw new Error('Creating new submission failed');
  }
}

export async function postUpdateSubmissionWorkVersion(
  session: ISession,
  venue: string,
  versionsUrl: string,
  work_version_id: string,
  job_id: string,
): Promise<SubmissionVersionDTO> {
  const toc = tic();
  const submissionRequest: UpdateSubmissionBody = { work_version_id, job_id };
  session.log.debug(`POST to ${versionsUrl}...`);
  const resp = await postToUrl(session, versionsUrl, submissionRequest);
  session.log.debug(`${resp.status} ${resp.statusText}`);
  if (resp.ok) {
    const json = (await resp.json()) as SubmissionVersionDTO;
    session.log.info(toc(`🚀 Updated submission accepted by "${venue}" in %s.`));
    session.log.debug(`Submission id: ${json.submission_id}`);
    session.log.debug(`Submitted by: ${json.submitted_by.name ?? json.submitted_by.id}`);
    return json;
  } else {
    throw new Error('Updating submission failed');
  }
}

export async function patchUpdateSubmissionStatus(
  session: ISession,
  venue: string,
  submissionUrl: string,
  action: STATUS_ACTIONS,
  date?: string,
) {
  const toc = tic();
  session.log.debug(`GET to ${submissionUrl}...`);
  const submissionJson = await getFromUrl(session, submissionUrl);
  const updateUrl = submissionJson?.links?.[action];
  if (!updateUrl) {
    throw new Error(`Action "${action}" not available for submission`);
  }
  session.log.debug(`PUT to ${updateUrl}...`);
  const resp = await postToUrl(session, updateUrl, { date }, { method: 'PUT' });
  session.log.debug(`${resp.status} ${resp.statusText}`);
  if (resp.ok) {
    const json = (await resp.json()) as SubmissionDTO;
    session.log.info(
      toc(
        `🚀 Submission successfully ${action === 'publish' ? 'publishing to' : 'unpublishing from'} "${venue}" in %s.`,
      ),
    );
    session.log.debug(`Submission id: ${json.id}`);
  } else {
    throw new Error(`Submission failed to ${action}`);
  }
}
