import jwt from 'jsonwebtoken';
import { PubSub } from '@google-cloud/pubsub';
import { error401 } from '@curvenote/scms-core';
import { getConfig } from '../app-config.server.js';

/*
 * processing.server.ts - things that hit external APIs and could take longer than other server functions
 */
export type PreviewTokenClaims = {
  scope: string;
  scopeId: string;
};

export type HandshakeTokenClaims = {
  jobId: string;
};

export type CurvenoteTokenClaims = {
  aud: string;
};

/**
 * return true if the strings match, ignoring any trailing slash
 */
export function slashInvariantMatch(maybeUrl1: string | undefined, maybeUrl2: string | undefined) {
  if (!maybeUrl1 || !maybeUrl2) return false;
  return maybeUrl1.replace(/\/$/, '') === maybeUrl2.replace(/\/$/, '');
}

export function decodeTokenPayload(token: string) {
  // peek inside the token
  const payload = jwt.decode(token.startsWith('Bearer ') ? token.slice(7) : token);
  // we expect an object
  if (!payload || typeof payload !== 'object' || !payload.aud || typeof payload.aud !== 'string') {
    throw error401('Invalid token (decode)');
  }
  return payload;
}

/**
 * Authorize curvenote user
 *
 * Validate the authorization token using the curvenote API,
 * and return the user information.
 *
 */
export async function authorizeCurvenoteUser(url: string, bearerToken: string) {
  // validate the token by recovering the user information
  // this is an authorized request specific to the user
  // TODO: caching!!!
  const api = url.replace(/\/$/, '');
  const resp = await fetch(`${api}/my/user`, {
    headers: { Authorization: bearerToken },
  });
  if (!resp.ok) {
    console.log('authorizeCurvenoteUser failed', resp.status, resp.statusText);
    throw error401('No user for token');
  }

  // take user information from the API repsonse
  const { id, email, name } = (await resp.json()) as { id: string; email: string; name: string };
  return { id, email, name };
}

export type CheckMessageAttributes = {
  handshake: string;
  job_url?: string;
} & Record<string, string>;

export async function publishCheck(attributes: CheckMessageAttributes) {
  const config = await getConfig();
  // Do not hit external PubSub during test
  if (process.env.NODE_ENV === 'test' || process.env.APP_CONFIG_ENV === 'test') {
    return 'testPubSubId';
  }
  if (process.env.NODE_ENV === 'development') {
    // This sends the job to a docker container running at localhost:8080 instead of pubsub
    attributes.job_url = attributes.job_url?.replace('localhost', 'host.docker.internal');
    // Do not await response from the container; it will send intermittent updates
    fetch('http://127.0.0.1:8080/', {
      method: 'POST',
      body: JSON.stringify({ message: { attributes } }),
      headers: { 'content-type': 'application/json' },
    }).then(
      (res) => console.info('check response', res),
      (err) => console.error('check error', err),
    );
    return 'testPubSubId';
  }
  const pubSubClient = new PubSub({
    projectId: config.api.checkProjectId,
    credentials: JSON.parse(config.api.checkSASecretKeyfile),
  });
  const messageId = await pubSubClient.topic(config.api.checkTopic).publishMessage({ attributes });
  return messageId;
}
