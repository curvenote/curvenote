/**
 * In-memory stores for atproto OAuth (auth-only; no persistence).
 * State entries expire after 1 hour.
 */

const STATE_TTL_MS = 60 * 60 * 1000;

interface StateEntry {
  value: unknown;
  expiresAt: number;
}

const stateMap = new Map<string, StateEntry>();
const sessionMap = new Map<string, unknown>();

function pruneState() {
  const now = Date.now();
  for (const [k, v] of stateMap.entries()) {
    if (v.expiresAt < now) stateMap.delete(k);
  }
}

export const blueskyStateStore = {
  async set(key: string, value: unknown): Promise<void> {
    pruneState();
    stateMap.set(key, { value, expiresAt: Date.now() + STATE_TTL_MS });
  },
  async get(key: string): Promise<unknown | undefined> {
    const entry = stateMap.get(key) as StateEntry | undefined;
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      stateMap.delete(key);
      return undefined;
    }
    return entry.value;
  },
  async del(key: string): Promise<void> {
    stateMap.delete(key);
  },
};

export const blueskySessionStore = {
  async set(sub: string, session: unknown): Promise<void> {
    sessionMap.set(sub, session);
  },
  async get(sub: string): Promise<unknown | undefined> {
    return sessionMap.get(sub);
  },
  async del(sub: string): Promise<void> {
    sessionMap.delete(sub);
  },
};
