export type CheckResult = {
  id: string;
  title: string;
  purpose: string;
  tags: string[];
  help?: string;
  nice?: string;
  status: 'pass' | 'fail' | 'error';
  message: string;
  category: string;
  cause?: string;
};

export type CheckDTO = {
  id: string;
  title: string;
  description: string;
  category: string;
  source: string;
  options?: Record<string, any>[];
  url?: string;
  example?: string;
  links: {
    self: string;
  };
};

export type ChecksDTO = {
  items: CheckDTO[];
  links: {
    self: string;
  };
};
