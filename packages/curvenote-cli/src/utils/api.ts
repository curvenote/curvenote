import type { ISession } from '../session/types.js';

type JsonObject = {
  [index: string]: any;
};
/**
 * Perform json GET request to `url`
 *
 * If request is successful, return the response json.
 * If request fails, throw an error.
 */
export async function getFromUrl(session: ISession, url: string) {
  session.log.debug('Getting from', url);
  const headers = await session.getHeaders();

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
    session.log.debug('GET FAILED', url, response.status, response.statusText);
    throw new Error(
      `GET FAILED ${url}: ${response.status}\n\n${response.statusText}
      Please contact support@curvenote.com`,
    );
  }
}

/**
 * Perform json GET request to `pathname` on the journals API
 *
 * If request is successful, return the response json.
 * If request fails, throw an error.
 */
export async function getFromJournals(session: ISession, pathname: string) {
  // TODO this could/should now just use session.get? and so
  const url = `${session.config.apiUrl}${pathname}`;
  return getFromUrl(session, url);
}

export async function postToUrl(
  session: ISession,
  url: string,
  body: JsonObject,
  opts: { method?: 'POST' | 'PATCH' | 'PUT' } = {},
) {
  session.log.debug(`${opts?.method ?? 'POST'}ing to`, url);
  const method = opts?.method ?? 'POST';
  const headers = await session.getHeaders();
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
  const url = `${session.config?.apiUrl}${pathname}`;
  const resp = await postToUrl(session, url, body, opts);
  return resp;
}
