/**
 * Production bundle: compiles/bundles `app/` into one ESM file; all `node_modules`
 * stay external (@app-config/* CJS, workspace plugins’ dist/, etc.).
 */
import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["app/server.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "dist/server.js",
  sourcemap: true,
  /** Avoid pulling CJS packages (e.g. @app-config/*) into the IIFE shim that breaks `require`. */
  packages: "external",
  logLevel: "info",
});
