import { AlertCircle } from 'lucide-react';
import type { ParagraphOption } from './types.js';
import { cn, ui } from '@curvenote/scms-core';
import { useSaveField } from './useSaveField.js';

type AbstractFieldProps = {
  schema: ParagraphOption;
  value: string;
  onChange: (value: string) => void;
  draftObjectId?: string | null;
  onDraftCreated?: (id: string) => void;
};

export function AbstractField({
  schema,
  value,
  onChange,
  draftObjectId = null,
  onDraftCreated,
}: AbstractFieldProps) {
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const maxWords = schema.maxWordCount ?? 0;
  const progressPercentage = maxWords > 0 ? (wordCount / maxWords) * 100 : 0;
  const isOverLimit = maxWords > 0 && wordCount > maxWords;
  const isValid = value.trim().length > 0 && !isOverLimit;
  const save = useSaveField(draftObjectId ?? null, schema.name, onDraftCreated);

  return (
    <div className="space-y-2">
      <ui.FormLabel
        htmlFor={schema.name}
        required={schema.required}
        valid={isValid}
        invalid={isOverLimit}
      >
        {schema.title}
      </ui.FormLabel>
      <textarea
        id={schema.name}
        rows={8}
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v);
          save(v);
        }}
        className={cn(
          'px-3 py-2 w-full text-base bg-transparent border rounded-xs min-h-[200px] border-input',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
          'resize-y',
        )}
      />
      {maxWords > 0 && (
        <div className="flex gap-3 items-center">
          <div className="overflow-hidden flex-1 h-2 bg-gray-200 rounded-full dark:bg-gray-700">
            <div
              className={cn('h-full transition-all', isOverLimit ? 'bg-red-500' : 'bg-green-500')}
              style={{ width: `${Math.min(progressPercentage, 100)}%` }}
            />
          </div>
          <span
            className={cn(
              'flex items-center gap-1 text-sm whitespace-nowrap',
              isOverLimit ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {isOverLimit && <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />}
            {wordCount}/{maxWords} words
          </span>
        </div>
      )}
    </div>
  );
}
