import type { FieldSchema, FormDefinition, FormPage } from './types.js';
import type { KeywordsOption, ParagraphOption } from './types.js';

function countWords(s: string): number {
  const t = s.trim();
  return t ? t.split(/\s+/).length : 0;
}

export function isValidEmail(email: string): boolean {
  // Simple, pragmatic validation (not full RFC).
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidOrcid(orcid: string): boolean {
  // Requested format: ####-####-####-#### (digits only)
  return /^\d{4}-\d{4}-\d{4}-\d{4}$/.test(orcid.trim());
}

export function isFieldEmpty(schema: FieldSchema, value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export type FieldValidationError = { schema: FieldSchema; message: string };

/** Author-list validation errors (same rules as getFieldErrors for type author). */
export function getAuthorFieldErrors(authors: unknown[]): { message: string }[] {
  const errors: { message: string }[] = [];
  const list = Array.isArray(authors) ? authors : [];

  if (list.length > 0) {
    const correspondingCount = list.filter((a: any) => a?.corresponding === true).length;
    if (correspondingCount === 0) {
      errors.push({ message: 'Please mark at least one author as corresponding.' });
    }
  }

  for (const [i, a] of list.entries()) {
    const name = String((a as any)?.name ?? '').trim();
    const email = String((a as any)?.email ?? '').trim();
    const orcid = String((a as any)?.orcid ?? '').trim();
    const corresponding = (a as any)?.corresponding === true;
    const affiliationIds = Array.isArray((a as any)?.affiliationIds)
      ? ((a as any).affiliationIds as unknown[]).filter((id): id is string => typeof id === 'string')
      : [];

    if (!name) {
      errors.push({ message: `Author ${i + 1}: name is required.` });
    }

    if (corresponding) {
      if (!email) {
        errors.push({
          message: `Author ${i + 1}: email is required for corresponding authors.`,
        });
      } else if (!isValidEmail(email)) {
        errors.push({ message: `Author ${i + 1}: email format is invalid.` });
      }
    } else if (email && !isValidEmail(email)) {
      errors.push({ message: `Author ${i + 1}: email format is invalid.` });
    }

    if (orcid && !isValidOrcid(orcid)) {
      errors.push({
        message: `Author ${i + 1}: ORCID must be in the format 0000-0000-0000-0000.`,
      });
    }

    if (affiliationIds.length === 0) {
      errors.push({
        message: `Author ${i + 1}: at least one affiliation is required.`,
      });
    }
  }

  return errors;
}

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

    if (schema.type === 'author') {
      const value = fields[schema.name];
      const authors = Array.isArray(value) ? (value as any[]) : [];

      if (authors.length > 0) {
        // At least one corresponding author overall.
        const correspondingCount = authors.filter((a) => a?.corresponding === true).length;
        if (correspondingCount === 0) {
          errors.push({
            schema,
            message: 'Please mark at least one author as corresponding.',
          });
        }
      }

      for (const [i, a] of authors.entries()) {
        const name = String(a?.name ?? '').trim();
        const email = String(a?.email ?? '').trim();
        const orcid = String(a?.orcid ?? '').trim();
        const corresponding = a?.corresponding === true;
        const affiliationIds = Array.isArray(a?.affiliationIds)
          ? (a.affiliationIds as unknown[]).filter((id): id is string => typeof id === 'string')
          : [];

        if (!name) {
          errors.push({
            schema,
            message: `Author ${i + 1}: name is required.`,
          });
        }

        if (corresponding) {
          if (!email) {
            errors.push({
              schema,
              message: `Author ${i + 1}: email is required for corresponding authors.`,
            });
          } else if (!isValidEmail(email)) {
            errors.push({
              schema,
              message: `Author ${i + 1}: email format is invalid.`,
            });
          }
        } else if (email && !isValidEmail(email)) {
          errors.push({
            schema,
            message: `Author ${i + 1}: email format is invalid.`,
          });
        }

        if (orcid && !isValidOrcid(orcid)) {
          errors.push({
            schema,
            message: `Author ${i + 1}: ORCID must be in the format 0000-0000-0000-0000.`,
          });
        }

        if (affiliationIds.length === 0) {
          errors.push({
            schema,
            message: `Author ${i + 1}: at least one affiliation is required.`,
          });
        }
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
