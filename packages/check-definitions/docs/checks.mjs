import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { u } from 'unist-builder';
import { mystParse } from 'myst-parser';
import { fileError, fileWarn } from 'myst-common';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const checks = JSON.parse(fs.readFileSync(path.join(dirname, 'checks.json'))).items;

export const plugin = {
  name: 'Curvenote Checks Documentation Plugins',
  author: 'Franklin Koch',
  license: 'MIT',
};

/**
 * @param {import('myst-common').OptionDefinition} option
 */
function type2string(option) {
  if (option.type === 'string' || option.type === String) return 'string';
  if (option.type === 'number' || option.type === Number) return 'number';
  if (option.type === 'boolean' || option.type === Boolean) return 'boolean';
  if (option.type === 'parsed' || option.type === 'myst') return 'parsed';
  return '';
}

function createOption(check, optName, option) {
  if (!option) return [];
  const optType = type2string(option);
  const def = [
    u('definitionTerm', { identifier: `check-${check.id}-${optName}` }, [
      u('strong', [u('text', optName)]),
      ...(optType
        ? [
            u('text', ' ('),
            u('emphasis', [u('text', `${optType}${option.required ? ', required' : ''}`)]),
            u('text', ')'),
          ]
        : []),
    ]),
    u(
      'definitionDescription',
      option.title ? mystParse(option.title).children : [u('text', 'No description')],
    ),
  ];
  return def;
}

function renderCheck(id, vfile) {
  const check = checks.find((c) => c.id === id);
  if (!check) {
    fileError(vfile, `curvenote:check - Unknown curvenote check "${id}"`);
    return [];
  }
  const rendered = [
    u('heading', { depth: 2, identifier: `check-${id}` }, [u('text', check.title)]),
    u('p', [u('strong', [u('text', 'category: ')]), u('inlineCode', check.category)]),
    u('p', [u('strong', [u('text', 'id: ')]), u('inlineCode', id)]),
    u('p', check.description ? mystParse(check.description).children : []),
  ];
  if (check.options?.length) {
    const options = check.options.map((option) => createOption(check, option.id, option)).flat();
    const list = u('definitionList', [
      u('definitionTerm', { identifier: `check-${check.id}-opts` }, [
        u('strong', [u('text', 'Options')]),
      ]),
      u('definitionDescription', [u('definitionList', options)]),
    ]);
    rendered.push(list);
  }
  // check.example as code block? We probably need correct example and bad example?
  return rendered;
}

/**
 * Create a documentation section for a check
 *
 * @type {import('myst-common').DirectiveSpec}
 */
const checkDirective = {
  name: 'curvenote:check',
  arg: {
    type: String,
  },
  options: {
    category: {
      type: String,
      doc: 'Category of check',
    },
    source: {
      type: String,
      doc: 'Source of check (MyST, Curvenote, specific Journal)',
    },
  },
  run(data, vfile) {
    const { category, source } = data.options ?? {};
    if (data.arg && (category || source)) {
      fileWarn(vfile, 'curvenote:check directive argument overrides category/source options');
    }
    return checks
      .filter((check) => {
        if (data.arg) return check.id === data.arg;
        const categoryMatch = !category || check.category === category;
        const sourceMatch = !source || check.source === source;
        return categoryMatch && sourceMatch;
      })
      .map((check) => renderCheck(check.id, vfile))
      .flat();
  },
};

const REF_PATTERN = /^(.+?)<([^<>]+)>$/; // e.g. 'Labeled Reference <ref>'

/**
 * Create a documentation section for a directive
 *
 * @type {import('myst-common').RoleSpec}
 */
const checkRole = {
  name: 'curvenote:check',
  body: {
    type: String,
    required: true,
  },
  run(data) {
    const match = REF_PATTERN.exec(data.body);
    const [, modified, rawLabel] = match ?? [];
    const label = rawLabel ?? data.body;
    const [id, opt] = label?.split('.') ?? [];
    const check = checks.find((c) => c.id === id);
    const identifier = opt ? `check-${check?.id ?? id}-${opt}` : `check-${check?.id ?? id}`;
    return [u('crossReference', { identifier }, [u('inlineCode', modified?.trim() || opt || id)])];
  },
};

export const directives = [checkDirective];
export const roles = [checkRole];
