import type { FieldSchema } from './types.js';
import { ui } from '@curvenote/scms-core';
import { useSaveField } from './useSaveField.js';

type TitleFieldProps = {
  schema: FieldSchema;
  value: string;
  onChange: (value: string) => void;
  draftObjectId?: string | null;
  onDraftCreated?: (id: string) => void;
};

export function TitleField({
  schema,
  value,
  onChange,
  draftObjectId = null,
  onDraftCreated,
}: TitleFieldProps) {
  const isValid = value.trim().length > 0;
  const save = useSaveField(draftObjectId ?? null, schema.name, onDraftCreated);

  return (
    <div className="space-y-2">
      <ui.FormLabel
        htmlFor={schema.name}
        required={schema.required}
        valid={isValid}
        defined={value.trim().length > 0}
      >
        {schema.title}
      </ui.FormLabel>
      <ui.Input
        id={schema.name}
        type="text"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v);
          save(v);
        }}
        className="font-bold"
      />
    </div>
  );
}
