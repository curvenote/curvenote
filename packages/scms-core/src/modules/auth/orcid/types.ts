export interface ORCIDProfile {
  id: string;
  name: string;
  email?: string;
  emailVerified: boolean;
  emails: ORCIDEmail[];
}

export interface ORCIDEmail {
  email: string;
  'created-date'?: ORCIDDate;
  'last-modified-date'?: ORCIDDate;
  primary?: boolean;
  verified?: boolean;
  visibility?: string;
}

export interface ORCIDPersonResponse {
  'last-modified-date'?: ORCIDDate | null;
  path?: string;
  name?: {
    'created-date'?: ORCIDDate;
    'last-modified-date'?: ORCIDDate;
    'given-names'?: ORCIDValue;
    'family-name'?: ORCIDValue;
    'credit-name'?: ORCIDValue | null;
    source?: any | null;
    visibility?: string;
    path?: string;
  };
  'other-names'?: {
    'last-modified-date'?: ORCIDDate | null;
    'other-name': {
      'created-date'?: ORCIDDate;
      'last-modified-date'?: ORCIDDate;
      content?: string;
      visibility?: string;
      path?: string;
    }[];
    path?: string;
  };
  biography?: {
    'created-date'?: ORCIDDate;
    'last-modified-date'?: ORCIDDate;
    content?: string;
    visibility?: string;
    path?: string;
  } | null;
  'researcher-urls'?: {
    'last-modified-date'?: ORCIDDate;
    'researcher-url'?: {
      'created-date'?: ORCIDDate;
      'last-modified-date'?: ORCIDDate;
      'url-name'?: string;
      url?: ORCIDValue;
      visibility?: string;
      path?: string;
    }[];
    path?: string;
  };
  emails?: {
    'last-modified-date'?: ORCIDDate;
    email: ORCIDEmail[];
    path?: string;
  };
  addresses?: {
    'last-modified-date'?: ORCIDDate;
    address: {
      'created-date'?: ORCIDDate;
      'last-modified-date'?: ORCIDDate;
      country?: ORCIDValue;
      visibility?: string;
      path?: string;
    }[];
    path?: string;
  };
  keywords?: {
    'last-modified-date'?: ORCIDDate | null;
    keyword: {
      'created-date'?: ORCIDDate;
      'last-modified-date'?: ORCIDDate;
      content?: string;
      visibility?: string;
      path?: string;
    }[];
    path?: string;
  };
  'external-identifiers'?: {
    'last-modified-date'?: ORCIDDate | null;
    'external-identifier': {
      'created-date'?: ORCIDDate;
      'last-modified-date'?: ORCIDDate;
      'external-id-type'?: string;
      'external-id-value'?: string;
      'external-id-url'?: ORCIDValue;
      visibility?: string;
      path?: string;
    }[];
    path?: string;
  };
}

export interface ORCIDValue {
  value: string;
}

export interface ORCIDDate {
  value: number;
}

export interface ORCIDClientSideSafeOptions {
  provider: 'orcid';
  displayName?: string;
  allowLinking?: boolean;
  provisionNewUser?: boolean;
  allowLogin?: boolean;
  adminLogin?: boolean;
}
