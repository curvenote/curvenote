import { ShieldCheck } from 'lucide-react';
import type { WorkCreateOption } from '../extensions/types.js';
import { scopes } from '../../scopes.js';

export const BUILTIN_CHECK_WORK_CREATE_OPTION_ID = 'check';

/** Built-in checks upload flow (same launcher as legacy Check My Work task). */
export const BUILTIN_CHECK_WORK_CREATE_OPTION: WorkCreateOption = {
  id: BUILTIN_CHECK_WORK_CREATE_OPTION_ID,
  label: 'Check a Work',
  description: 'Upload files and run integrity checks',
  icon: ShieldCheck,
  /** Entry-point label for the checks upload launcher; not used for create-new-version resolution. */
  metadataKey: 'checks',
  startPath: '/app/works/new',
  mode: 'composite',
  scopes: [scopes.app.works.checks.feature],
  order: 5,
};
