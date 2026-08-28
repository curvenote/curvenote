/* eslint-disable import/no-extraneous-dependencies */
import { describe, expect, test } from 'vitest';
import { getTagAddControlKind, getTagAddTriggerLabel } from './SubmissionTags.utils.js';

describe('getTagAddControlKind', () => {
  test('shows Add Tags when there are no assigned tags and the user can update', () => {
    expect(getTagAddControlKind({ permission: 'update', assignedCount: 0 })).toBe('add-tags');
  });

  test('shows Add Tags when there are no assigned tags and the user cannot update', () => {
    expect(getTagAddControlKind({ permission: 'read', assignedCount: 0 })).toBe('add-tags');
  });

  test('shows plus when there are assigned tags and the user can update', () => {
    expect(getTagAddControlKind({ permission: 'update', assignedCount: 2 })).toBe('plus');
  });

  test('hides plus when there are assigned tags and the user cannot update', () => {
    expect(getTagAddControlKind({ permission: 'read', assignedCount: 2 })).toBe('none');
  });
});

describe('getTagAddTriggerLabel', () => {
  test('labels the empty control Add Tags', () => {
    expect(getTagAddTriggerLabel('add-tags')).toBe('Add Tags');
  });

  test('labels the compact plus for add or remove', () => {
    expect(getTagAddTriggerLabel('plus')).toBe('Add or remove tags');
  });
});
