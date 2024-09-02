import type { ISession as IMystSession } from 'myst-cli';
import type { Store } from 'redux';
import type { RootState } from '../store/index.js';
import type { MystPlugin } from 'myst-common';
import type { CheckInterface } from '@curvenote/check-implementations';

export type SessionOpts = {
  debug?: boolean;
  config?: string;
};

export type Tokens = Partial<Record<'user' | 'session', string>>;

export type Response<T extends Record<string, any> = any> = Promise<{
  ok: boolean;
  status: number;
  json: T;
}>;

export type CurvenotePlugin = MystPlugin & {
  checks?: CheckInterface[];
};

export type ValidatedCurvenotePlugin = Required<
  Pick<CurvenotePlugin, 'directives' | 'roles' | 'transforms' | 'checks'>
>;

export type ISession = IMystSession & {
  API_URL: string;
  SITE_URL: string;
  JOURNALS_URL: string;
  PUBLIC_CDN: string;
  PRIVATE_CDN: string;
  TEMP_CDN: string;
  store: Store<RootState>;
  isAnon: boolean;
  plugins: ValidatedCurvenotePlugin | undefined;

  get<T extends Record<string, any> = any>(
    url: string,
    query?: Record<string, string>,
  ): Response<T>;

  post<T extends Record<string, any> = any>(url: string, data: unknown): Response<T>;

  patch<T extends Record<string, any> = any>(url: string, data: unknown): Response<T>;

  reload(): Promise<ISession>;
  clone(): Promise<ISession>;
};
