import { AlertCircle } from 'lucide-react';
import type { KeywordsOption } from './types.js';
import { cn, ui } from '@curvenote/scms-core';
import { FormLabel } from './FormLabel.js';
import { useSaveField } from './useSaveField.js';

export function normalizeKeywords(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string' && value.trim())
    return value
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
  return [];
}

type KeywordsFieldProps = {
  schema: KeywordsOption;
  value: string[];
  onChange: (value: string[]) => void;
  draftObjectId?: string | null;
  onDraftCreated?: (id: string) => void;
};

export function KeywordsField({
  schema,
  value,
  onChange,
  draftObjectId = null,
  onDraftCreated,
}: KeywordsFieldProps) {
  const overMax = schema.maxKeywords != null && value.length > schema.maxKeywords;
  const isValid = value.length > 0 && !overMax;
  const save = useSaveField(draftObjectId ?? null, schema.name, onDraftCreated);

  const handleValueChange = (next: (string | number)[]) => {
    const strings = next.map((t) => String(t));
    onChange(strings);
    save(strings);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <FormLabel
          htmlFor={schema.name}
          required={schema.required}
          valid={isValid}
          invalid={overMax}
        >
          {schema.title}
        </FormLabel>
        {schema.maxKeywords != null && (
          <span
            className={cn(
              'flex items-center gap-1 text-sm shrink-0',
              overMax ? 'text-destructive font-medium' : 'text-muted-foreground',
            )}
          >
            {overMax && <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />}
            {value.length} / {schema.maxKeywords} keyword{schema.maxKeywords === 1 ? '' : 's'}
          </span>
        )}
      </div>
      <ui.TagsInput<string> value={value} onChange={handleValueChange}>
        {({ tags }: { tags: string[] }) => (
          <ui.TagsInputGroup>
            {tags.map((tag, idx) => (
              <ui.TagsInputItem key={idx} variant="chip" shape="pill">
                <ui.TagsInputItemText>{String(tag)}</ui.TagsInputItemText>
                <ui.TagsInputItemDelete />
              </ui.TagsInputItem>
            ))}
            <ui.TagsInputInput
              placeholder={
                tags.length > 0
                  ? 'Add more...'
                  : schema.placeholder || 'Type and press Enter to add'
              }
              id={schema.name}
              className="border-dashed"
            />
          </ui.TagsInputGroup>
        )}
      </ui.TagsInput>
    </div>
  );
}
