export type BaseOpts = {
  yes?: boolean;
  info: boolean;
  resume?: boolean;
  maxSizeWebp?: number;
};

export type GithubSource = {
  repo?: string;
  branch?: string;
  path?: string;
  commit?: string;
};

export type IdAndDate = {
  id?: string;
  date_created: string;
};

export type BaseLog = {
  input?: {
    opts?: BaseOpts;
  };
  source?: GithubSource;
};
