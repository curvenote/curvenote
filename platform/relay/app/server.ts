import "dotenv/config";
import { loadRelayConfig, relayConfig } from "./relay-config.js";

await loadRelayConfig();

const [{ serve }, { app }, { registerPlugins }] = await Promise.all([
  import("@hono/node-server"),
  import("./app.js"),
  import("./plugins/load-plugins.js"),
]);

await registerPlugins();

const PORT = relayConfig().port;

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`checks-relay listening on http://localhost:${info.port}`);
});
