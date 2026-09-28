import type { DepositFrontmatter } from './types.js';

type Layer = { [key: string]: unknown };

const FIELDS = ['title', 'subtitle', 'date', 'license', 'authors', 'affiliations'] as const;

function asLayer(value: unknown): Layer {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Layer)
    : {};
}

function present(value: unknown): boolean {
  if (value === undefined || value === null || value === '') {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'object') {
    return Object.keys(value as Layer).length > 0;
  }
  return true;
}

/**
 * Per-field precedence: `WorkVersion.metadata['frontmatter.myst']` (what site admins edit after
 * upload), then `config.projects[0]`, then the index page frontmatter. No merge existed before
 * this; every deposit field goes through here so the rule has one home.
 */
export function mergeFrontmatter(db: unknown, project: unknown, page: unknown): DepositFrontmatter {
  const layers = [asLayer(db), asLayer(project), asLayer(page)];
  const merged: Layer = {};
  for (const field of FIELDS) {
    merged[field] = layers.map((layer) => layer[field]).find(present);
  }
  return merged as DepositFrontmatter;
}
