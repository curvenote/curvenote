import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { isHttpAccessLoggingEnabled } from "./http-access-log.js";
import { httpBodyLogger, isHttpBodyLoggingEnabled } from "./http-body-log.js";
import { v1 } from "./routes/v1/index.js";

const app = new Hono({ strict: false });

const relayAppDir = dirname(fileURLToPath(import.meta.url));
const assetsRoot = join(relayAppDir, "..", "public", "assets");

app.use(
  "/assets/*",
  serveStatic({
    root: assetsRoot,
    rewriteRequestPath: (path) =>
      path.replace(/^\/assets\/?/, "").replace(/^\//, "") || ".",
  }),
);

if (isHttpAccessLoggingEnabled()) {
  app.use(logger());
}
if (isHttpBodyLoggingEnabled()) {
  app.use(httpBodyLogger);
}

app.get("/", (c) => c.redirect("/api/v1", 302));

app.route("/api/v1", v1);

export { app };
