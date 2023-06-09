import { getDate } from 'simple-validators';
import type { LaunchpadStatus, PubsubMessageAttributes } from './launchpad.js';
import type { BaseLinks, JsonObject } from './types.js';

export interface SitePublishLinks extends BaseLinks {
  site: string;
  project: string;
}

export type SitePublishId = {
  site: string;
  publish: string;
};

export interface SitePublish {
  id: SitePublishId;
  status: LaunchpadStatus;
  cdn?: string;
  created_by: string;
  date_created: Date;
  date_modified: Date;
  links: SitePublishLinks;
}

export type SitePublishMessageAttributes = PubsubMessageAttributes & {
  action: 'publish';
  site: string;
};

export function sitePublishFromDTO(sitePublishId: SitePublishId, json: JsonObject): SitePublish {
  return {
    id: { ...sitePublishId },
    created_by: json.created_by ?? '',
    cdn: json.cdn ?? '',
    status: json.status ?? '',
    date_created: getDate(json.date_created),
    date_modified: getDate(json.date_modified),
    links: { ...json.links },
  };
}
