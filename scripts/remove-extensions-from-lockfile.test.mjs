import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseBunLock,
  scrubLockfileContent,
  tryRepairConcatenatedPackages,
} from './remove-extensions-from-lockfile.mjs';

const COMPACT_LOCKFILE = `{
  "lockfileVersion": 1,
  "workspaces": {
    "": {
      "name": "curvenote",
      "dependencies": {
        "react": "^18.0.0",
        "@hhmi/compliance": "workspace:*",
      },
    },
    "packages/foo": {
      "name": "@curvenote/foo",
      "dependencies": {
        "@hhmi/compliance": "workspace:*",
        "react": "^18.0.0",
      },
    },
    "extensions/hhmi/packages/compliance": {
      "name": "@hhmi/compliance",
      "version": "0.0.1",
      "dependencies": {
        "react": "^18.0.0",
      },
    },
  },
  "packages": {
    "@alloc/quick-lru": ["@alloc/quick-lru@5.2.0", "", {}, "sha512-aaa"],

    "@hhmi/compliance": ["@hhmi/compliance@workspace:extensions/hhmi/packages/compliance"],

    "@hhmi/compliance/react": ["@hhmi/compliance@workspace:extensions/hhmi/packages/compliance"],

    "@curvenote/foo": ["@curvenote/foo@workspace:packages/foo", "", { "dependencies": { "@hhmi/compliance": "workspace:*", "react": "^18.0.0" } }],

    "react": ["react@18.3.1", "", {}, "sha512-bbb"],
  }
}
`;

function prettyPackagesDuplicate(compact) {
  const pretty = JSON.stringify(parseBunLock(compact), null, 2);
  const inner = pretty.match(/"packages": \{\n([\s\S]*)\n {2}\}\n\}\n?$/);
  assert.ok(inner, 'expected stringify output to contain a packages object');
  return compact.replace(/\n\}\s*$/, `\n${inner[1]}\n  }\n}\n`);
}

test('scrubs extension workspaces, packages, and dependency refs without reformatting', () => {
  const { content, changed, removedWorkspaceCount, removedPackageCount } =
    scrubLockfileContent(COMPACT_LOCKFILE);

  assert.equal(changed, true);
  assert.equal(removedWorkspaceCount, 1);
  assert.ok(removedPackageCount >= 2);
  parseBunLock(content);

  assert.equal(content.includes('extensions/hhmi'), false);
  assert.equal(content.includes('@hhmi/compliance'), false);
  assert.match(content, /"@alloc\/quick-lru": \["@alloc\/quick-lru@5\.2\.0"/);
  assert.match(content, /"react": \["react@18\.3\.1"/);
  assert.equal(content.includes('\n    "@alloc/quick-lru": [\n'), false);
});

test('repairs compact packages closed then pretty-printed duplicate', () => {
  const mixed = prettyPackagesDuplicate(COMPACT_LOCKFILE);
  assert.equal(tryRepairConcatenatedPackages(mixed) !== null, true);
  assert.throws(() => parseBunLock(mixed));

  const { content, repaired, changed } = scrubLockfileContent(mixed);
  assert.equal(repaired, true);
  assert.equal(changed, true);
  parseBunLock(content);
  assert.equal(content.includes('extensions/hhmi'), false);
  assert.match(content, /"@alloc\/quick-lru": \["@alloc\/quick-lru@5\.2\.0"/);
  assert.equal(tryRepairConcatenatedPackages(content), null);
});

test('is a no-op when the lockfile has no extension entries', () => {
  const clean = `{
  "lockfileVersion": 1,
  "workspaces": {
    "": { "name": "curvenote" },
  },
  "packages": {
    "react": ["react@18.3.1", "", {}, "sha512-bbb"],
  }
}
`;
  const { content, changed } = scrubLockfileContent(clean);
  assert.equal(changed, false);
  assert.equal(content, clean);
});
