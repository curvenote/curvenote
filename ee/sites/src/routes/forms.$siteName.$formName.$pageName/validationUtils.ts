import type { FieldSchema, FormDefinition, FormPage } from './types.js';

export function isFieldEmpty(schema: FieldSchema, value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
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
