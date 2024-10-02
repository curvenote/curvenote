import NodeCache from 'node-cache';
import type { Cache } from './types.js';

type CurvenoteCache = {
  routers: NodeCache;
  journals: NodeCache;
  config: NodeCache;
};

declare global {
  // Disable multiple caches when this file is rebuilt
  // eslint-disable-next-line no-var
  var curvenoteCache: CurvenoteCache;
}

export function getCache(): Cache {
  global.curvenoteCache ??= {
    // The router should update every 30 seconds
    routers: new NodeCache({ stdTTL: 30 }),
    // The router should update every 30 seconds
    journals: new NodeCache({ stdTTL: 30 }),
    // Configs are immutable
    config: new NodeCache({ stdTTL: 0 }),
  };
  return {
    get(kind, key) {
      return global.curvenoteCache[kind]?.get(key);
    },
    set(kind, key, value) {
      return global.curvenoteCache[kind]?.set(key, value);
    },
  };
}
