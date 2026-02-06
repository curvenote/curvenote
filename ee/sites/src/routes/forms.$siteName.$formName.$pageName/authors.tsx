import { useState, useEffect } from 'react';
import { uuidv7 as uuid } from 'uuidv7';
import {
  GripVertical,
  Mail,
  Building2,
  Trash2,
  Users,
  ChevronDown,
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
import { useSaveField } from './useSaveField.js';
import { ui } from '@curvenote/scms-core';

type AuthorCardProps = {
  value: Author;
  index: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (author: Author) => void;
  onDelete: () => void;
};

function AuthorCard({ value, index, open, onOpenChange, onChange, onDelete }: AuthorCardProps) {
  const [editName, setEditName] = useState(value.name);
  const [editOrcid, setEditOrcid] = useState(value.orcid || '');
  const [editEmail, setEditEmail] = useState(value.email || '');
  const [editCorresponding, setEditCorresponding] = useState(value.corresponding || false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: value.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSave = () => {
    onChange({
      ...value,
      name: editName,
      orcid: editOrcid || undefined,
      email: editEmail || undefined,
      corresponding: editCorresponding,
    });
    onOpenChange(false);
  };

  const handleCancel = () => {
    setEditName(value.name);
    setEditOrcid(value.orcid || '');
    setEditEmail(value.email || '');
    setEditCorresponding(value.corresponding || false);
    onOpenChange(false);
  };

  // Update local state when value changes externally
  useEffect(() => {
    setEditName(value.name);
    setEditOrcid(value.orcid || '');
    setEditEmail(value.email || '');
    setEditCorresponding(value.corresponding || false);
  }, [value]);

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

      {/* Author content */}
      <div className="flex-1 min-w-0">
        {open ? (
          /* Edit mode */
          <div className="space-y-4">
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
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Enter full name"
              />
            </div>

            {/* ORCID */}
            <div className="space-y-2">
              <div className="flex gap-2 items-center">
                <BadgeCheck className="w-4 h-4 text-green-500 shrink-0" />
                <FormLabel
                  htmlFor={`author-${index}-orcid`}
                  required={false}
                  valid={!!value.orcid && value.orcid.trim().length > 0}
                >
                  ORCID
                </FormLabel>
              </div>
              <ui.Input
                id={`author-${index}-orcid`}
                type="text"
                value={editOrcid}
                onChange={(e) => setEditOrcid(e.target.value)}
                placeholder="0000-0000-0000-0000"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <FormLabel
                htmlFor={`author-${index}-email`}
                required={true}
                valid={editEmail.trim().length > 0}
              >
                Email
              </FormLabel>
              <ui.Input
                id={`author-${index}-email`}
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>

            {/* Corresponding Author */}
            <div className="flex gap-2 items-center">
              <ui.Checkbox
                id={`author-${index}-corresponding`}
                checked={editCorresponding}
                onCheckedChange={(checked) => setEditCorresponding(checked === true)}
              />
              <label
                htmlFor={`author-${index}-corresponding`}
                className="text-sm font-medium cursor-pointer"
              >
                Corresponding author
              </label>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <ui.Button type="button" onClick={handleSave} size="sm" className="cursor-pointer">
                Save
              </ui.Button>
              <ui.Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                size="sm"
                className="cursor-pointer"
              >
                Cancel
              </ui.Button>
            </div>
          </div>
        ) : (
          /* View mode */
          <>
            {/* Author name and icons */}
            <div className="flex gap-2 items-center mb-2">
              <span className="text-base font-semibold">{value.name}</span>
              {value.email && (
                <Mail className="w-4 h-4 text-muted-foreground shrink-0" aria-label="Email" />
              )}
              {value.orcid && (
                <BadgeCheck className="w-4 h-4 text-green-500 shrink-0" aria-label="ORCID" />
              )}
            </div>

            {/* Affiliations */}
            {value.affiliations && value.affiliations.length > 0 && (
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
            )}

            {/* Click to edit */}
            <button
              type="button"
              onClick={() => onOpenChange(true)}
              className="mt-2 text-sm cursor-pointer text-muted-foreground hover:text-foreground"
            >
              Click to edit
            </button>
          </>
        )}
      </div>

      {/* Delete button */}
      {!open && (
        <div className="flex gap-1 items-start shrink-0">
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
      )}
    </div>
  );
}

type AuthorFieldProps = {
  schema: AuthorOption;
  value: Author[];
  onChange: (value: Author[]) => void;
  draftObjectId?: string | null;
  onDraftCreated?: (id: string) => void;
};

export function AuthorField({
  schema,
  value = [],
  onChange,
  draftObjectId = null,
  onDraftCreated,
}: AuthorFieldProps) {
  const [inputValue, setInputValue] = useState('');
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const isValid = value.length > 0;
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

  const handleAdd = () => {
    if (!inputValue.trim()) return;

    // Simple parsing: split by comma and create authors
    // This is a basic implementation - you may want more sophisticated parsing
    const names = inputValue
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name.length > 0);

    const newAuthors: Author[] = names.map((name) => ({
      id: uuid(),
      name,
      affiliation: '',
      affiliations: [],
    }));

    handleChange([...value, ...newAuthors]);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
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

      {/* Input box with Add button */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Users className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 pointer-events-none text-muted-foreground" />
          <ui.Input
            id={schema.name}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Marie Curie, Jonas Salk, 0002-1234-2312-3839"
            className="pl-10"
          />
        </div>
        <ui.Button
          type="button"
          onClick={handleAdd}
          disabled={!inputValue.trim()}
          className="cursor-pointer"
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
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}
