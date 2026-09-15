export type TagAddControlKind = 'add-tags' | 'plus' | 'none';

export type TagAddControlInput =
  { permission: 'update'; assignedCount: number } | { permission: 'read'; assignedCount: number };

export function getTagAddControlKind(input: {
  permission: 'update';
  assignedCount: number;
}): 'add-tags' | 'plus';
export function getTagAddControlKind(input: {
  permission: 'read';
  assignedCount: number;
}): 'add-tags' | 'none';
export function getTagAddControlKind(input: TagAddControlInput): TagAddControlKind {
  if (input.assignedCount === 0) {
    return 'add-tags';
  }
  if (input.permission === 'update') {
    return 'plus';
  }
  return 'none';
}

export function getTagAddTriggerLabel(kind: 'add-tags' | 'plus'): string {
  if (kind === 'add-tags') {
    return 'Add Tags';
  }
  return 'Add or remove tags';
}
