import type { ISession as IMystSession } from 'myst-cli';
import type { Store } from 'redux';
import type { RootState } from '../store/index.js';
import type { MystPlugin } from 'myst-common';
import type { CheckInterface } from '@curvenote/check-implementations';

export type SessionOpts = {
  debug?: boolean;
  config?: string;
};

export type TokenPayload = {
  aud: string;
  iss: string;
  sub: string;
  exp?: number;
  iat?: number;
  cfg?: string;
  ignoreExpiration?: boolean;
  name?: string;
  note?: string;
  [key: string]: any;
};

export type Token = { token: string; decoded: TokenPayload };

export type Tokens = Partial<Record<'user' | 'session', Token>>;

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

export type CLIConfigData = {
  apiUrl: string;
  adminUrl: string;
  editorApiUrl: string;
  editorUrl: string;
  privateCdnUrl: string;
  tempCdnUrl: string;
  publicCdnUrl: string;
};

export type ISession = IMystSession & {
  store: Store<RootState>;
  isAnon: boolean;
  config: CLIConfigData;
  activeTokens: Tokens;
  plugins: ValidatedCurvenotePlugin | undefined;

  refreshSessionToken(): Promise<void>;
  getHeaders(): Promise<Record<string, string>>;
  get<T extends Record<string, any> = any>(
    url: string,
    query?: Record<string, string>,
  ): Response<T>;
  post<T extends Record<string, any> = any>(url: string, data: unknown): Response<T>;
  patch<T extends Record<string, any> = any>(url: string, data: unknown): Response<T>;
  reload(): Promise<ISession>;
  clone(): Promise<ISession>;
};
