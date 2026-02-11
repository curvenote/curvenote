import { useState, useEffect, useRef } from 'react';
import { useFetcher } from 'react-router';
import { uuidv7 as uuid } from 'uuidv7';
import {
  GripVertical,
  Building2,
  Pencil,
  Plus,
  Minus,
  Trash2,
  ChevronUp,
  ChevronDown,
  BadgeCheck,
  CornerDownLeft,
} from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FormLabel } from './FormLabel.js';
import type { Author, Affiliation, AuthorOption } from './types.js';
import { isValidEmail, isValidOrcid, getAuthorFieldErrors } from './validationUtils.js';
import { useSaveField } from './useSaveField.js';
import { ui } from '@curvenote/scms-core';

const ADD_AUTHOR_PLACEHOLDER_ID = 'add-author-placeholder';

/** ROR (Research Organization Registry) icon - from https://github.com/ror-community/ror-logos */
function RorIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 164 118"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      style={{ fillRule: 'evenodd', clipRule: 'evenodd' }}
    >
      <g transform="matrix(1,0,0,1,-0.945,-0.815)">
        <path
          d="M68.65,4.16L56.52,22.74L44.38,4.16L68.65,4.16Z"
          fill="rgb(83,186,161)"
          fillRule="nonzero"
        />
        <path
          d="M119.41,4.16L107.28,22.74L95.14,4.16L119.41,4.16Z"
          fill="rgb(83,186,161)"
          fillRule="nonzero"
        />
        <path
          d="M44.38,115.47L56.52,96.88L68.65,115.47L44.38,115.47Z"
          fill="rgb(83,186,161)"
          fillRule="nonzero"
        />
        <path
          d="M95.14,115.47L107.28,96.88L119.41,115.47L95.14,115.47Z"
          fill="rgb(83,186,161)"
          fillRule="nonzero"
        />
        <path
          d="M145.53,63.71C149.83,62.91 153.1,61 155.33,57.99C157.57,54.98 158.68,51.32 158.68,47.03C158.68,43.47 158.06,40.51 156.83,38.13C155.6,35.75 153.93,33.86 151.84,32.45C149.75,31.05 147.31,30.04 144.53,29.44C141.75,28.84 138.81,28.54 135.72,28.54L112.16,28.54L112.16,47.37C111.97,46.82 111.77,46.28 111.55,45.74C109.92,41.79 107.64,38.42 104.71,35.64C101.78,32.86 98.32,30.72 94.3,29.23C90.29,27.74 85.9,26.99 81.14,26.99C76.38,26.99 72,27.74 67.98,29.23C63.97,30.72 60.5,32.86 57.57,35.64C54.95,38.13 52.85,41.1 51.27,44.54C51.04,42.07 50.46,39.93 49.53,38.13C48.3,35.75 46.63,33.86 44.54,32.45C42.45,31.05 40.01,30.04 37.23,29.44C34.45,28.84 31.51,28.54 28.42,28.54L4.87,28.54L4.87,89.42L18.28,89.42L18.28,65.08L24.9,65.08L37.63,89.42L53.71,89.42L38.24,63.71C42.54,62.91 45.81,61 48.04,57.99C48.14,57.85 48.23,57.7 48.33,57.56C48.31,58.03 48.3,58.5 48.3,58.98C48.3,63.85 49.12,68.27 50.75,72.22C52.38,76.17 54.66,79.54 57.59,82.32C60.51,85.1 63.98,87.24 68,88.73C72.01,90.22 76.4,90.97 81.16,90.97C85.92,90.97 90.3,90.22 94.32,88.73C98.33,87.24 101.8,85.1 104.73,82.32C107.65,79.54 109.93,76.17 111.57,72.22C111.79,71.69 111.99,71.14 112.18,70.59L112.18,89.42L125.59,89.42L125.59,65.08L132.21,65.08L144.94,89.42L161.02,89.42L145.53,63.71ZM36.39,50.81C35.67,51.73 34.77,52.4 33.68,52.83C32.59,53.26 31.37,53.52 30.03,53.6C28.68,53.69 27.41,53.73 26.2,53.73L18.29,53.73L18.29,39.89L27.06,39.89C28.26,39.89 29.5,39.98 30.76,40.15C32.02,40.32 33.14,40.65 34.11,41.14C35.08,41.63 35.89,42.33 36.52,43.25C37.15,44.17 37.47,45.4 37.47,46.95C37.47,48.6 37.11,49.89 36.39,50.81ZM98.74,66.85C97.85,69.23 96.58,71.29 94.91,73.04C93.25,74.79 91.26,76.15 88.93,77.13C86.61,78.11 84.01,78.59 81.15,78.59C78.28,78.59 75.69,78.1 73.37,77.13C71.05,76.16 69.06,74.79 67.39,73.04C65.73,71.29 64.45,69.23 63.56,66.85C62.67,64.47 62.23,61.85 62.23,58.98C62.23,56.17 62.67,53.56 63.56,51.15C64.45,48.74 65.72,46.67 67.39,44.92C69.05,43.17 71.04,41.81 73.37,40.83C75.69,39.86 78.28,39.37 81.15,39.37C84.02,39.37 86.61,39.86 88.93,40.83C91.25,41.8 93.24,43.17 94.91,44.92C96.57,46.67 97.85,48.75 98.74,51.15C99.63,53.56 100.07,56.17 100.07,58.98C100.07,61.85 99.63,64.47 98.74,66.85ZM143.68,50.81C142.96,51.73 142.06,52.4 140.97,52.83C139.88,53.26 138.66,53.52 137.32,53.6C135.97,53.69 134.7,53.73 133.49,53.73L125.58,53.73L125.58,39.89L134.35,39.89C135.55,39.89 136.79,39.98 138.05,40.15C139.31,40.32 140.43,40.65 141.4,41.14C142.37,41.63 143.18,42.33 143.81,43.25C144.44,44.17 144.76,45.4 144.76,46.95C144.76,48.6 144.4,49.89 143.68,50.81Z"
          fill="rgb(32,40,38)"
          fillRule="nonzero"
        />
      </g>
    </svg>
  );
}

function getOrdinalLabel(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

type SortableAffiliationRowProps = {
  authorId: string;
  index: number;
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

function SortableAffiliationRow({
  authorId,
  index,
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
      <span className="w-6 text-xs tabular-nums shrink-0 text-muted-foreground mt-0.5">
        {getOrdinalLabel(index + 1)}
      </span>
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
              className="px-2 py-1 w-full min-w-0 text-sm rounded border outline-none border-input bg-background"
              autoFocus
            />
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowDeptLocation(!deptLocationExpanded)}
                className="flex gap-1.5 items-center text-xs text-muted-foreground hover:text-foreground"
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
          <span className="block min-w-0 truncate">{name}</span>
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

type AffiliationSortableListProps = {
  affiliationIds: string[];
  affiliationList: Affiliation[];
  onReorder: (newOrder: string[]) => void;
  onRemove: (affiliationId: string) => void;
  onRename: (affiliationId: string, newName: string) => void;
  onUpdate: (affiliationId: string, updates: Partial<Affiliation>) => void;
  authorId: string;
};

function getAffiliationName(list: Affiliation[], id: string): string {
  const name = list.find((a) => a.id === id)?.name;
  return (name ?? '').trim();
}

function AffiliationSortableList({
  affiliationIds,
  affiliationList,
  onReorder,
  onRemove,
  onRename,
  onUpdate,
  authorId,
}: AffiliationSortableListProps) {
  const [activeAffId, setActiveAffId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveAffId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveAffId(null);
    if (!over || active.id === over.id) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    const oldIndex = affiliationIds.indexOf(activeId);
    const newIndex = affiliationIds.indexOf(overId);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = [...affiliationIds];
    const [removed] = newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, removed);
    onReorder(newOrder);
  };

  if (affiliationIds.length === 0) return null;

  const moveAffiliation = (idx: number, direction: 'up' | 'down') => {
    if (direction === 'up' && idx <= 0) return;
    if (direction === 'down' && idx >= affiliationIds.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const newOrder = [...affiliationIds];
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    onReorder(newOrder);
  };

  const activeAffiliation = activeAffId ? affiliationList.find((a) => a.id === activeAffId) : null;
  const activeIndex = activeAffId ? affiliationIds.indexOf(activeAffId) + 1 : 0;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={affiliationIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {affiliationIds.map((affId, idx) => {
            const affiliation = affiliationList.find((a) => a.id === affId);
            if (!affiliation) return null;
            return (
              <SortableAffiliationRow
                key={`${authorId}-aff-${affId}`}
                authorId={authorId}
                index={idx}
                affiliationId={affId}
                affiliation={affiliation}
                name={getAffiliationName(affiliationList, affId)}
                onRename={onRename}
                onUpdate={onUpdate}
                onRemove={() => onRemove(affId)}
                onMoveUp={() => moveAffiliation(idx, 'up')}
                onMoveDown={() => moveAffiliation(idx, 'down')}
                canMoveUp={idx > 0}
                canMoveDown={idx < affiliationIds.length - 1}
              />
            );
          })}
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={null}>
        {activeAffiliation ? (
          <div
            className="flex gap-2 items-center px-3 py-2 w-64 text-sm rounded-md border shadow-lg border-border bg-muted/30 cursor-grabbing"
            style={{ minHeight: 40 }}
          >
            <GripVertical className="w-4 h-4 text-muted-foreground/50 shrink-0" />
            <span className="w-6 text-xs tabular-nums shrink-0 text-muted-foreground">
              {getOrdinalLabel(activeIndex)}
            </span>
            <span className="flex-1 min-w-0 truncate">
              {(activeAffiliation.name ?? '').trim() || 'Affiliation'}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

type AuthorCardProps = {
  value: Author;
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (author: Author) => void;
  onDelete: () => void;
  affiliationList: Affiliation[];
  onEnsureAffiliationInList: (aff: Affiliation) => void;
  onRenameAffiliation?: (affiliationId: string, newName: string) => void;
  onUpdateAffiliation?: (affiliationId: string, updates: Partial<Affiliation>) => void;
  affiliationInputRef?: React.RefObject<HTMLInputElement | null>;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
};

function AuthorCard({
  value,
  index,
  open,
  onOpenChange,
  onChange,
  onDelete,
  affiliationList,
  onEnsureAffiliationInList,
  onRenameAffiliation,
  onUpdateAffiliation,
  affiliationInputRef,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: AuthorCardProps) {
  const [editName, setEditName] = useState(value.name);
  const [editOrcid, setEditOrcid] = useState(value.orcid || '');
  const [editEmail, setEditEmail] = useState(value.email || '');
  const [editCorresponding, setEditCorresponding] = useState(value.corresponding || false);
  const [editAffiliationIds, setEditAffiliationIds] = useState<string[]>(
    value.affiliationIds ?? [],
  );
  const [newAffiliationInput, setNewAffiliationInput] = useState('');
  const [expandAddDetails, setExpandAddDetails] = useState(false);
  const [addDetailsName, setAddDetailsName] = useState('');
  const [addDetailsDepartment, setAddDetailsDepartment] = useState('');
  const [addDetailsCity, setAddDetailsCity] = useState('');
  const [addDetailsCountry, setAddDetailsCountry] = useState('');
  const lastRorResultsRef = useRef<RorSearchHit[]>([]);
  const lastSubmittedRorQRef = useRef('');
  const rorSearchFetcher = useFetcher();

  useEffect(() => {
    const trimmed = newAffiliationInput.trim();
    if (!trimmed) return;
    const t = setTimeout(() => {
      lastSubmittedRorQRef.current = trimmed;
      const fd = new FormData();
      fd.set('intent', 'search-ror');
      fd.set('q', trimmed);
      rorSearchFetcher.submit(fd, { method: 'POST' });
    }, 300);
    return () => clearTimeout(t);
  }, [newAffiliationInput]);

  const rorSearchOptions = (() => {
    if (rorSearchFetcher.state !== 'idle' || !rorSearchFetcher.data) return undefined;
    const currentQ = newAffiliationInput.trim();
    if (currentQ !== lastSubmittedRorQRef.current) return undefined;
    const data = rorSearchFetcher.data as { results?: RorSearchHit[] };
    const results = data?.results ?? [];
    lastRorResultsRef.current = results;
    return results.map((r) => ({
      value: r.ror,
      label: r.name,
      description: [r.city, r.country].filter(Boolean).join(', ') || undefined,
    }));
  })();
  const rorSearchLoading = rorSearchFetcher.state !== 'idle';

  const onSelectRorSuggestion = (hit: RorSearchHit) => {
    const aff: Affiliation = {
      id: uuid(),
      name: hit.name,
      ror: hit.ror,
      ...(hit.city && { city: hit.city }),
      ...(hit.country && { country: hit.country }),
    };
    if (open) addAffiliation(aff);
    else addAffiliationInViewMode(aff);
    setNewAffiliationInput('');
  };

  const onRorSelectFromCombobox = (ror: string) => {
    const hit = lastRorResultsRef.current.find((r) => r.ror === ror);
    if (hit) onSelectRorSuggestion(hit);
  };

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: value.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  const pushAuthor = (updates: Partial<Author>) => {
    onChange({ ...value, ...updates });
  };

  const addAffiliation = (aff: Affiliation) => {
    if (editAffiliationIds.includes(aff.id)) return;
    onEnsureAffiliationInList(aff);
    const next = [...editAffiliationIds, aff.id];
    setEditAffiliationIds(next);
    pushAuthor({ affiliationIds: next });
  };

  const addAffiliationInViewMode = (aff: Affiliation) => {
    if ((value.affiliationIds ?? []).includes(aff.id)) return;
    onEnsureAffiliationInList(aff);
    onChange({
      ...value,
      affiliationIds: [...(value.affiliationIds ?? []), aff.id],
    });
  };

  // Update local state when value changes externally
  useEffect(() => {
    setEditName(value.name);
    setEditOrcid(value.orcid || '');
    setEditEmail(value.email || '');
    setEditCorresponding(value.corresponding || false);
    setEditAffiliationIds(value.affiliationIds ?? []);
  }, [value]);

  const emailValid = editEmail.trim() === '' ? null : isValidEmail(editEmail);
  const orcidValid = editOrcid.trim() === '' ? null : isValidOrcid(editOrcid);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex gap-3 items-start p-4 rounded-sm border bg-background ${
        isDragging ? 'shadow-lg border-primary' : 'border-border'
      }`}
    >
      {/* Move up, drag handle, move down */}
      <div className="flex flex-col gap-0.5 items-center pt-1 shrink-0">
        {onMoveUp != null && (
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="p-0.5 rounded touch-manipulation cursor-pointer disabled:opacity-30 disabled:pointer-events-none disabled:cursor-default text-muted-foreground hover:text-foreground"
            aria-label="Move up"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        )}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none p-0.5"
          type="button"
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
            <ChevronDown className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Ordinal (1st, 2nd, 3rd) */}
      <div className="pt-1.5 shrink-0 text-xs text-muted-foreground tabular-nums">
        {getOrdinalLabel(index + 1)}
      </div>

      {/* Author content */}
      <div className="flex-1 min-w-0">
        {open ? (
          /* Expanded: top matches collapsed card exactly, then divider, then form */
          <div className="space-y-4">
            {/* Preview: same layout as collapsed – name + ORCID badge when valid only */}
            <div>
              <div className="flex flex-wrap gap-2 items-center mb-2">
                <span
                  className={`text-base font-semibold ${editName.trim() ? '' : 'text-muted-foreground/60'}`}
                >
                  {editName.trim() || 'Author Name'}
                </span>
                {orcidValid === true && (value.orcid ?? editOrcid)?.trim() && (
                  <a
                    href={
                      (value.orcid ?? editOrcid)!.trim().startsWith('http')
                        ? (value.orcid ?? editOrcid)!.trim()
                        : `https://orcid.org/${(value.orcid ?? editOrcid)!.trim()}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="no-underline cursor-pointer shrink-0"
                    aria-label="View ORCID profile"
                  >
                    <BadgeCheck className="w-4 h-4 text-green-500" aria-hidden />
                  </a>
                )}
              </div>
              {editAffiliationIds.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {editAffiliationIds.map((affId) => {
                    const affName = getAffiliationName(affiliationList, affId);
                    return (
                      <ui.Badge
                        key={affId}
                        variant="outline-muted"
                        className="flex gap-1 items-center text-xs"
                      >
                        <Building2 className="w-3 h-3" />
                        {affName ? <span className="truncate max-w-[200px]">{affName}</span> : null}
                      </ui.Badge>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <hr className="border-border" />

            {/* Full Name */}
            <div className="space-y-2">
              <FormLabel
                htmlFor={`author-${index}-name`}
                required={true}
                valid={editName.trim().length > 0}
              >
                Full Name
              </FormLabel>
              <ui.Input
                id={`author-${index}-name`}
                type="text"
                autoComplete="off"
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value);
                  pushAuthor({ name: e.target.value });
                }}
                placeholder="Enter full name"
              />
            </div>

            {/* ORCID */}
            <div className="space-y-2">
              <div className="flex gap-2 items-center">
                <BadgeCheck
                  className={`w-4 h-4 shrink-0 ${orcidValid === true ? 'text-green-500' : 'text-muted-foreground'}`}
                  aria-label={orcidValid === true ? 'ORCID valid' : 'ORCID'}
                />
                <FormLabel
                  htmlFor={`author-${index}-orcid`}
                  required={false}
                  valid={orcidValid === true}
                  invalid={orcidValid === false}
                >
                  ORCID
                </FormLabel>
              </div>
              <ui.Input
                id={`author-${index}-orcid`}
                type="text"
                autoComplete="off"
                value={editOrcid}
                onChange={(e) => {
                  setEditOrcid(e.target.value);
                  pushAuthor({ orcid: e.target.value.trim() || undefined });
                }}
                placeholder="0000-0000-0000-0000"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <FormLabel
                htmlFor={`author-${index}-email`}
                required={editCorresponding}
                valid={emailValid === true}
                invalid={emailValid === false}
              >
                Email {editCorresponding && '(required for corresponding)'}
              </FormLabel>
              <ui.Input
                id={`author-${index}-email`}
                type="email"
                autoComplete="off"
                value={editEmail}
                onChange={(e) => {
                  setEditEmail(e.target.value);
                  pushAuthor({ email: e.target.value.trim() || undefined });
                }}
                placeholder="email@example.com"
              />
            </div>

            {/* Corresponding Author */}
            <div className="flex gap-2 items-center">
              <ui.Checkbox
                id={`author-${index}-corresponding`}
                checked={editCorresponding}
                onCheckedChange={(checked) => {
                  setEditCorresponding(checked === true);
                  pushAuthor({ corresponding: checked === true });
                }}
              />
              <label
                htmlFor={`author-${index}-corresponding`}
                className="text-sm font-medium cursor-pointer"
              >
                Corresponding author
              </label>
            </div>

            {/* Affiliations: reorderable horizontal rectangles with edit/delete */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Affiliations</label>
              <AffiliationSortableList
                affiliationIds={editAffiliationIds}
                affiliationList={affiliationList}
                onReorder={(newOrder) => {
                  setEditAffiliationIds(newOrder);
                  pushAuthor({ affiliationIds: newOrder });
                }}
                onRemove={(affiliationId) => {
                  const next = editAffiliationIds.filter((id) => id !== affiliationId);
                  setEditAffiliationIds(next);
                  pushAuthor({ affiliationIds: next });
                }}
                onRename={(affiliationId, newName) => {
                  onRenameAffiliation?.(affiliationId, newName.trim());
                }}
                onUpdate={(affiliationId, updates) => {
                  onUpdateAffiliation?.(affiliationId, updates);
                }}
                authorId={value.id}
              />
              <div className="flex gap-2">
                <div className="relative flex-1 min-w-0">
                  <ui.AsyncComboBox
                    triggerMode="inline"
                    value=""
                    onValueChange={onRorSelectFromCombobox}
                    onSearch={async () => []}
                    onSearchChange={setNewAffiliationInput}
                    externalOptions={rorSearchOptions ?? []}
                    externalLoading={rorSearchLoading}
                    placeholder="Add affiliation (search ROR)"
                    searchPlaceholder="Search ROR…"
                    minSearchLength={1}
                    emptyMessage="No ROR matches."
                    loadingMessage="Searching ROR…"
                    className="w-full"
                  />
                </div>
                <ui.Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer shrink-0"
                  onClick={() => {
                    const trimmed = newAffiliationInput.trim();
                    if (trimmed) {
                      addAffiliation({ id: uuid(), name: trimmed });
                      setNewAffiliationInput('');
                    }
                  }}
                >
                  Add
                </ui.Button>
              </div>
              {(() => {
                const otherOptions = affiliationList.filter(
                  (a) => !editAffiliationIds.includes(a.id),
                );
                const typed = (newAffiliationInput ?? '').trim();
                const hasTypedNonMatching =
                  typed !== '' &&
                  !otherOptions.some(
                    (a) => (a.name ?? '').trim().toLowerCase() === typed.toLowerCase(),
                  );
                const showAddDetailsPrompt =
                  typed !== '' && (otherOptions.length === 0 || hasTypedNonMatching);

                if (showAddDetailsPrompt) {
                  return (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setExpandAddDetails((e) => !e);
                            if (!expandAddDetails) setAddDetailsName(typed || '');
                          }}
                          className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-muted-foreground bg-background cursor-pointer hover:text-foreground hover:bg-muted/50 border-0 outline-none"
                          aria-expanded={expandAddDetails}
                        >
                          {expandAddDetails ? (
                            <Minus className="w-3 h-3 shrink-0" aria-hidden />
                          ) : (
                            <Plus className="w-3 h-3 shrink-0" aria-hidden />
                          )}
                          <span>Add department or location</span>
                        </button>
                      </div>
                      {expandAddDetails && (
                        <div className="pl-6 space-y-3 border-l-2 border-border">
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">
                              Name
                            </label>
                            <ui.Input
                              type="text"
                              autoComplete="off"
                              value={addDetailsName}
                              onChange={(e) => setAddDetailsName(e.target.value)}
                              placeholder="Affiliation name"
                              className="w-full h-9 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">
                              Department
                            </label>
                            <ui.Input
                              type="text"
                              autoComplete="off"
                              value={addDetailsDepartment}
                              onChange={(e) => setAddDetailsDepartment(e.target.value)}
                              placeholder="Department"
                              className="w-full h-9 text-sm"
                            />
                          </div>
                          <div className="flex gap-2">
                            <div className="flex-1 space-y-1">
                              <label className="text-xs font-medium text-muted-foreground">
                                City
                              </label>
                              <ui.Input
                                type="text"
                                autoComplete="off"
                                value={addDetailsCity}
                                onChange={(e) => setAddDetailsCity(e.target.value)}
                                placeholder="City"
                                className="w-full h-9 text-sm"
                              />
                            </div>
                            <div className="flex-1 space-y-1">
                              <label className="text-xs font-medium text-muted-foreground">
                                Country
                              </label>
                              <ui.Input
                                type="text"
                                autoComplete="off"
                                value={addDetailsCountry}
                                onChange={(e) => setAddDetailsCountry(e.target.value)}
                                placeholder="Country"
                                className="w-full h-9 text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }
                return (
                  <div className="flex flex-wrap gap-1.5">
                    {otherOptions.map((aff) => (
                      <button
                        key={aff.id}
                        type="button"
                        onClick={() => addAffiliation(aff)}
                        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-muted-foreground bg-muted/70 border-0 cursor-pointer hover:text-foreground hover:bg-sky-100"
                      >
                        <Plus className="w-3 h-3 shrink-0" />
                        {aff.name}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        ) : (
          /* View mode */
          <>
            {/* Author name + ORCID badge when valid only (no top-level error indicator) */}
            <div className="flex flex-wrap gap-2 items-center mb-2">
              <span
                className={`text-base font-semibold ${value.name?.trim() ? '' : 'text-muted-foreground/60'}`}
              >
                {value.name?.trim() || 'Author Name'}
              </span>
              {orcidValid === true && value.orcid?.trim() && (
                <a
                  href={
                    value.orcid.trim().startsWith('http')
                      ? value.orcid.trim()
                      : `https://orcid.org/${value.orcid.trim()}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="no-underline cursor-pointer shrink-0"
                  aria-label="View ORCID profile"
                >
                  <BadgeCheck className="w-4 h-4 text-green-500" aria-hidden />
                </a>
              )}
            </div>

            {/* Affiliations: chips when any, or entry box only when none (first creation) */}
            {value.affiliationIds && value.affiliationIds.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {value.affiliationIds.map((affId) => {
                  const affName = getAffiliationName(affiliationList, affId);
                  return (
                    <ui.Badge
                      key={affId}
                      variant="outline-muted"
                      className="flex gap-1 items-center text-xs"
                    >
                      <Building2 className="w-3 h-3" />
                      {affName ? (
                        <span className="truncate max-w-[200px]" title={affName}>
                          {affName}
                        </span>
                      ) : null}
                    </ui.Badge>
                  );
                })}
              </div>
            ) : (
              /* Add affiliation (view mode) – only when author has no affiliations yet */
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div
                    className="relative flex-1 min-w-0"
                    ref={affiliationInputRef as React.RefObject<HTMLDivElement>}
                  >
                    <ui.AsyncComboBox
                      triggerMode="inline"
                      value=""
                      onValueChange={onRorSelectFromCombobox}
                      onSearch={async () => []}
                      onSearchChange={setNewAffiliationInput}
                      externalOptions={rorSearchOptions ?? []}
                      externalLoading={rorSearchLoading}
                      placeholder="Add affiliation (search ROR)"
                      searchPlaceholder="Search ROR…"
                      minSearchLength={1}
                      emptyMessage="No ROR matches."
                      loadingMessage="Searching ROR…"
                      className="w-full"
                    />
                  </div>
                  <ui.Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer shrink-0"
                    onClick={() => {
                      const trimmed = newAffiliationInput.trim();
                      if (trimmed) {
                        addAffiliationInViewMode({ id: uuid(), name: trimmed });
                        setNewAffiliationInput('');
                      }
                    }}
                  >
                    Add
                  </ui.Button>
                </div>
                {(() => {
                  const otherOptions = affiliationList.filter(
                    (a) => !(value.affiliationIds ?? []).includes(a.id),
                  );
                  const typed = (newAffiliationInput ?? '').trim();
                  const hasTypedNonMatching =
                    typed !== '' &&
                    !otherOptions.some(
                      (a) => (a.name ?? '').trim().toLowerCase() === typed.toLowerCase(),
                    );
                  const showAddDetailsPrompt =
                    typed !== '' && (otherOptions.length === 0 || hasTypedNonMatching);

                  if (showAddDetailsPrompt) {
                    return (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setExpandAddDetails((e) => !e);
                              if (!expandAddDetails) setAddDetailsName(typed || '');
                            }}
                            className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-muted-foreground bg-background cursor-pointer hover:text-foreground hover:bg-muted/50 border-0 outline-none"
                            aria-expanded={expandAddDetails}
                          >
                            {expandAddDetails ? (
                              <Minus className="w-3 h-3 shrink-0" aria-hidden />
                            ) : (
                              <Plus className="w-3 h-3 shrink-0" aria-hidden />
                            )}
                            <span>Add department or location</span>
                          </button>
                        </div>
                        {expandAddDetails && (
                          <div className="pl-6 space-y-3 border-l-2 border-border">
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-muted-foreground">
                                Name
                              </label>
                              <ui.Input
                                type="text"
                                autoComplete="off"
                                value={addDetailsName}
                                onChange={(e) => setAddDetailsName(e.target.value)}
                                placeholder="Affiliation name"
                                className="w-full h-9 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-muted-foreground">
                                Department
                              </label>
                              <ui.Input
                                type="text"
                                autoComplete="off"
                                value={addDetailsDepartment}
                                onChange={(e) => setAddDetailsDepartment(e.target.value)}
                                placeholder="Department"
                                className="w-full h-9 text-sm"
                              />
                            </div>
                            <div className="flex gap-2">
                              <div className="flex-1 space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">
                                  City
                                </label>
                                <ui.Input
                                  type="text"
                                  autoComplete="off"
                                  value={addDetailsCity}
                                  onChange={(e) => setAddDetailsCity(e.target.value)}
                                  placeholder="City"
                                  className="w-full h-9 text-sm"
                                />
                              </div>
                              <div className="flex-1 space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">
                                  Country
                                </label>
                                <ui.Input
                                  type="text"
                                  autoComplete="off"
                                  value={addDetailsCountry}
                                  onChange={(e) => setAddDetailsCountry(e.target.value)}
                                  placeholder="Country"
                                  className="w-full h-9 text-sm"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div className="flex flex-wrap gap-1.5">
                      {otherOptions.map((aff) => (
                        <button
                          key={aff.id}
                          type="button"
                          onClick={() => addAffiliationInViewMode(aff)}
                          className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-muted-foreground bg-muted/70 border-0 cursor-pointer hover:text-foreground hover:bg-sky-100"
                        >
                          <Plus className="w-3 h-3 shrink-0" />
                          {aff.name}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </>
        )}
      </div>

      {/* Collapse/Edit and Delete: when expanded show collapse caret; when collapsed show pencil */}
      <div className="flex gap-1 items-start shrink-0">
        {open ? (
          <ui.Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => onOpenChange(false)}
            aria-label="Collapse"
            className="cursor-pointer"
          >
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          </ui.Button>
        ) : (
          <ui.Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => onOpenChange(true)}
            aria-label="Edit author"
            className="cursor-pointer"
          >
            <Pencil className="w-4 h-4 text-muted-foreground" />
          </ui.Button>
        )}
        <ui.Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onDelete}
          aria-label="Delete author"
          className="cursor-pointer"
        >
          <Trash2 className="w-4 h-4 text-muted-foreground" />
        </ui.Button>
      </div>
    </div>
  );
}

type OrcidSearchHit = {
  orcid: string;
  name: string;
  firstAffiliation?: string;
  email?: string;
};

type RorSearchHit = {
  name: string;
  ror: string;
  city?: string;
  country?: string;
};

type AddAuthorPlaceholderCardProps = {
  orcidSearchExternalOptions?: { value: string; label: string; description?: string }[];
  orcidSearchLoading?: boolean;
  onAuthorSelect: (orcid: string) => void;
  onSearchChange: (query: string) => void;
  addAuthorSearchValue: string;
  handleAddAuthor: () => void;
  orcidFetcher: { state: string };
  addMeAsAuthor: () => void;
  contactDetails: ContactDetailsForAuthor | null | undefined;
  isEmpty: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
};

function AddAuthorPlaceholderCard({
  orcidSearchExternalOptions,
  orcidSearchLoading,
  onAuthorSelect,
  onSearchChange,
  addAuthorSearchValue,
  handleAddAuthor,
  orcidFetcher,
  addMeAsAuthor,
  contactDetails,
  isEmpty,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: AddAuthorPlaceholderCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ADD_AUTHOR_PLACEHOLDER_ID,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex gap-3 items-start p-4 rounded-sm border bg-background ${
        isDragging ? 'shadow-lg border-primary border-dashed' : 'border-dashed border-border'
      }`}
    >
      <div className="flex flex-col gap-0.5 items-center pt-1 shrink-0">
        {onMoveUp != null && (
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="p-0.5 rounded touch-manipulation cursor-pointer disabled:opacity-30 disabled:pointer-events-none disabled:cursor-default text-muted-foreground hover:text-foreground"
            aria-label="Move up"
          >
            <ChevronUp className="w-4 h-4" />
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
            <ChevronDown className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="flex-1 space-y-2 min-w-0">
        {isEmpty && contactDetails && (
          <div className="flex flex-wrap gap-2 items-center">
            <ui.Button
              type="button"
              variant="default"
              onClick={addMeAsAuthor}
              className="cursor-pointer w-fit"
            >
              Add me as an author
            </ui.Button>
            <span className="text-sm text-muted-foreground">or</span>
          </div>
        )}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1 min-w-0">
            <ui.AsyncComboBox
              triggerMode="inline"
              value=""
              onValueChange={onAuthorSelect}
              onSearch={async () => []}
              onSearchChange={onSearchChange}
              externalOptions={orcidSearchExternalOptions ?? []}
              externalLoading={orcidSearchLoading}
              placeholder="Name or ORCID (e.g. 0000-0002-1825-0097)"
              searchPlaceholder="Search ORCID…"
              minSearchLength={1}
              emptyMessage="No ORCID matches."
              loadingMessage="Searching ORCID…"
              className="w-full"
            />
          </div>
          <ui.Button
            type="button"
            onClick={handleAddAuthor}
            disabled={!addAuthorSearchValue.trim() || orcidFetcher.state !== 'idle'}
            className="cursor-pointer shrink-0"
          >
            {orcidFetcher.state !== 'idle' ? (
              'Looking up…'
            ) : (
              <>
                Add Author
                <CornerDownLeft className="w-4 h-4" aria-hidden />
              </>
            )}
          </ui.Button>
        </div>
        {!isEmpty && contactDetails && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={addMeAsAuthor}
              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-muted-foreground bg-background cursor-pointer hover:text-foreground hover:bg-muted/50 border-0 outline-none"
            >
              <Plus className="w-3 h-3 shrink-0" aria-hidden />
              <span>Add me as an author</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

type ContactDetailsForAuthor = {
  name: string;
  email: string;
  orcidId: string;
  nameReadOnly: boolean;
  emailReadOnly: boolean;
  orcidReadOnly: boolean;
};

type AuthorFieldProps = {
  schema: AuthorOption;
  value: Author[];
  onChange: (value: Author[]) => void;
  affiliationList?: Affiliation[];
  onAffiliationListChange?: (list: Affiliation[]) => void;
  draftObjectId?: string | null;
  onDraftCreated?: (id: string) => void;
  /** When set (e.g. from review error link query), expand this author card (0-based index) on load. */
  initialOpenAuthorIndex?: number;
  /** When set (e.g. from review error link query), expand this affiliation (0-based index in list) on load. */
  initialOpenAffiliationIndex?: number;
  /** When set, show "Add me as author" button/link that adds an author with these contact details. */
  contactDetails?: ContactDetailsForAuthor;
};

export function AuthorField({
  schema,
  value = [],
  onChange,
  affiliationList: affiliationListProp = [],
  onAffiliationListChange,
  draftObjectId = null,
  onDraftCreated,
  initialOpenAuthorIndex,
  initialOpenAffiliationIndex,
  contactDetails,
}: AuthorFieldProps) {
  const [addAuthorSearchValue, setAddAuthorSearchValue] = useState('');
  const lastOrcidResultsRef = useRef<OrcidSearchHit[]>([]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [activeAuthorId, setActiveAuthorId] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [openAffiliationId, setOpenAffiliationId] = useState<string | null>(null);
  const lastCardAffiliationInputRef = useRef<HTMLInputElement>(null);
  const authorCountRef = useRef(value.length);
  const valueRef = useRef(value);
  valueRef.current = value;
  const pendingOrcidRef = useRef<string | null>(null);
  const addMeOrcidAuthorIdRef = useRef<string | null>(null);
  const suggestionOrcidAuthorIdRef = useRef<string | null>(null);
  const lastSubmittedOrcidQRef = useRef('');
  const orcidFetcher = useFetcher();
  const orcidSearchFetcher = useFetcher();
  const affiliationList = affiliationListProp ?? [];

  useEffect(() => {
    const trimmed = addAuthorSearchValue.trim();
    if (!trimmed || isValidOrcid(trimmed)) return;
    const t = setTimeout(() => {
      lastSubmittedOrcidQRef.current = trimmed;
      const fd = new FormData();
      fd.set('intent', 'search-orcid');
      fd.set('q', trimmed);
      orcidSearchFetcher.submit(fd, { method: 'POST' });
    }, 300);
    return () => clearTimeout(t);
  }, [addAuthorSearchValue]);

  const orcidSearchOptions = (() => {
    if (orcidSearchFetcher.state !== 'idle' || !orcidSearchFetcher.data) return undefined;
    const currentQ = addAuthorSearchValue.trim();
    if (currentQ !== lastSubmittedOrcidQRef.current) return undefined;
    const data = orcidSearchFetcher.data as { results?: OrcidSearchHit[] };
    const results = data?.results ?? [];
    lastOrcidResultsRef.current = results;
    return results.map((r) => ({
      value: r.orcid,
      label: r.name,
      description: r.firstAffiliation,
    }));
  })();
  const orcidSearchLoading = orcidSearchFetcher.state !== 'idle';

  const authorErrors = getAuthorFieldErrors(value);
  const isValid = value.length > 0 && authorErrors.length === 0;

  const [authorOrder, setAuthorOrder] = useState<(string | typeof ADD_AUTHOR_PLACEHOLDER_ID)[]>(
    () => [...value.map((a) => a.id), ADD_AUTHOR_PLACEHOLDER_ID],
  );

  // Sync authorOrder when value's author set changes (add/remove), keep placeholder position otherwise
  useEffect(() => {
    const ids = value.map((a) => a.id);
    setAuthorOrder((prev) => {
      const prevIds = prev.filter((id): id is string => id !== ADD_AUTHOR_PLACEHOLDER_ID);
      if (prevIds.length !== ids.length || prevIds.some((id, i) => id !== ids[i]))
        return [...ids, ADD_AUTHOR_PLACEHOLDER_ID];
      return prev;
    });
  }, [value]);

  const insertIndexRef = useRef(0);
  useEffect(() => {
    insertIndexRef.current = authorOrder.indexOf(ADD_AUTHOR_PLACEHOLDER_ID);
  }, [authorOrder]);

  const insertAuthorAt = (idx: number, newAuthor: Author) => {
    const current = valueRef.current;
    const i = idx < 0 ? current.length : Math.min(idx, current.length);
    const newAuthors = [...current.slice(0, i), newAuthor, ...current.slice(i)];
    handleChange(newAuthors);
    setAuthorOrder([...newAuthors.map((a) => a.id), ADD_AUTHOR_PLACEHOLDER_ID]);
  };

  const insertAtPlaceholder = (newAuthor: Author) => {
    insertAuthorAt(authorOrder.indexOf(ADD_AUTHOR_PLACEHOLDER_ID), newAuthor);
  };

  const addMeAsAuthor = () => {
    if (!contactDetails) return;
    const newAuthor: Author = {
      id: uuid(),
      name: contactDetails.name || 'Author',
      email: contactDetails.email || undefined,
      orcid: contactDetails.orcidId || undefined,
      affiliationIds: [],
    };
    insertAtPlaceholder(newAuthor);
    if (
      contactDetails.orcidId &&
      isValidOrcid(contactDetails.orcidId) &&
      orcidFetcher.state === 'idle'
    ) {
      addMeOrcidAuthorIdRef.current = newAuthor.id;
      const fd = new FormData();
      fd.set('intent', 'fetch-orcid');
      fd.set('orcid', contactDetails.orcidId);
      orcidFetcher.submit(fd, { method: 'POST' });
    }
  };

  // Expand author/affiliation from review error link query params (one-time on load)
  const initialExpandAppliedRef = useRef({ author: false, affiliation: false });
  useEffect(() => {
    if (
      initialExpandAppliedRef.current.author ||
      initialOpenAuthorIndex == null ||
      initialOpenAuthorIndex < 0 ||
      initialOpenAuthorIndex >= value.length
    )
      return;
    initialExpandAppliedRef.current.author = true;
    setOpenIndex(initialOpenAuthorIndex);
  }, [initialOpenAuthorIndex, value.length]);

  useEffect(() => {
    if (
      initialExpandAppliedRef.current.affiliation ||
      initialOpenAffiliationIndex == null ||
      initialOpenAffiliationIndex < 0 ||
      !affiliationList[initialOpenAffiliationIndex]
    )
      return;
    initialExpandAppliedRef.current.affiliation = true;
    setAdvancedOpen(true);
    setOpenAffiliationId(affiliationList[initialOpenAffiliationIndex].id);
  }, [initialOpenAffiliationIndex, affiliationList]);

  // When a new author is added, focus that card's affiliation input
  useEffect(() => {
    if (value.length > authorCountRef.current) {
      lastCardAffiliationInputRef.current?.focus();
    }
    authorCountRef.current = value.length;
  }, [value.length]);
  const save = useSaveField(draftObjectId ?? null, schema.name, onDraftCreated);

  const handleChange = (newAuthors: Author[]) => {
    onChange(newAuthors);
    save(newAuthors);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveAuthorId(event.active.id as string);
  };

  const activePlaceholderOverlay =
    activeAuthorId === ADD_AUTHOR_PLACEHOLDER_ID ? (
      <div
        className="flex gap-3 items-center p-4 w-72 rounded-sm border border-dashed shadow-lg border-border bg-background cursor-grabbing"
        style={{ minHeight: 56 }}
      >
        <GripVertical className="w-4 h-4 text-muted-foreground/50 shrink-0" />
        <span className="flex-1 min-w-0 text-base truncate text-muted-foreground">Add author</span>
      </div>
    ) : null;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveAuthorId(null);
    if (!over || active.id === over.id) return;
    const oldIndex = authorOrder.indexOf(active.id as string);
    const newIndex = authorOrder.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = [...authorOrder];
    const [moved] = newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, moved);
    setAuthorOrder(newOrder);

    if (moved !== ADD_AUTHOR_PLACEHOLDER_ID) {
      const newValue = newOrder
        .filter((id): id is string => id !== ADD_AUTHOR_PLACEHOLDER_ID)
        .map((id) => value.find((a) => a.id === id))
        .filter((a): a is Author => a != null);
      handleChange(newValue);
      const oldValueIndex = value.findIndex((a) => a.id === moved);
      const newValueIndex = newValue.findIndex((a) => a.id === moved);
      if (openIndex === oldValueIndex) {
        setOpenIndex(newValueIndex);
      } else if (openIndex !== null) {
        if (oldValueIndex < openIndex && newValueIndex >= openIndex) {
          setOpenIndex(openIndex - 1);
        } else if (oldValueIndex > openIndex && newValueIndex <= openIndex) {
          setOpenIndex(openIndex + 1);
        }
      }
    }
  };

  const handleMoveAuthorOrderItem = (itemId: string, direction: 'up' | 'down') => {
    const oldIndex = authorOrder.indexOf(itemId);
    if (oldIndex === -1) return;
    const newIndex = direction === 'up' ? oldIndex - 1 : oldIndex + 1;
    if (newIndex < 0 || newIndex >= authorOrder.length) return;
    const newOrder = [...authorOrder];
    [newOrder[oldIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[oldIndex]];
    setAuthorOrder(newOrder);

    const newValue = newOrder
      .filter((id): id is string => id !== ADD_AUTHOR_PLACEHOLDER_ID)
      .map((id) => value.find((a) => a.id === id))
      .filter((a): a is Author => a != null);
    const prevIds = value.map((a) => a.id);
    const nextIds = newValue.map((a) => a.id);
    const sameAuthorOrder =
      prevIds.length === nextIds.length && prevIds.every((id, i) => id === nextIds[i]);
    if (!sameAuthorOrder) {
      handleChange(newValue);
      if (openIndex != null) {
        const openId = value[openIndex]?.id;
        const nextOpenIndex = openId ? newValue.findIndex((a) => a.id === openId) : -1;
        setOpenIndex(nextOpenIndex === -1 ? null : nextOpenIndex);
      }
    }
  };

  // When ORCID lookup returns: merge into "Add me" author (if addMeOrcidAuthorIdRef set) or add new author (typed ORCID)
  useEffect(() => {
    if (orcidFetcher.state !== 'idle' || !orcidFetcher.data) return;
    const data = orcidFetcher.data as {
      name?: string;
      orcid?: string;
      email?: string;
      affiliations?: {
        name: string;
        city?: string;
        region?: string;
        country?: string;
        ror?: string;
      }[];
      error?: { message?: string };
    };

    // Merge into author we just added via "Add me as author" (ORCID lookup for contact)
    if (addMeOrcidAuthorIdRef.current) {
      const targetId = addMeOrcidAuthorIdRef.current;
      addMeOrcidAuthorIdRef.current = null;
      if (data?.error) return;
      const currentAuthors = valueRef.current;
      const idx = currentAuthors.findIndex((a) => a.id === targetId);
      if (idx === -1) return;
      const author = currentAuthors[idx];
      const nameFromOrcid =
        data?.name && data?.orcid ? String(data.name).trim() || undefined : undefined;
      const emailFromOrcid = data?.orcid && data?.email?.trim() ? data.email?.trim() : undefined;
      const affiliationsFromOrcid = Array.isArray(data?.affiliations) ? data.affiliations : [];
      let nextList = [...affiliationList];
      let listModified = false;
      const newAffiliationIds: string[] = [...(author.affiliationIds ?? [])];
      for (const aff of affiliationsFromOrcid) {
        const trimmed = String(aff?.name ?? '').trim();
        if (!trimmed) continue;
        const existingExact = nextList.find(
          (a) =>
            (a.name ?? '').trim().toLowerCase() === trimmed.toLowerCase() &&
            (a.city ?? '') === (aff?.city ?? '') &&
            (a.country ?? '') === (aff?.country ?? ''),
        );
        const existing =
          existingExact ||
          nextList.find((a) => (a.name ?? '').trim().toLowerCase() === trimmed.toLowerCase());
        if (existing) {
          if (!newAffiliationIds.includes(existing.id)) newAffiliationIds.push(existing.id);
          if (aff?.ror && !(existing.ror ?? '').trim()) {
            nextList = nextList.map((a) => (a.id === existing.id ? { ...a, ror: aff.ror } : a));
            listModified = true;
          }
        } else {
          const newAff: Affiliation = {
            id: uuid(),
            name: trimmed,
            ...(aff?.city && { city: aff.city }),
            ...(aff?.country && { country: aff.country }),
            ...(aff?.ror && { ror: aff.ror }),
          };
          nextList = [...nextList, newAff];
          newAffiliationIds.push(newAff.id);
          listModified = true;
        }
      }
      if (listModified) onAffiliationListChange?.(nextList);
      const updates: Partial<Author> = {};
      if (nameFromOrcid && (!(author.name ?? '').trim() || author.name === 'Author'))
        updates.name = nameFromOrcid;
      if (emailFromOrcid && !(author.email ?? '').trim()) updates.email = emailFromOrcid;
      if (newAffiliationIds.length > 0) updates.affiliationIds = newAffiliationIds;
      if (Object.keys(updates).length > 0) {
        const next = currentAuthors.map((a, i) => (i === idx ? { ...a, ...updates } : a));
        handleChange(next);
      }
      return;
    }

    // Merge into author we just added from ORCID search dropdown (enrich with full fetch-orcid response)
    if (suggestionOrcidAuthorIdRef.current) {
      const targetId = suggestionOrcidAuthorIdRef.current;
      suggestionOrcidAuthorIdRef.current = null;
      if (data?.error) return;
      const currentAuthors = valueRef.current;
      const idx = currentAuthors.findIndex((a) => a.id === targetId);
      if (idx === -1) return;
      const author = currentAuthors[idx];
      const nameFromOrcid =
        data?.name && data?.orcid ? String(data.name).trim() || undefined : undefined;
      const emailFromOrcid = data?.orcid && data?.email?.trim() ? data.email?.trim() : undefined;
      const affiliationsFromOrcid = Array.isArray(data?.affiliations) ? data.affiliations : [];
      let nextList = [...affiliationList];
      let listModified = false;
      const newAffiliationIds: string[] = [...(author.affiliationIds ?? [])];
      for (const aff of affiliationsFromOrcid) {
        const trimmed = String(aff?.name ?? '').trim();
        if (!trimmed) continue;
        const existingExact = nextList.find(
          (a) =>
            (a.name ?? '').trim().toLowerCase() === trimmed.toLowerCase() &&
            (a.city ?? '') === (aff?.city ?? '') &&
            (a.country ?? '') === (aff?.country ?? ''),
        );
        const existing =
          existingExact ||
          nextList.find((a) => (a.name ?? '').trim().toLowerCase() === trimmed.toLowerCase());
        if (existing) {
          if (!newAffiliationIds.includes(existing.id)) newAffiliationIds.push(existing.id);
          if (aff?.ror && !(existing.ror ?? '').trim()) {
            nextList = nextList.map((a) => (a.id === existing.id ? { ...a, ror: aff.ror } : a));
            listModified = true;
          }
        } else {
          const newAff: Affiliation = {
            id: uuid(),
            name: trimmed,
            ...(aff?.city && { city: aff.city }),
            ...(aff?.country && { country: aff.country }),
            ...(aff?.ror && { ror: aff.ror }),
          };
          nextList = [...nextList, newAff];
          newAffiliationIds.push(newAff.id);
          listModified = true;
        }
      }
      if (listModified) onAffiliationListChange?.(nextList);
      const updates: Partial<Author> = {};
      if (nameFromOrcid && (!(author.name ?? '').trim() || author.name === 'Author'))
        updates.name = nameFromOrcid;
      if (emailFromOrcid && !(author.email ?? '').trim()) updates.email = emailFromOrcid;
      if (newAffiliationIds.length > 0) updates.affiliationIds = newAffiliationIds;
      if (Object.keys(updates).length > 0) {
        const next = currentAuthors.map((a, i) => (i === idx ? { ...a, ...updates } : a));
        handleChange(next);
      }
      return;
    }

    // Add new author (user typed ORCID in add-author box)
    if (!pendingOrcidRef.current) return;
    const orcid = pendingOrcidRef.current;
    pendingOrcidRef.current = null;
    const name =
      data?.error || !data?.name || !data?.orcid ? orcid : String(data.name).trim() || orcid;
    const email =
      data?.error || !data?.orcid ? undefined : (data.email?.trim() && data.email) || undefined;
    const affiliationsFromOrcid = Array.isArray(data?.affiliations) ? data.affiliations : [];
    let nextList = [...affiliationList];
    let listModified = false;
    const affiliationIds: string[] = [];
    for (const aff of affiliationsFromOrcid) {
      const trimmed = String(aff?.name ?? '').trim();
      if (!trimmed) continue;
      const existingExact = nextList.find(
        (a) =>
          (a.name ?? '').trim().toLowerCase() === trimmed.toLowerCase() &&
          (a.city ?? '') === (aff?.city ?? '') &&
          (a.country ?? '') === (aff?.country ?? ''),
      );
      const existing =
        existingExact ||
        nextList.find((a) => (a.name ?? '').trim().toLowerCase() === trimmed.toLowerCase());
      if (existing) {
        affiliationIds.push(existing.id);
        if (aff?.ror && !(existing.ror ?? '').trim()) {
          nextList = nextList.map((a) => (a.id === existing.id ? { ...a, ror: aff.ror } : a));
          listModified = true;
        }
      } else {
        const newAff: Affiliation = {
          id: uuid(),
          name: trimmed,
          ...(aff?.city && { city: aff.city }),
          ...(aff?.country && { country: aff.country }),
          ...(aff?.ror && { ror: aff.ror }),
        };
        nextList = [...nextList, newAff];
        affiliationIds.push(newAff.id);
        listModified = true;
      }
    }
    if (listModified) onAffiliationListChange?.(nextList);
    const newAuthor: Author = {
      id: uuid(),
      name,
      orcid: data?.orcid ?? orcid,
      ...(email && { email }),
      affiliationIds,
    };
    const idx = insertIndexRef.current < 0 ? valueRef.current.length : insertIndexRef.current;
    insertAuthorAt(idx, newAuthor);
    setAddAuthorSearchValue('');
  }, [orcidFetcher.state, orcidFetcher.data, affiliationList, onAffiliationListChange]);

  const onSelectOrcidSuggestion = (hit: OrcidSearchHit) => {
    setAddAuthorSearchValue('');
    let affiliationIds: string[] = [];
    let nextList = [...affiliationList];
    if (hit.firstAffiliation?.trim()) {
      const trimmed = hit.firstAffiliation.trim();
      const existing = nextList.find(
        (a) => (a.name ?? '').trim().toLowerCase() === trimmed.toLowerCase(),
      );
      if (existing) {
        affiliationIds = [existing.id];
      } else {
        const newAff: Affiliation = { id: uuid(), name: trimmed };
        nextList = [...nextList, newAff];
        affiliationIds = [newAff.id];
      }
      if (nextList.length > affiliationList.length) onAffiliationListChange?.(nextList);
    }
    const newAuthor: Author = {
      id: uuid(),
      name: hit.name.trim() || hit.orcid,
      orcid: hit.orcid,
      ...(hit.email?.trim() && { email: hit.email.trim() }),
      affiliationIds,
    };
    insertAtPlaceholder(newAuthor);
    suggestionOrcidAuthorIdRef.current = newAuthor.id;
    const fd = new FormData();
    fd.set('intent', 'fetch-orcid');
    fd.set('orcid', hit.orcid);
    orcidFetcher.submit(fd, { method: 'POST' });
  };

  const onAuthorSelectFromCombobox = (orcid: string) => {
    const hit = lastOrcidResultsRef.current.find((r) => r.orcid === orcid);
    if (hit) {
      onSelectOrcidSuggestion(hit);
      setAddAuthorSearchValue('');
    }
  };

  const handleAddAuthor = () => {
    const trimmed = addAuthorSearchValue.trim();
    if (!trimmed) return;
    if (isValidOrcid(trimmed)) {
      pendingOrcidRef.current = trimmed;
      const fd = new FormData();
      fd.set('intent', 'fetch-orcid');
      fd.set('orcid', trimmed);
      orcidFetcher.submit(fd, { method: 'POST' });
      return;
    }
    const newAuthor: Author = {
      id: uuid(),
      name: trimmed,
      affiliationIds: [],
    };
    insertAtPlaceholder(newAuthor);
    setAddAuthorSearchValue('');
  };

  const handleEnsureAffiliationInList = (aff: Affiliation) => {
    if (affiliationList.some((a) => a.id === aff.id)) return;
    onAffiliationListChange?.([...affiliationList, aff]);
  };

  const handleRenameAffiliation = (affiliationId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const newList = affiliationList.map((a) =>
      a.id === affiliationId ? { ...a, name: trimmed } : a,
    );
    onAffiliationListChange?.(newList);
  };

  const handleUpdateAffiliation = (affiliationId: string, updates: Partial<Affiliation>) => {
    const newList = affiliationList.map((a) => (a.id === affiliationId ? { ...a, ...updates } : a));
    onAffiliationListChange?.(newList);
  };

  const handleRemoveAffiliationFromList = (affiliationId: string) => {
    onAffiliationListChange?.(affiliationList.filter((a) => a.id !== affiliationId));
    const newAuthors = value.map((author) => ({
      ...author,
      affiliationIds: (author.affiliationIds ?? []).filter((id) => id !== affiliationId),
    }));
    handleChange(newAuthors);
  };

  const [addAffiliationInput, setAddAffiliationInput] = useState('');
  const lastAddAffiliationRorResultsRef = useRef<RorSearchHit[]>([]);
  const lastSubmittedAddAffiliationRorQRef = useRef('');
  const addAffiliationRorFetcher = useFetcher();

  useEffect(() => {
    const trimmed = addAffiliationInput.trim();
    if (!trimmed) return;
    const t = setTimeout(() => {
      lastSubmittedAddAffiliationRorQRef.current = trimmed;
      const fd = new FormData();
      fd.set('intent', 'search-ror');
      fd.set('q', trimmed);
      addAffiliationRorFetcher.submit(fd, { method: 'POST' });
    }, 300);
    return () => clearTimeout(t);
  }, [addAffiliationInput]);

  const addAffiliationRorOptions = (() => {
    const hasRorResults =
      addAffiliationRorFetcher.state === 'idle' && addAffiliationRorFetcher.data;
    if (!hasRorResults) return undefined;
    const currentQ = addAffiliationInput.trim();
    if (currentQ !== lastSubmittedAddAffiliationRorQRef.current) return undefined;
    const data = addAffiliationRorFetcher.data as { results?: RorSearchHit[] };
    const results = data?.results ?? [];
    lastAddAffiliationRorResultsRef.current = results;
    return results.map((r) => ({
      value: r.ror,
      label: r.name,
      description: [r.city, r.country].filter(Boolean).join(', ') || undefined,
    }));
  })();
  const addAffiliationRorLoading = addAffiliationRorFetcher.state !== 'idle';

  const onSelectAddAffiliationRor = (hit: RorSearchHit) => {
    const aff: Affiliation = {
      id: uuid(),
      name: hit.name,
      ror: hit.ror,
      ...(hit.city && { city: hit.city }),
      ...(hit.country && { country: hit.country }),
    };
    onAffiliationListChange?.([...affiliationList, aff]);
    setAddAffiliationInput('');
  };

  const onSelectAddAffiliationRorFromCombobox = (ror: string) => {
    const hit = lastAddAffiliationRorResultsRef.current.find((r) => r.ror === ror);
    if (hit) onSelectAddAffiliationRor(hit);
  };

  const handleAddAffiliationFromBox = () => {
    const trimmed = addAffiliationInput.trim();
    if (!trimmed) return;
    const aff: Affiliation = { id: uuid(), name: trimmed };
    onAffiliationListChange?.([...affiliationList, aff]);
    setAddAffiliationInput('');
  };

  const handleAuthorChange = (index: number, updatedAuthor: Author) => {
    const newAuthors = [...value];
    newAuthors[index] = updatedAuthor;
    handleChange(newAuthors);
  };

  const handleDelete = (index: number) => {
    const newAuthors = value.filter((_, i) => i !== index);
    handleChange(newAuthors);
    setAuthorOrder([...newAuthors.map((a) => a.id), ADD_AUTHOR_PLACEHOLDER_ID]);
    if (openIndex === index) {
      setOpenIndex(null);
    } else if (openIndex !== null && openIndex > index) {
      setOpenIndex(openIndex - 1);
    }
  };

  const activeAuthor = activeAuthorId ? value.find((a) => a.id === activeAuthorId) : null;
  const activeAuthorOverlay =
    activeAuthor && activeAuthorId ? (
      <div
        className="flex gap-3 items-center p-4 w-72 rounded-sm border shadow-lg border-border bg-background cursor-grabbing"
        style={{ minHeight: 56 }}
      >
        <GripVertical className="w-4 h-4 text-muted-foreground/50 shrink-0" />
        <span className="text-xs tabular-nums shrink-0 text-muted-foreground">
          {getOrdinalLabel(value.findIndex((a) => a.id === activeAuthorId) + 1)}
        </span>
        <span
          className={`flex-1 min-w-0 truncate text-base font-semibold ${
            (activeAuthor.name ?? '').trim() ? '' : 'text-muted-foreground/60'
          }`}
        >
          {(activeAuthor.name ?? '').trim() || 'Author Name'}
        </span>
        {activeAuthor.orcid && isValidOrcid(activeAuthor.orcid) && (
          <a
            href={
              activeAuthor.orcid.startsWith('http')
                ? activeAuthor.orcid
                : `https://orcid.org/${activeAuthor.orcid}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="no-underline cursor-pointer shrink-0"
            aria-label="View ORCID profile"
            onClick={(e) => e.stopPropagation()}
          >
            <BadgeCheck className="w-4 h-4 text-green-500" aria-hidden />
          </a>
        )}
      </div>
    ) : null;

  return (
    <div className="space-y-4">
      <FormLabel htmlFor={schema.name} required={schema.required} valid={isValid}>
        {schema.title}
      </FormLabel>

      <div className="space-y-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={authorOrder} strategy={verticalListSortingStrategy}>
            {authorOrder.map((id, orderIndex) => {
              if (id === ADD_AUTHOR_PLACEHOLDER_ID) {
                return (
                  <AddAuthorPlaceholderCard
                    key={ADD_AUTHOR_PLACEHOLDER_ID}
                    orcidSearchExternalOptions={orcidSearchOptions ?? []}
                    orcidSearchLoading={orcidSearchLoading}
                    onAuthorSelect={onAuthorSelectFromCombobox}
                    onSearchChange={setAddAuthorSearchValue}
                    addAuthorSearchValue={addAuthorSearchValue}
                    handleAddAuthor={handleAddAuthor}
                    orcidFetcher={orcidFetcher}
                    addMeAsAuthor={addMeAsAuthor}
                    contactDetails={contactDetails}
                    isEmpty={value.length === 0}
                    onMoveUp={() => handleMoveAuthorOrderItem(ADD_AUTHOR_PLACEHOLDER_ID, 'up')}
                    onMoveDown={() => handleMoveAuthorOrderItem(ADD_AUTHOR_PLACEHOLDER_ID, 'down')}
                    canMoveUp={orderIndex > 0}
                    canMoveDown={orderIndex < authorOrder.length - 1}
                  />
                );
              }
              const author = value.find((a) => a.id === id);
              if (!author) return null;
              const index = value.findIndex((a) => a.id === id);
              return (
                <AuthorCard
                  key={author.id}
                  value={author}
                  index={index}
                  open={openIndex === index}
                  onOpenChange={(open) => setOpenIndex(open ? index : null)}
                  onChange={(updatedAuthor) => handleAuthorChange(index, updatedAuthor)}
                  onDelete={() => handleDelete(index)}
                  affiliationList={affiliationList}
                  onEnsureAffiliationInList={handleEnsureAffiliationInList}
                  onRenameAffiliation={handleRenameAffiliation}
                  onUpdateAffiliation={handleUpdateAffiliation}
                  affiliationInputRef={
                    index === value.length - 1 ? lastCardAffiliationInputRef : undefined
                  }
                  onMoveUp={() => handleMoveAuthorOrderItem(author.id, 'up')}
                  onMoveDown={() => handleMoveAuthorOrderItem(author.id, 'down')}
                  canMoveUp={orderIndex > 0}
                  canMoveDown={orderIndex < authorOrder.length - 1}
                />
              );
            })}
          </SortableContext>
          <DragOverlay dropAnimation={null}>
            {activePlaceholderOverlay ?? activeAuthorOverlay}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Advanced options: affiliations list + Add Affiliation box */}
      <div className="mt-6">
        <button
          type="button"
          onClick={() => setAdvancedOpen((open) => !open)}
          className="flex gap-2 items-center p-0 text-sm bg-transparent border-0 cursor-pointer text-muted-foreground hover:text-foreground"
          aria-expanded={advancedOpen}
        >
          {advancedOpen ? (
            <Minus className="w-4 h-4 shrink-0" aria-hidden />
          ) : (
            <Plus className="w-4 h-4 shrink-0" aria-hidden />
          )}
          <span>Advanced options</span>
        </button>
        {advancedOpen && (
          <div className="mt-3 space-y-2">
            <p className="text-sm font-medium text-foreground">Affiliations</p>
            {affiliationList.length > 0 ? (
              <ul className="space-y-2">
                {affiliationList.map((aff) => {
                  const authorCount = value.filter((a) =>
                    (a.affiliationIds ?? []).includes(aff.id),
                  ).length;
                  return (
                    <AffiliationListItem
                      key={aff.id}
                      affiliation={aff}
                      authorCount={authorCount}
                      open={openAffiliationId === aff.id}
                      onOpenChange={(open) => setOpenAffiliationId(open ? aff.id : null)}
                      onUpdate={(updates) => handleUpdateAffiliation(aff.id, updates)}
                      onRemove={() => handleRemoveAffiliationFromList(aff.id)}
                    />
                  );
                })}
              </ul>
            ) : null}
            <div className="flex gap-2 items-center p-4 rounded-sm border border-dashed border-border bg-background">
              <div className="relative flex-1 min-w-0">
                <ui.AsyncComboBox
                  triggerMode="inline"
                  value=""
                  onValueChange={onSelectAddAffiliationRorFromCombobox}
                  onSearch={async () => []}
                  onSearchChange={setAddAffiliationInput}
                  externalOptions={addAffiliationRorOptions ?? []}
                  externalLoading={addAffiliationRorLoading}
                  placeholder="Affiliation name (search ROR)"
                  searchPlaceholder="Search ROR…"
                  minSearchLength={1}
                  emptyMessage="No ROR matches."
                  loadingMessage="Searching ROR…"
                  className="w-full"
                />
              </div>
              <ui.Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddAffiliationFromBox}
                disabled={!addAffiliationInput.trim()}
                className="cursor-pointer shrink-0"
              >
                <>
                  Add Affiliation
                  <CornerDownLeft className="w-4 h-4 shrink-0" aria-hidden />
                </>
              </ui.Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type AffiliationListItemProps = {
  affiliation: Affiliation;
  authorCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (updates: Partial<Affiliation>) => void;
  onRemove: () => void;
};

function AffiliationListItem({
  affiliation,
  authorCount,
  open,
  onOpenChange,
  onUpdate,
  onRemove,
}: AffiliationListItemProps) {
  const [editName, setEditName] = useState(affiliation.name ?? '');
  const [editDepartment, setEditDepartment] = useState(affiliation.department ?? '');
  const [editCity, setEditCity] = useState(affiliation.city ?? '');
  const [editCountry, setEditCountry] = useState(affiliation.country ?? '');

  useEffect(() => {
    setEditName(affiliation.name ?? '');
    setEditDepartment(affiliation.department ?? '');
    setEditCity(affiliation.city ?? '');
    setEditCountry(affiliation.country ?? '');
  }, [affiliation]);

  const saveName = () => {
    const trimmed = (editName ?? '').trim();
    const current = (affiliation.name ?? '').trim();
    if (trimmed !== current) onUpdate({ name: trimmed || undefined });
  };
  const saveDepartment = () => {
    const trimmed = (editDepartment ?? '').trim();
    if (trimmed !== (affiliation.department ?? '').trim()) {
      onUpdate({ department: trimmed || undefined });
    }
  };
  const saveCity = () => {
    const trimmed = (editCity ?? '').trim();
    if (trimmed !== (affiliation.city ?? '').trim()) onUpdate({ city: trimmed || undefined });
  };
  const saveCountry = () => {
    const trimmed = (editCountry ?? '').trim();
    if (trimmed !== (affiliation.country ?? '').trim()) onUpdate({ country: trimmed || undefined });
  };

  const nameDisplay = (editName ?? '').trim();
  const nameValid = nameDisplay.length > 0;
  const deptDisplay = (editDepartment ?? '').trim();
  const cityDisplay = (editCity ?? '').trim();
  const countryDisplay = (editCountry ?? '').trim();

  return (
    <li className="flex gap-2 items-start p-4 rounded-sm border border-border bg-background">
      <div className="flex-1 min-w-0">
        {/* Top bar: same when collapsed and expanded */}
        <div className="flex flex-wrap gap-2 items-center mb-2">
          <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex flex-1 gap-1 items-center min-w-0">
            <span
              className={`text-base font-semibold min-w-0 truncate ${
                !nameValid ? 'text-muted-foreground/60' : ''
              }`}
            >
              {nameDisplay || 'Affiliation name'}
            </span>
            {(affiliation.ror ?? '').trim() && (
              <a
                href={affiliation.ror!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex no-underline cursor-pointer shrink-0"
                title={affiliation.ror}
                aria-label="View ROR profile"
              >
                <RorIcon className="h-4 w-[22px] shrink-0" />
              </a>
            )}
          </div>
          <span className="rounded-full px-2.5 py-0.5 text-xs text-muted-foreground bg-muted/70 shrink-0">
            {authorCount === 1 ? '1 author' : `${authorCount} authors`}
          </span>
          {(deptDisplay || cityDisplay || countryDisplay) && (
            <span className="text-sm truncate text-muted-foreground">
              {[deptDisplay, cityDisplay, countryDisplay].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>

        {open ? (
          <>
            <hr className="mb-4 border-border" />
            <div className="space-y-4">
              <div className="space-y-2">
                <FormLabel
                  htmlFor={`aff-${affiliation.id}-name`}
                  required
                  valid={nameValid}
                  invalid={!nameValid}
                >
                  Name
                </FormLabel>
                <ui.Input
                  id={`aff-${affiliation.id}-name`}
                  type="text"
                  autoComplete="off"
                  value={editName ?? ''}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={saveName}
                  placeholder="Affiliation name"
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor={`aff-${affiliation.id}-department`} className="text-sm font-medium">
                  Department
                </label>
                <ui.Input
                  id={`aff-${affiliation.id}-department`}
                  type="text"
                  autoComplete="off"
                  value={editDepartment}
                  onChange={(e) => setEditDepartment(e.target.value)}
                  onBlur={saveDepartment}
                  placeholder="Department"
                  className="w-full"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1 space-y-2">
                  <label htmlFor={`aff-${affiliation.id}-city`} className="text-sm font-medium">
                    City
                  </label>
                  <ui.Input
                    id={`aff-${affiliation.id}-city`}
                    type="text"
                    autoComplete="off"
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    onBlur={saveCity}
                    placeholder="City"
                    className="w-full"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <label htmlFor={`aff-${affiliation.id}-country`} className="text-sm font-medium">
                    Country
                  </label>
                  <ui.Input
                    id={`aff-${affiliation.id}-country`}
                    type="text"
                    autoComplete="off"
                    value={editCountry}
                    onChange={(e) => setEditCountry(e.target.value)}
                    onBlur={saveCountry}
                    placeholder="Country"
                    className="w-full"
                  />
                </div>
              </div>
              {(affiliation.ror ?? '').trim() && (
                <p className="pt-1 font-mono text-sm truncate text-muted-foreground">
                  ROR:{' '}
                  <a
                    href={affiliation.ror!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="no-underline cursor-pointer text-muted-foreground hover:text-muted-foreground"
                  >
                    {affiliation.ror}
                  </a>
                </p>
              )}
            </div>
          </>
        ) : null}
      </div>

      {/* Collapse/Edit and Delete */}
      <div className="flex gap-1 items-start shrink-0">
        <ui.Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => onOpenChange(!open)}
          aria-label={open ? 'Collapse' : 'Edit affiliation'}
          className="cursor-pointer"
        >
          {open ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <Pencil className="w-4 h-4 text-muted-foreground" />
          )}
        </ui.Button>
        <ui.Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onRemove}
          disabled={authorCount >= 1}
          aria-label={
            authorCount >= 1 ? 'Remove affiliation (in use by authors)' : 'Remove affiliation'
          }
          className="cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-4 h-4 text-muted-foreground" />
        </ui.Button>
      </div>
    </li>
  );
}
