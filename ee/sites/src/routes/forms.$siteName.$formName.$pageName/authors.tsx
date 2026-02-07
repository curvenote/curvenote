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
import type { Author, AuthorOption } from './types.js';
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
  name: string;
  onRename: (oldName: string, newName: string) => void;
  onRemove: () => void;
};

function SortableAffiliationRow({
  authorId,
  index,
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
    if (trimmed && trimmed !== name) onRename(name, trimmed);
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
  affiliations: string[];
  onReorder: (newOrder: string[]) => void;
  onRemove: (index: number) => void;
  onRename: (oldName: string, newName: string) => void;
  authorId: string;
};

function AffiliationSortableList({
  affiliations,
  onReorder,
  onRemove,
  onRename,
  authorId,
}: AffiliationSortableListProps) {
  const items = useMemo(
    () => affiliations.map((_, i) => `${authorId}-aff-${i}`),
    [affiliations, authorId],
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
    const newOrder = [...affiliations];
    const [removed] = newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, removed);
    onReorder(newOrder);
  };

  if (affiliations.length === 0) return null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {affiliations.map((name, idx) => (
            <SortableAffiliationRow
              key={`${authorId}-aff-${idx}`}
              authorId={authorId}
              index={idx}
              name={name}
              onRename={onRename}
              onRemove={() => onRemove(idx)}
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
  affiliationChoices: string[];
  onEnsureAffiliationInChoices: (name: string) => void;
  onRenameAffiliation?: (oldName: string, newName: string) => void;
  affiliationInputRef?: React.RefObject<HTMLInputElement | null>;
};

function AuthorCard({
  value,
  index,
  open,
  onOpenChange,
  onChange,
  onDelete,
  affiliationChoices,
  onEnsureAffiliationInChoices,
  onRenameAffiliation,
  affiliationInputRef,
}: AuthorCardProps) {
  const [editName, setEditName] = useState(value.name);
  const [editOrcid, setEditOrcid] = useState(value.orcid || '');
  const [editEmail, setEditEmail] = useState(value.email || '');
  const [editCorresponding, setEditCorresponding] = useState(value.corresponding || false);
  const [editAffiliations, setEditAffiliations] = useState<string[]>(value.affiliations ?? []);
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

  const addAffiliation = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (editAffiliations.includes(trimmed)) return;
    onEnsureAffiliationInChoices(trimmed);
    const next = [...editAffiliations, trimmed];
    setEditAffiliations(next);
    pushAuthor({ affiliations: next });
  };

  const addAffiliationInViewMode = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if ((value.affiliations ?? []).includes(trimmed)) return;
    onEnsureAffiliationInChoices(trimmed);
    onChange({
      ...value,
      affiliations: [...(value.affiliations ?? []), trimmed],
    });
  };

  // Update local state when value changes externally
  useEffect(() => {
    setEditName(value.name);
    setEditOrcid(value.orcid || '');
    setEditEmail(value.email || '');
    setEditCorresponding(value.corresponding || false);
    setEditAffiliations(value.affiliations ?? []);
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
                <span className="text-base font-semibold">{editName}</span>
                {orcidValid === true && (
                  <BadgeCheck
                    className="w-4 h-4 text-green-500 shrink-0"
                    aria-label="ORCID valid"
                  />
                )}
              </div>
              {editAffiliations.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {editAffiliations.map((aff) => (
                    <ui.Badge
                      key={aff}
                      variant="outline-muted"
                      className="flex gap-1 items-center text-xs"
                    >
                      <Building2 className="w-3 h-3" />
                      <span className="truncate max-w-[200px]">{aff}</span>
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
                affiliations={editAffiliations}
                onReorder={(newOrder) => {
                  setEditAffiliations(newOrder);
                  pushAuthor({ affiliations: newOrder });
                }}
                onRemove={(idx) => {
                  const next = editAffiliations.filter((_, i) => i !== idx);
                  setEditAffiliations(next);
                  pushAuthor({ affiliations: next });
                }}
                onRename={(oldName, newName) => {
                  if (!onRenameAffiliation) return;
                  onRenameAffiliation(oldName, newName.trim());
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
                      addAffiliation(newAffiliationInput);
                      setNewAffiliationInput('');
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
                    addAffiliation(newAffiliationInput);
                    setNewAffiliationInput('');
                  }}
                >
                  Add
                </ui.Button>
              </div>
              {affiliationChoices.filter((opt) => !editAffiliations.includes(opt)).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {affiliationChoices
                    .filter((opt) => !editAffiliations.includes(opt))
                    .map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => addAffiliation(opt)}
                        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-muted-foreground bg-muted/70 border-0 cursor-pointer hover:text-foreground hover:bg-sky-100"
                      >
                        <Plus className="w-3 h-3 shrink-0" />
                        {opt}
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
              <span className="text-base font-semibold">{value.name}</span>
              {orcidValid === true && (
                <BadgeCheck className="w-4 h-4 text-green-500 shrink-0" aria-label="ORCID valid" />
              )}
            </div>

            {/* Affiliations: chips when any, or entry box only when none (first creation) */}
            {value.affiliations && value.affiliations.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {value.affiliations.map((affiliation, idx) => (
                  <ui.Badge
                    key={idx}
                    variant="outline-muted"
                    className="flex gap-1 items-center text-xs"
                  >
                    <Building2 className="w-3 h-3" />
                    <span className="truncate max-w-[200px]" title={affiliation}>
                      {affiliation}
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
                        addAffiliationInViewMode(newAffiliationInput);
                        setNewAffiliationInput('');
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
                      addAffiliationInViewMode(newAffiliationInput);
                      setNewAffiliationInput('');
                    }}
                  >
                    Add
                  </ui.Button>
                </div>
                {(() => {
                  const otherAffiliations = affiliationChoices.filter(
                    (opt) => !(value.affiliations ?? []).includes(opt),
                  );
                  return otherAffiliations.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {otherAffiliations.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => addAffiliationInViewMode(opt)}
                          className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-muted-foreground bg-muted/70 border-0 cursor-pointer hover:text-foreground hover:bg-sky-100"
                        >
                          <Plus className="w-3 h-3 shrink-0" />
                          {opt}
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
  affiliationChoices?: string[];
  onAffiliationChoicesChange?: (list: string[]) => void;
  draftObjectId?: string | null;
  onDraftCreated?: (id: string) => void;
};

export function AuthorField({
  schema,
  value = [],
  onChange,
  affiliationChoices: affiliationChoicesProp = [],
  onAffiliationChoicesChange,
  draftObjectId = null,
  onDraftCreated,
}: AuthorFieldProps) {
  const [nameInput, setNameInput] = useState('');
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const lastCardAffiliationInputRef = useRef<HTMLInputElement>(null);
  const authorCountRef = useRef(value.length);
  const affiliationChoices = affiliationChoicesProp ?? [];
  const derivedOptions = useMemo(() => {
    const set = new Set(affiliationChoices);
    value.forEach((a) => {
      (a.affiliations ?? []).forEach((aff) => {
        set.add(aff);
      });
    });
    return Array.from(set);
  }, [affiliationChoices, value]);
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

  const ensureAffiliationInChoices = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || derivedOptions.includes(trimmed)) return;
    onAffiliationChoicesChange?.([...derivedOptions, trimmed]);
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
      affiliation: '',
      affiliations: [],
    };
    handleChange([...value, newAuthor]);
    setNameInput('');
  };

  const handleAffiliationChoicesChange = (newList: string[]) => {
    onAffiliationChoicesChange?.(newList);
  };

  const handleRenameAffiliation = (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    const newOptions = affiliationChoices.map((a) => (a === oldName ? trimmed : a));
    handleAffiliationChoicesChange(newOptions);
    const newAuthors = value.map((author) => ({
      ...author,
      affiliations: author.affiliations.map((a) => (a === oldName ? trimmed : a)),
    }));
    handleChange(newAuthors);
  };

  const handleRemoveAffiliationOption = (name: string) => {
    handleAffiliationChoicesChange(derivedOptions.filter((a) => a !== name));
    const newAuthors = value.map((author) => ({
      ...author,
      affiliations: author.affiliations.filter((a) => a !== name),
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

      {/* Add author: name only */}
      <div className="flex gap-2 items-end">
        <div className="flex-1 space-y-1 min-w-0">
          <label htmlFor={`${schema.name}-add-name`} className="text-sm font-medium">
            Name
          </label>
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
            className="w-full"
          />
        </div>
        <ui.Button
          type="button"
          onClick={handleAddAuthor}
          disabled={!nameInput.trim()}
          className="cursor-pointer shrink-0"
        >
          Add
          <ChevronDown className="w-4 h-4" />
        </ui.Button>
      </div>

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
                  affiliationChoices={derivedOptions}
                  onEnsureAffiliationInChoices={ensureAffiliationInChoices}
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

      {/* Advanced options: edit affiliation list */}
      {derivedOptions.length > 0 && (
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
            {affiliationChoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add authors with affiliations above; they will appear here for editing.
              </p>
            ) : (
              <ul className="space-y-2">
                {derivedOptions.map((aff, idx) => (
                  <AffiliationListItem
                    key={aff}
                    index={idx}
                    name={aff}
                    onRename={(newName) => handleRenameAffiliation(aff, newName)}
                    onRemove={() => handleRemoveAffiliationOption(aff)}
                  />
                ))}
              </ul>
            )}
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
