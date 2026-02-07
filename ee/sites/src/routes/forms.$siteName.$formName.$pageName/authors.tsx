import { useState, useEffect, useMemo, useRef } from 'react';
import { uuidv7 as uuid } from 'uuidv7';
import {
  GripVertical,
  Building2,
  Pencil,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  BadgeCheck,
  CornerDownLeft,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
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

function getOrdinalLabel(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

type SortableAffiliationRowProps = {
  authorId: string;
  index: number;
  affiliationId: string;
  name: string;
  onRename: (affiliationId: string, newName: string) => void;
  onRemove: () => void;
};

function SortableAffiliationRow({
  authorId,
  index,
  affiliationId,
  name,
  onRename,
  onRemove,
}: SortableAffiliationRowProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);
  const id = `${authorId}-aff-${index}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id,
  });

  useEffect(() => {
    setEditValue(name);
  }, [name]);

  const handleSaveRename = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== name) onRename(affiliationId, trimmed);
    setEditing(false);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: 'none',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex gap-2 items-center px-3 py-2 text-sm rounded-md border border-border bg-muted/30"
    >
      <button
        {...attributes}
        {...listeners}
        type="button"
        className="cursor-grab active:cursor-grabbing touch-none shrink-0"
      >
        <GripVertical className="w-4 h-4 text-muted-foreground/50 hover:text-muted-foreground" />
      </button>
      <span className="w-6 text-xs tabular-nums shrink-0 text-muted-foreground">
        {getOrdinalLabel(index + 1)}
      </span>
      {editing ? (
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSaveRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSaveRename();
            if (e.key === 'Escape') {
              setEditValue(name);
              setEditing(false);
            }
          }}
          className="flex-1 px-2 py-1 min-w-0 text-sm rounded border outline-none border-input bg-background"
          autoFocus
        />
      ) : (
        <span className="flex-1 min-w-0 truncate">{name}</span>
      )}
      {!editing && (
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
  );
}

type AffiliationSortableListProps = {
  affiliationIds: string[];
  affiliationList: Affiliation[];
  onReorder: (newOrder: string[]) => void;
  onRemove: (affiliationId: string) => void;
  onRename: (affiliationId: string, newName: string) => void;
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
  authorId,
}: AffiliationSortableListProps) {
  const items = useMemo(
    () => affiliationIds.map((_, i) => `${authorId}-aff-${i}`),
    [affiliationIds, authorId],
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.indexOf(active.id as string);
    const newIndex = items.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = [...affiliationIds];
    const [removed] = newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, removed);
    onReorder(newOrder);
  };

  if (affiliationIds.length === 0) return null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {affiliationIds.map((affId, idx) => (
            <SortableAffiliationRow
              key={`${authorId}-aff-${idx}`}
              authorId={authorId}
              index={idx}
              affiliationId={affId}
              name={getAffiliationName(affiliationList, affId)}
              onRename={onRename}
              onRemove={() => onRemove(affId)}
            />
          ))}
        </div>
      </SortableContext>
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
  affiliationInputRef?: React.RefObject<HTMLInputElement | null>;
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
  affiliationInputRef,
}: AuthorCardProps) {
  const [editName, setEditName] = useState(value.name);
  const [editOrcid, setEditOrcid] = useState(value.orcid || '');
  const [editEmail, setEditEmail] = useState(value.email || '');
  const [editCorresponding, setEditCorresponding] = useState(value.corresponding || false);
  const [editAffiliationIds, setEditAffiliationIds] = useState<string[]>(
    value.affiliationIds ?? [],
  );
  const [newAffiliationInput, setNewAffiliationInput] = useState('');

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: value.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
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
      {/* Drag handle */}
      <div className="flex flex-col gap-1 items-center pt-1 shrink-0">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none"
          type="button"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground/50 hover:text-muted-foreground" />
        </button>
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
              <div className="flex gap-2 items-center mb-2">
                <span
                  className={`text-base font-semibold ${editName.trim() ? '' : 'text-muted-foreground/60'}`}
                >
                  {editName.trim() || 'Author Name'}
                </span>
                {orcidValid === true && (
                  <BadgeCheck
                    className="w-4 h-4 text-green-500 shrink-0"
                    aria-label="ORCID valid"
                  />
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
                authorId={value.id}
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAffiliationInput}
                  onChange={(e) => setNewAffiliationInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const trimmed = newAffiliationInput.trim();
                      if (trimmed) {
                        addAffiliation({ id: uuid(), name: trimmed });
                        setNewAffiliationInput('');
                      }
                    }
                  }}
                  placeholder="Add affiliation"
                  className="flex h-9 flex-1 min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[2px]"
                />
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
              {affiliationList.filter((a) => !editAffiliationIds.includes(a.id)).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {affiliationList
                    .filter((a) => !editAffiliationIds.includes(a.id))
                    .map((aff) => (
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
              )}
            </div>
          </div>
        ) : (
          /* View mode */
          <>
            {/* Author name + ORCID badge when valid only (no top-level error indicator) */}
            <div className="flex gap-2 items-center mb-2">
              <span
                className={`text-base font-semibold ${value.name?.trim() ? '' : 'text-muted-foreground/60'}`}
              >
                {value.name?.trim() || 'Author Name'}
              </span>
              {orcidValid === true && (
                <BadgeCheck className="w-4 h-4 text-green-500 shrink-0" aria-label="ORCID valid" />
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
                  <input
                    ref={affiliationInputRef as React.RefObject<HTMLInputElement>}
                    type="text"
                    value={newAffiliationInput}
                    onChange={(e) => setNewAffiliationInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const trimmed = newAffiliationInput.trim();
                        if (trimmed) {
                          addAffiliationInViewMode({ id: uuid(), name: trimmed });
                          setNewAffiliationInput('');
                        }
                      }
                    }}
                    placeholder="Add affiliation"
                    className="flex h-9 flex-1 min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[2px]"
                  />
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
                  const otherAffiliations = affiliationList.filter(
                    (a) => !(value.affiliationIds ?? []).includes(a.id),
                  );
                  return otherAffiliations.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {otherAffiliations.map((aff) => (
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
                  ) : null;
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

type AuthorFieldProps = {
  schema: AuthorOption;
  value: Author[];
  onChange: (value: Author[]) => void;
  affiliationList?: Affiliation[];
  onAffiliationListChange?: (list: Affiliation[]) => void;
  draftObjectId?: string | null;
  onDraftCreated?: (id: string) => void;
};

export function AuthorField({
  schema,
  value = [],
  onChange,
  affiliationList: affiliationListProp = [],
  onAffiliationListChange,
  draftObjectId = null,
  onDraftCreated,
}: AuthorFieldProps) {
  const [nameInput, setNameInput] = useState('');
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [openAffiliationId, setOpenAffiliationId] = useState<string | null>(null);
  const lastCardAffiliationInputRef = useRef<HTMLInputElement>(null);
  const authorCountRef = useRef(value.length);
  const affiliationList = affiliationListProp ?? [];
  const authorErrors = getAuthorFieldErrors(value);
  const isValid = value.length > 0 && authorErrors.length === 0;

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const activeId = active.id as string;
      const overId = over.id as string;
      const oldIndex = value.findIndex((author) => author.id === activeId);
      const newIndex = value.findIndex((author) => author.id === overId);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newAuthors = [...value];
        const [movedAuthor] = newAuthors.splice(oldIndex, 1);
        newAuthors.splice(newIndex, 0, movedAuthor);
        handleChange(newAuthors);

        // Update openIndex if needed
        if (openIndex === oldIndex) {
          setOpenIndex(newIndex);
        } else if (openIndex !== null) {
          if (oldIndex < openIndex && newIndex >= openIndex) {
            setOpenIndex(openIndex - 1);
          } else if (oldIndex > openIndex && newIndex <= openIndex) {
            setOpenIndex(openIndex + 1);
          }
        }
      }
    }
  };

  const handleAddAuthor = () => {
    if (!nameInput.trim()) return;
    const newAuthor: Author = {
      id: uuid(),
      name: nameInput.trim(),
      affiliationIds: [],
    };
    handleChange([...value, newAuthor]);
    setNameInput('');
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

  const handleAuthorChange = (index: number, updatedAuthor: Author) => {
    const newAuthors = [...value];
    newAuthors[index] = updatedAuthor;
    handleChange(newAuthors);
  };

  const handleDelete = (index: number) => {
    const newAuthors = value.filter((_, i) => i !== index);
    handleChange(newAuthors);
    if (openIndex === index) {
      setOpenIndex(null);
    } else if (openIndex !== null && openIndex > index) {
      setOpenIndex(openIndex - 1);
    }
  };

  return (
    <div className="space-y-4">
      <FormLabel htmlFor={schema.name} required={schema.required} valid={isValid}>
        {schema.title}
      </FormLabel>

      {/* Author cards list */}
      {value.length > 0 && (
        <div className="space-y-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={value.map((author) => author.id)}
              strategy={verticalListSortingStrategy}
            >
              {value.map((author, index) => (
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
                  affiliationInputRef={
                    index === value.length - 1 ? lastCardAffiliationInputRef : undefined
                  }
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Add author: input at bottom of list */}
      <div className="flex gap-2 items-center">
        <ui.Input
          id={`${schema.name}-add-name`}
          type="text"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddAuthor();
            }
          }}
          placeholder="Marie Curie - or - 0002-1234-2312-3839"
          className="flex-1 min-w-0"
        />
        <ui.Button
          type="button"
          onClick={handleAddAuthor}
          disabled={!nameInput.trim()}
          className="cursor-pointer shrink-0"
        >
          Add Author
          <CornerDownLeft className="w-4 h-4" aria-hidden />
        </ui.Button>
      </div>

      {/* Advanced options: edit affiliation list */}
      {affiliationList.length > 0 && (
        <details
          className="mt-6 rounded-md border border-border"
          open={advancedOpen}
          onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="flex gap-2 items-center px-4 py-3 text-sm font-medium list-none cursor-pointer">
            <ChevronDown
              className={`w-4 h-4 transition-transform ${advancedOpen ? 'rotate-0' : '-rotate-90'}`}
            />
            Advanced options – edit affiliations
          </summary>
          <div className="px-4 pt-1 pb-4 space-y-2 border-t border-border">
            <ul className="space-y-2">
              {affiliationList.map((aff) => (
                <AffiliationListItem
                  key={aff.id}
                  affiliation={aff}
                  open={openAffiliationId === aff.id}
                  onOpenChange={(open) => setOpenAffiliationId(open ? aff.id : null)}
                  onUpdate={(updates) => handleUpdateAffiliation(aff.id, updates)}
                  onRemove={() => handleRemoveAffiliationFromList(aff.id)}
                />
              ))}
            </ul>
          </div>
        </details>
      )}
    </div>
  );
}

type AffiliationListItemProps = {
  affiliation: Affiliation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (updates: Partial<Affiliation>) => void;
  onRemove: () => void;
};

function AffiliationListItem({
  affiliation,
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
        <div className="flex gap-2 items-center mb-2">
          <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
          <span
            className={`text-base font-semibold flex-1 min-w-0 truncate ${
              !nameValid ? 'text-muted-foreground/60' : ''
            }`}
          >
            {nameDisplay || 'Affiliation name'}
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
                    value={editCountry}
                    onChange={(e) => setEditCountry(e.target.value)}
                    onBlur={saveCountry}
                    placeholder="Country"
                    className="w-full"
                  />
                </div>
              </div>
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
          aria-label="Remove affiliation"
          className="cursor-pointer"
        >
          <Trash2 className="w-4 h-4 text-muted-foreground" />
        </ui.Button>
      </div>
    </li>
  );
}
