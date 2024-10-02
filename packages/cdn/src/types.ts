type CacheType = 'routers' | 'journals' | 'config';

export type Cache = {
  get<T = any>(kind: CacheType, id: string): T | undefined;
  set<T = any>(kind: CacheType, id: string, value: T): void;
};
