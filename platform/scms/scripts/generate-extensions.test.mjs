import assert from 'node:assert/strict';
import test from 'node:test';
import { packageNameToVarName } from './generate-extensions.js';

test('creates unique identifiers from scoped extension package names', () => {
  assert.equal(packageNameToVarName('@hhmi/compliance'), 'hhmiCompliance');
  assert.equal(packageNameToVarName('@opensci-dashboard/compliance'), 'opensciDashboardCompliance');
  assert.notEqual(
    packageNameToVarName('@hhmi/compliance'),
    packageNameToVarName('@opensci-dashboard/compliance'),
  );
});
