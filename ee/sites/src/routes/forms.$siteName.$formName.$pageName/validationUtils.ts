import type { FieldSchema, FormDefinition, FormPage } from './types.js';
import type { KeywordsOption, ParagraphOption } from './types.js';

function countWords(s: string): number {
  const t = s.trim();
  return t ? t.split(/\s+/).length : 0;
}

export function isFieldEmpty(schema: FieldSchema, value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export type FieldValidationError = { schema: FieldSchema; message: string };

/** Validation errors (e.g. keywords over max). Does not include required-empty. */
export function getFieldErrors(
  form: FormDefinition,
  fields: Record<string, unknown>,
): FieldValidationError[] {
  const errors: FieldValidationError[] = [];
  for (const schema of form.fields) {
    if (schema.type === 'keywords') {
      const max = (schema as KeywordsOption).maxKeywords;
      if (max == null) continue;
      const value = fields[schema.name];
      const arr = Array.isArray(value) ? value : [];
      if (arr.length > max) {
        errors.push({
          schema,
          message: `Please reduce to ${max} keyword${max === 1 ? '' : 's'} or fewer.`,
        });
      }
      continue;
    }
    if (schema.type === 'paragraph') {
      const max = (schema as ParagraphOption).maxWordCount;
      if (max == null) continue;
      const value = fields[schema.name];
      const text = typeof value === 'string' ? value : '';
      const words = countWords(text);
      if (words > max) {
        errors.push({
          schema,
          message: `Please reduce to ${max} words or fewer.`,
        });
      }
    }
  }
  return errors;
}

/** Required fields that are empty for a given page. */
export function getMissingRequiredForPage(
  page: FormPage,
  form: FormDefinition,
  fields: Record<string, unknown>,
): FieldSchema[] {
  if (page.slug === 'review') {
    return form.fields.filter((f) => f.required && isFieldEmpty(f, fields[f.name]));
  }
  const missing: FieldSchema[] = [];
  for (const child of page.children) {
    if (child.type !== 'field') continue;
    const schema = form.fields.find((f) => f.name === child.id);
    if (schema?.required && isFieldEmpty(schema, fields[child.id])) {
      missing.push(schema);
    }
  }
  return missing;
}

export function isPageComplete(
  page: FormPage,
  form: FormDefinition,
  fields: Record<string, unknown>,
): boolean {
  return getMissingRequiredForPage(page, form, fields).length === 0;
}
