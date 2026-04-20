// React Router framework mode picks up `app/entry.server.tsx` automatically.
// We delegate to the shared handler in @curvenote/scms-server so all SCMS-based
// apps get the same streaming + CSP/security header behaviour.
export { handleRequest as default, streamTimeout } from '@curvenote/scms-server';
