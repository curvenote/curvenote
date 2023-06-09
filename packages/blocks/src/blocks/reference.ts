import type { JsonObject } from '../types.js';
import type { KINDS, BaseVersion } from './types/index.js';
import { ReferenceFormatTypes } from './types/index.js';

interface RisFull {
  AB: string;
  AU: string[];
  DA: string;
  PY: string;
  J2: string;
  DO: string;
  IS: string;
  LB: string;
  SN: string;
  SP: string;
  T2: string;
  TI: string;
  TY: string;
  UR: string;
  VL: string | number;
}

export type RIS = Partial<RisFull>;

export interface PartialReference {
  link: string;
  content: string; // formatted content
  ris: RIS; // research information system
}

// the versioned block
export interface Reference extends BaseVersion, PartialReference {
  kind: typeof KINDS.Reference;
}

export const defaultFormat = ReferenceFormatTypes.json;

export function fromDTO(json: JsonObject): PartialReference {
  return {
    link: json.link ?? '',
    content: json.content ?? '',
    ris: json.ris ?? {},
  };
}
