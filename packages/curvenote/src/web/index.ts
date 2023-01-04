import { buildSite, startServer } from 'myst-cli';
import { siteCommandWrapper } from './utils';

export const buildCurvenoteSite = siteCommandWrapper(buildSite, {});

export const startCurvenoteServer = siteCommandWrapper(startServer, {});

export * from './deploy';
