import "dotenv/config";
import type { IncomingMessage, ServerResponse } from "node:http";
import { handle } from "@hono/node-server/vercel";
import { app } from "../app/app.js";
import { loadRelayConfig } from "../app/relay-config.js";
import { registerPlugins } from "../app/plugins/load-plugins.js";

export const config = {
  api: {
    bodyParser: false,
  },
};
export const runtime = "nodejs";
export const maxDuration = 300;

const initPromise = (async () => {
  await loadRelayConfig();
  await registerPlugins();
})();

const honoHandler = handle(app);

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  await initPromise;
  return honoHandler(req, res);
}
