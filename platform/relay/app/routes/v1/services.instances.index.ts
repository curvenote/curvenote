import { Hono } from "hono";
import { configurePost } from "./services.instances.configure.js";
import { serviceStatusPost } from "./services.instances.status.js";
import { checkReportStartGenerationPost } from "./services.instances.check.report.start-generation.js";
import { checkReportFetchPost } from "./services.instances.check.report.fetch.js";
import { checkReportPdfStartPost } from "./services.instances.check.report.pdf.start.js";
import { checkArtifactsPost } from "./services.instances.check.artifacts.js";
import { checkStatusPost } from "./services.instances.check.status.js";
import { checkTriggerStagePost } from "./services.instances.check.trigger-stage.js";
import { checkReportViewerUrlPost } from "./services.instances.check.report.viewer-url.js";
import { uploadPost } from "./services.instances.upload.js";
import { termsPost } from "./services.instances.terms.js";

const pluginPost = new Hono({ strict: false });

pluginPost.post("/status", serviceStatusPost);
pluginPost.post("/check/:externalId/status", checkStatusPost);

pluginPost.post("/configure", configurePost);
pluginPost.post("/terms", termsPost);
pluginPost.post("/upload", uploadPost);

pluginPost.post("/check/:externalId/artifacts", checkArtifactsPost);
pluginPost.post("/check/:externalId/trigger-stage", checkTriggerStagePost);
pluginPost.post(
  "/check/:externalId/report/start-generation",
  checkReportStartGenerationPost,
);
pluginPost.post("/check/:externalId/report/fetch", checkReportFetchPost);
pluginPost.post("/check/:externalId/report/viewer-url", checkReportViewerUrlPost);
pluginPost.post("/check/:externalId/report/pdf/start", checkReportPdfStartPost);

export { pluginPost };
