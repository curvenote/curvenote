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
  CornerDownLeft,
} from 'lucide-react';
import { OrcidIcon, RorIcon } from '@scienceicons/react/24/solid';
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
import {
  isValidEmail,
  isValidOrcid,
  extractOrcidId,
  getAuthorFieldErrors,
  normalizeOrcidForCompare,
} from './validationUtils.js';
import { useSaveField } from './useSaveField.js';
import { ui } from '@curvenote/scms-core';

type SortableAffiliationRowProps = {
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

function SortableAffiliationRow({
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
  // Fields from ROR should be read-only based on rorFields tracking
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
          <div className="flex-1 min-w-0 space-y-2">
            <span className="block min-w-0 truncate">{name}</span>
            {subtitle ? (
              <span className="block text-xs text-muted-foreground truncate min-w-0">
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

/** Subtitle for large affiliation cards: "department · city, country" format. */
function getAffiliationSubtitle(aff: Affiliation | undefined): string | null {
  if (!aff) return null;
  const dept = (aff.department ?? '').trim();
  const city = (aff.city ?? '').trim();
  const country = (aff.country ?? '').trim();
  const parts: string[] = [];
  if (dept) parts.push(dept);
  const location = [city, country].filter(Boolean).join(', ');
  if (location) parts.push(location);
  return parts.length > 0 ? parts.join(' · ') : null;
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
  const activeSubtitle = activeAffiliation ? getAffiliationSubtitle(activeAffiliation) : null;

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
            <div className="flex-1 min-w-0 truncate">
              <span className="block truncate">
                {(activeAffiliation.name ?? '').trim() || 'Affiliation'}
              </span>
              {activeSubtitle ? (
                <span className="block text-xs text-muted-foreground truncate">
                  {activeSubtitle}
                </span>
              ) : null}
            </div>
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
    const rorFields: string[] = ['name'];
    if (hit.city) rorFields.push('city');
    if (hit.country) rorFields.push('country');
    const aff: Affiliation = {
      id: uuid(),
      name: hit.name,
      ror: hit.ror,
      rorFields,
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
                    <OrcidIcon className="w-4 h-4 text-[#A6CE39]" aria-hidden />
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
                        <Building2 className="w-3 h-3 shrink-0" />
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
                <OrcidIcon
                  className={`w-4 h-4 shrink-0 ${orcidValid === true ? 'text-[#A6CE39]' : 'text-muted-foreground'}`}
                  aria-hidden
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
              <div className="flex gap-2 items-center">
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
                  variant="default"
                  disabled={!newAffiliationInput.trim()}
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
                        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-muted-foreground bg-background cursor-pointer hover:text-foreground hover:bg-muted/50 border-0 outline-none"
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
                  <OrcidIcon className="w-4 h-4 text-[#A6CE39]" aria-hidden />
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
                      <Building2 className="w-3 h-3 shrink-0" />
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
                <div className="flex gap-2 items-center">
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
                    variant="default"
                    disabled={!newAffiliationInput.trim()}
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
                          className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-muted-foreground bg-background cursor-pointer hover:text-foreground hover:bg-muted/50 border-0 outline-none"
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
  /** When false, "Add me as author" is hidden (e.g. user's ORCID is already in the list). */
  showAddMeAsAuthor: boolean;
  isEmpty: boolean;
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
  showAddMeAsAuthor,
  isEmpty,
}: AddAuthorPlaceholderCardProps) {
  return (
    <div className="flex gap-3 items-start p-4 rounded-sm border border-dashed border-border bg-background">
      <div className="flex-1 space-y-2 min-w-0">
        {isEmpty && showAddMeAsAuthor && (
          <div className="flex flex-wrap gap-2 items-center">
            <ui.Button
              type="button"
              variant="default"
              onClick={addMeAsAuthor}
              className="cursor-pointer w-fit"
            >
              Add me as an author
            </ui.Button>
            <span className="text-sm text-muted-foreground">or search for authors:</span>
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
        {!isEmpty && showAddMeAsAuthor && (
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
    if (!trimmed) return;
    const orcidId = extractOrcidId(trimmed);
    if (orcidId) {
      lastSubmittedOrcidQRef.current = trimmed;
      const fd = new FormData();
      fd.set('intent', 'search-orcid-by-id');
      fd.set('orcid', orcidId);
      orcidSearchFetcher.submit(fd, { method: 'POST' });
      return;
    }
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

  const [authorOrder, setAuthorOrder] = useState<string[]>(() => value.map((a) => a.id));

  // Sync authorOrder when value's author set changes (add/remove)
  useEffect(() => {
    setAuthorOrder(value.map((a) => a.id));
  }, [value]);

  const appendAuthor = (newAuthor: Author) => {
    const newAuthors = [...valueRef.current, newAuthor];
    handleChange(newAuthors);
    setAuthorOrder(newAuthors.map((a) => a.id));
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
    appendAuthor(newAuthor);
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

    const newValue = newOrder
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
    appendAuthor(newAuthor);
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
    appendAuthor(newAuthor);
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
    appendAuthor(newAuthor);
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
    const rorFields: string[] = ['name'];
    if (hit.city) rorFields.push('city');
    if (hit.country) rorFields.push('country');
    const aff: Affiliation = {
      id: uuid(),
      name: hit.name,
      ror: hit.ror,
      rorFields,
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
    setAuthorOrder(newAuthors.map((a) => a.id));
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
            <OrcidIcon className="w-4 h-4 text-[#A6CE39]" aria-hidden />
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
          <AddAuthorPlaceholderCard
            orcidSearchExternalOptions={orcidSearchOptions ?? []}
            orcidSearchLoading={orcidSearchLoading}
            onAuthorSelect={onAuthorSelectFromCombobox}
            onSearchChange={setAddAuthorSearchValue}
            addAuthorSearchValue={addAuthorSearchValue}
            handleAddAuthor={handleAddAuthor}
            orcidFetcher={orcidFetcher}
            addMeAsAuthor={addMeAsAuthor}
            showAddMeAsAuthor={Boolean(
              contactDetails &&
              !value.some(
                (a) =>
                  normalizeOrcidForCompare(a.orcid) ===
                  normalizeOrcidForCompare(contactDetails?.orcidId),
              ),
            )}
            isEmpty={value.length === 0}
          />
          <DragOverlay dropAnimation={null}>{activeAuthorOverlay}</DragOverlay>
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
            <div className="flex gap-2 justify-between items-center">
              <p className="text-sm font-medium text-foreground">Affiliations</p>
              {(() => {
                const usedAffiliationIds = new Set(value.flatMap((a) => a.affiliationIds ?? []));
                const unusedCount = affiliationList.filter(
                  (aff) => !usedAffiliationIds.has(aff.id),
                ).length;
                return (
                  <ui.Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={unusedCount === 0}
                    onClick={() => {
                      const used = new Set(value.flatMap((a) => a.affiliationIds ?? []));
                      onAffiliationListChange?.(affiliationList.filter((aff) => used.has(aff.id)));
                    }}
                    className="cursor-pointer text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" aria-hidden />
                    Delete unused affiliations
                  </ui.Button>
                );
              })()}
            </div>
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
                variant="default"
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
  // Fields from ROR should be read-only based on rorFields tracking
  const rorFields = affiliation.rorFields ?? [];
  const nameFromRor = rorFields.includes('name');
  const cityFromRor = rorFields.includes('city');
  const countryFromRor = rorFields.includes('country');

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
                <RorIcon className="h-4 w-[22px] shrink-0 text-muted-foreground" />
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
                  disabled={nameFromRor}
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
                    disabled={cityFromRor}
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
                    disabled={countryFromRor}
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
