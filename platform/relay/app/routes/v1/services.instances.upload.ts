/**
 * POST /api/v1/services/:serviceName/instances/:instanceId/upload
 */
import type { Context } from 'hono';
import type { PluginUploadPayload, SubmitManuscriptFile } from '@checks-relay/check-plugin-types';
import { registry } from '../../plugins/registry.js';
import { instanceCredentials } from '../../relay-config.js';
import { readJsonBody, resolveInstanceFromParsed } from './services.instances.utils.js';

function parseFiles(
  files: unknown,
): { ok: true; files: SubmitManuscriptFile[] } | { ok: false; error: string } {
  if (!Array.isArray(files) || files.length === 0) {
    return { ok: false, error: 'files must be a non-empty array' };
  }
  const out: SubmitManuscriptFile[] = [];
  for (const item of files) {
    if (item == null || typeof item !== 'object' || Array.isArray(item)) {
      return { ok: false, error: 'each file must be an object with url and filename' };
    }
    const o = item as Record<string, unknown>;
    if (typeof o.url !== 'string' || typeof o.filename !== 'string') {
      return { ok: false, error: 'each file must have string url and filename' };
    }
    out.push({ url: o.url, filename: o.filename });
  }
  return { ok: true, files: out };
}

export async function uploadPost(c: Context) {
  const serviceName = c.req.param('serviceName');
  const instanceId = c.req.param('instanceId') ?? '';
  if (!serviceName) {
    return c.json({ status: 'error' as const, message: 'Missing service name', result: null }, 400);
  }
  const plugin = registry.get(serviceName);
  if (!plugin) {
    return c.json(
      {
        status: 'error' as const,
        message: `Service "${serviceName}" not found`,
        result: null,
      },
      404,
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await readJsonBody(c);
  } catch {
    return c.json({ status: 'error' as const, message: 'Invalid JSON body', result: null }, 400);
  }

  const parsedBody = body as Record<string, unknown>;
  const { client_id: clientId, notify_url: notifyUrl, files, metadata } = parsedBody;
  if (!clientId || !files || !notifyUrl) {
    return c.json(
      {
        status: 'error' as const,
        message: 'Missing required fields: client_id, files, notify_url',
        result: null,
      },
      400,
    );
  }

  if (typeof clientId !== 'string' || typeof notifyUrl !== 'string') {
    return c.json(
      {
        status: 'error' as const,
        message: 'client_id and notify_url must be strings',
        result: null,
      },
      400,
    );
  }

  const resolved = resolveInstanceFromParsed(c, serviceName, instanceId, plugin, body);
  if (!resolved.ok) return resolved.response;
  const { instance } = resolved;

  const parsedFiles = parseFiles(files);
  if (!parsedFiles.ok) {
    return c.json({ status: 'error' as const, message: parsedFiles.error, result: null }, 400);
  }

  const parsedMetadata =
    metadata != null && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};

  const pluginPayload: PluginUploadPayload = {
    clientId,
    notifyUrl,
    instanceId: resolved.instanceId,
    files: parsedFiles.files,
    metadata: parsedMetadata,
  };

  try {
    const result = await plugin.upload(instanceCredentials(instance), pluginPayload);

    const externalId = (result.result as Record<string, unknown> | null)?.externalId as
      | string
      | undefined;

    if (result.status === 'error' || result.status === 'failed') {
      return c.json(
        {
          status: result.status,
          message: result.message,
          result: result.result,
        },
        502,
      );
    }

    const { externalId: _dropped, ...restResult } =
      (result.result as Record<string, unknown>) ?? {};

    return c.json(
      {
        status: result.status,
        message: result.message,
        result: {
          externalId,
          ...restResult,
        },
      },
      201,
    );
  } catch (error) {
    return c.json(
      {
        status: 'error' as const,
        message: error instanceof Error ? error.message : 'Upload failed',
        result: null,
      },
      500,
    );
  }
}
