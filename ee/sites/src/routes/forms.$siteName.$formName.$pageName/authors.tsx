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
      className="flex gap-2 items-center rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
    >
      <button
        {...attributes}
        {...listeners}
        type="button"
        className="cursor-grab active:cursor-grabbing touch-none shrink-0"
      >
        <GripVertical className="w-4 h-4 text-muted-foreground/50 hover:text-muted-foreground" />
      </button>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums w-6">
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
          className="flex-1 min-w-0 px-2 py-1 text-sm rounded border border-input bg-background outline-none"
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
  return list.find((a) => a.id === id)?.name ?? id;
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
                  {editAffiliationIds.map((affId) => (
                    <ui.Badge
                      key={affId}
                      variant="outline-muted"
                      className="flex gap-1 items-center text-xs"
                    >
                      <Building2 className="w-3 h-3" />
                      <span className="truncate max-w-[200px]">
                        {getAffiliationName(affiliationList, affId)}
                      </span>
                    </ui.Badge>
                  ))}
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
                {value.affiliationIds.map((affId) => (
                  <ui.Badge
                    key={affId}
                    variant="outline-muted"
                    className="flex gap-1 items-center text-xs"
                  >
                    <Building2 className="w-3 h-3" />
                    <span
                      className="truncate max-w-[200px]"
                      title={getAffiliationName(affiliationList, affId)}
                    >
                      {getAffiliationName(affiliationList, affId)}
                    </span>
                  </ui.Badge>
                ))}
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
              {affiliationList.map((aff, idx) => (
                <AffiliationListItem
                  key={aff.id}
                  index={idx}
                  name={aff.name}
                  onRename={(newName) => handleRenameAffiliation(aff.id, newName)}
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
  index: number;
  name: string;
  onRename: (newName: string) => void;
  onRemove: () => void;
};

function AffiliationListItem({ index, name, onRename, onRemove }: AffiliationListItemProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);

  useEffect(() => {
    setEditValue(name);
  }, [name]);

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== name) onRename(trimmed);
    setEditing(false);
  };

  return (
    <li className="flex gap-2 items-center text-sm">
      <span className="shrink-0 w-6 text-xs text-muted-foreground tabular-nums">
        {getOrdinalLabel(index + 1)}
      </span>
      {editing ? (
        <>
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') {
                setEditValue(name);
                setEditing(false);
              }
            }}
            className="flex-1 px-2 py-1 min-w-0 text-sm rounded border border-input bg-background"
            autoFocus
          />
          <ui.Button type="button" size="sm" onClick={handleSave} className="cursor-pointer">
            Save
          </ui.Button>
          <ui.Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setEditValue(name);
              setEditing(false);
            }}
            className="cursor-pointer"
          >
            Cancel
          </ui.Button>
        </>
      ) : (
        <>
          <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="flex-1 min-w-0 truncate">{name}</span>
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
    </li>
  );
}
