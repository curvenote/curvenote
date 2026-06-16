import { coerceToObject } from '@curvenote/scms-core';

export const DEFAULT_CONVERTER_TARGET = 'pdf';
export const DEFAULT_CONVERSION_TYPE = 'docx-pandoc-myst-pdf';

export type ConverterActivityData = {
  target: string;
  type: string;
};

/** Derives work-timeline `converter` fields from a job payload record. */
export function converterActivityFromPayload(payload: unknown): ConverterActivityData {
  const record = coerceToObject(payload);
  return {
    target: typeof record?.target === 'string' ? record.target : DEFAULT_CONVERTER_TARGET,
    type:
      typeof record?.conversion_type === 'string'
        ? record.conversion_type
        : DEFAULT_CONVERSION_TYPE,
  };
}
