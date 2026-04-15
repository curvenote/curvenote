/**
 * POST /api/v1/services/:serviceName/instances/:instanceId/status
 *
 * Service-level status / capabilities (no submission context).
 * Returns the plugin's status data with the service manifest injected at the top level.
 */
import type { Context } from 'hono';
import { manifestToDetail } from '../../format-service-response.js';
import { relayConfig, instanceCredentials } from '../../relay-config.js';
import { resolveInstanceForServicePost, splitBody } from './services.instances.utils.js';

export async function serviceStatusPost(c: Context) {
  const resolution = await resolveInstanceForServicePost(c);
  if (!resolution.ok) return resolution.response;

  const { plugin, instance, body } = resolution;
  const { rest } = splitBody(body);

  try {
    const data = await plugin.getInstanceStatus(instanceCredentials(instance), rest);
    const manifest = manifestToDetail(plugin.manifest, relayConfig().publicBaseUrl);
    return c.json({ manifest, ...data });
  } catch (error) {
    return c.json(
      {
        status: 'error' as const,
        message: error instanceof Error ? error.message : 'Service status failed',
        result: null,
      },
      500,
    );
  }
}
