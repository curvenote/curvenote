import { useState, useEffect } from 'react';
import { GripVertical, Pencil, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Affiliation } from '../types.js';
import { getAffiliationSubtitle } from './affiliationHelpers.js';
import { ui } from '@curvenote/scms-core';

export type SortableAffiliationRowProps = {
  authorId: string;
  affiliationId: string;
  affiliation: Affiliation;
  name: string;
  onRename: (affiliationId: string, newName: string) => void;
  onUpdate: (affiliationId: string, updates: Partial<Affiliation>) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
};

export function SortableAffiliationRow({
  authorId,
  affiliationId,
  affiliation,
  name,
  onRename,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: SortableAffiliationRowProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);
  const [showDeptLocation, setShowDeptLocation] = useState(false);
  const [editDepartment, setEditDepartment] = useState(affiliation.department ?? '');
  const [editCity, setEditCity] = useState(affiliation.city ?? '');
  const [editCountry, setEditCountry] = useState(affiliation.country ?? '');
  const id = `${authorId}-aff-${affiliationId}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id: affiliationId,
  });

  useEffect(() => {
    setEditValue(name);
  }, [name]);
  useEffect(() => {
    setEditDepartment(affiliation.department ?? '');
    setEditCity(affiliation.city ?? '');
    setEditCountry(affiliation.country ?? '');
  }, [affiliation.department, affiliation.city, affiliation.country]);

  const hasDeptOrLocation = !!(
    (affiliation.department ?? '').trim() ||
    (affiliation.city ?? '').trim() ||
    (affiliation.country ?? '').trim()
  );
  const hasRor = !!(affiliation.ror ?? '').trim();

  const saveNameOnly = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== name) onRename(affiliationId, trimmed);
  };

  const handleDoneEditing = () => {
    saveNameOnly();
    setEditing(false);
  };

  const saveDepartment = () => {
    const trimmed = (editDepartment ?? '').trim();
    if (trimmed !== (affiliation.department ?? '').trim()) {
      onUpdate(affiliationId, { department: trimmed || undefined });
    }
  };
  const saveCity = () => {
    const trimmed = (editCity ?? '').trim();
    if (trimmed !== (affiliation.city ?? '').trim()) {
      onUpdate(affiliationId, { city: trimmed || undefined });
    }
  };
  const saveCountry = () => {
    const trimmed = (editCountry ?? '').trim();
    if (trimmed !== (affiliation.country ?? '').trim()) {
      onUpdate(affiliationId, { country: trimmed || undefined });
    }
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: 'none',
    opacity: isDragging ? 0 : 1,
  };

  const deptLocationExpanded = showDeptLocation;
  const subtitle = getAffiliationSubtitle(affiliation);
  const rorFields = affiliation.rorFields ?? [];
  const nameFromRor = rorFields.includes('name');
  const cityFromRor = rorFields.includes('city');
  const countryFromRor = rorFields.includes('country');

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex gap-2 items-start px-3 py-2 text-sm rounded-md border border-border bg-muted/30"
    >
      <div className="flex flex-col gap-0.5 items-center shrink-0 mt-0.5">
        {onMoveUp != null && (
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="p-0.5 rounded touch-manipulation cursor-pointer disabled:opacity-30 disabled:pointer-events-none disabled:cursor-default text-muted-foreground hover:text-foreground"
            aria-label="Move up"
          >
            <ChevronUp className="w-3 h-3" />
          </button>
        )}
        <button
          {...attributes}
          {...listeners}
          type="button"
          className="cursor-grab active:cursor-grabbing touch-none p-0.5"
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground/50 hover:text-muted-foreground" />
        </button>
        {onMoveDown != null && (
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className="p-0.5 rounded touch-manipulation cursor-pointer disabled:opacity-30 disabled:pointer-events-none disabled:cursor-default text-muted-foreground hover:text-foreground"
            aria-label="Move down"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="flex-1 space-y-2 min-w-0">
        {editing ? (
          <>
            <input
              type="text"
              autoComplete="off"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={saveNameOnly}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveNameOnly();
                if (e.key === 'Escape') {
                  setEditValue(name);
                  setEditing(false);
                }
              }}
              disabled={nameFromRor}
              className="px-2 py-1 w-full min-w-0 text-sm rounded border outline-none border-input bg-background disabled:opacity-60 disabled:cursor-not-allowed"
              autoFocus={!nameFromRor}
            />
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowDeptLocation(!deptLocationExpanded)}
                className="flex gap-1.5 items-center text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {deptLocationExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>
                  {hasDeptOrLocation ? 'Edit department or location' : 'Add department or location'}
                </span>
              </button>
              {deptLocationExpanded && (
                <div className="pl-5 space-y-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="space-y-1">
                      <label
                        htmlFor={`${id}-department`}
                        className="text-xs font-medium text-muted-foreground"
                      >
                        Department
                      </label>
                      <ui.Input
                        id={`${id}-department`}
                        type="text"
                        autoComplete="off"
                        value={editDepartment}
                        onChange={(e) => setEditDepartment(e.target.value)}
                        onBlur={saveDepartment}
                        placeholder="Department"
                        className="w-full text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor={`${id}-city`}
                        className="text-xs font-medium text-muted-foreground"
                      >
                        City
                      </label>
                      <ui.Input
                        id={`${id}-city`}
                        type="text"
                        autoComplete="off"
                        value={editCity}
                        onChange={(e) => setEditCity(e.target.value)}
                        onBlur={saveCity}
                        placeholder="City"
                        disabled={cityFromRor}
                        className="w-full text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor={`${id}-country`}
                        className="text-xs font-medium text-muted-foreground"
                      >
                        Country
                      </label>
                      <ui.Input
                        id={`${id}-country`}
                        type="text"
                        autoComplete="off"
                        value={editCountry}
                        onChange={(e) => setEditCountry(e.target.value)}
                        onBlur={saveCountry}
                        placeholder="Country"
                        disabled={countryFromRor}
                        className="w-full text-sm"
                      />
                    </div>
                  </div>
                  {hasRor && affiliation.ror && (
                    <p className="font-mono text-xs truncate text-muted-foreground">
                      ROR:{' '}
                      <a
                        href={affiliation.ror}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="no-underline cursor-pointer text-muted-foreground hover:text-muted-foreground"
                      >
                        {affiliation.ror}
                      </a>
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 space-y-2 min-w-0">
            <span className="block min-w-0 truncate">{name}</span>
            {subtitle ? (
              <span className="block min-w-0 text-xs truncate text-muted-foreground">
                {subtitle}
              </span>
            ) : !hasDeptOrLocation ? (
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                  setShowDeptLocation(true);
                }}
                className="flex gap-1.5 items-center text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>Add department or location</span>
              </button>
            ) : null}
          </div>
        )}
      </div>
      <div className="flex gap-1 items-start shrink-0">
        {editing ? (
          <>
            <ui.Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={handleDoneEditing}
              aria-label="Collapse"
              className="cursor-pointer shrink-0"
            >
              <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
            </ui.Button>
            <ui.Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onRemove}
              aria-label="Remove affiliation"
              className="cursor-pointer shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
            </ui.Button>
          </>
        ) : (
          <>
            <ui.Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setEditing(true)}
              aria-label="Edit affiliation"
              className="cursor-pointer shrink-0"
            >
              <Pencil className="w-3.5 h-3.5" />
            </ui.Button>
            <ui.Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onRemove}
              aria-label="Remove affiliation"
              className="cursor-pointer shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
            </ui.Button>
          </>
        )}
      </div>
    </div>
  );
}
