import { Hono } from "hono";
import { registry } from "../../plugins/registry.js";
import {
  manifestToDetail,
  manifestToListItem,
} from "../../format-service-response.js";
import { relayConfig } from "../../relay-config.js";
import { pluginPost } from "./services.instances.index.js";

const services = new Hono({ strict: false });

services.get("/", (c) => {
  const publicBaseUrl = relayConfig().publicBaseUrl;
  return c.json(
    registry.list().map((m) => manifestToListItem(m, publicBaseUrl)),
  );
});

services.get("/:serviceName", (c) => {
  const { serviceName } = c.req.param();
  const plugin = registry.get(serviceName);
  if (!plugin) {
    return c.json({ error: `Service "${serviceName}" not found` }, 404);
  }
  return c.json(
    manifestToDetail(plugin.manifest, relayConfig().publicBaseUrl),
  );
});

services.route("/:serviceName/instances/:instanceId", pluginPost);

export { services };
