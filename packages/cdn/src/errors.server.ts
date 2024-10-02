import { ErrorStatus } from '@myst-theme/common';
import type { Response as NodeFetchResponse } from 'node-fetch';

export function responseNoSite(): Response {
  // note: error boundary logic is dependent on the string sent here
  return new Response(ErrorStatus.noSite, {
    status: 404,
    statusText: ErrorStatus.noSite,
  });
}

export function responseNoArticle() {
  // note: error boundary logic is dependent on the string sent here
  return new Response(ErrorStatus.noArticle, {
    status: 404,
    statusText: ErrorStatus.noArticle,
  });
}

export function responseError({ status, statusText }: NodeFetchResponse) {
  return new Error(`${status} - ${statusText}`);
}
