import { createHmac } from 'crypto';

/**
 * Function to create a signed url for set of CDN resources using a URLPrefix.
 * Plain TS implementation, wtih
 *
 * From: https://cloud.google.com/cdn/docs/using-signed-urls#programmatically_create_signed_urls_with_a_url_prefix
 * adapted to typescript with help from: https://stackoverflow.com/questions/20754279/creating-signed-urls-for-google-cloud-storage-using-nodejs
 *
 * @param opts
 *  urlPrefix: string;
 *  expires: number - expiry time in seconds
 *  keyName: string;
 *  keyBase64: string;
 */
export function getSignedCDNQuery(opts: {
  urlPrefix: string;
  expires: number;
  keyName: string;
  keyBase64: string;
}) {
  const encodedUrlPrefix = Buffer.from(opts.urlPrefix).toString('base64url');

  const policy = `URLPrefix=${encodedUrlPrefix}&Expires=${opts.expires}&KeyName=${opts.keyName}`;
  const keyBuffer = Buffer.from(opts.keyBase64, 'base64');
  const digest = createHmac('sha1', keyBuffer as any)
    .update(policy)
    .digest('base64');
  const signature = Buffer.from(digest, 'base64').toString('base64url');

  return `${policy}&Signature=${signature}`;
}
