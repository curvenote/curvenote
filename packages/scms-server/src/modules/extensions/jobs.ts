import type { ServerExtension, JobRegistration } from '@curvenote/scms-core';

export function registerExtensionJobs(extensions: ServerExtension[]): JobRegistration[] {
  return extensions.flatMap((ext) => ext.getJobs?.() || []);
}
