import type { RadioOption } from './types.js';
import { WizardQuestion } from '@curvenote/scms-core';
import { useSaveField } from './useSaveField.js';

type RadioFieldProps = {
  schema: RadioOption;
  value: string;
  onChange: (value: string) => void;
  draftObjectId?: string | null;
  onDraftCreated?: (id: string) => void;
};

export function RadioField({
  schema,
  value,
  onChange,
  draftObjectId = null,
  onDraftCreated,
}: RadioFieldProps) {
  const save = useSaveField(draftObjectId ?? null, schema.name, onDraftCreated);
  const useVertical = schema.kind === 'vertical' || schema.options.length > 2;

  return (
    <div className="space-y-2">
      <WizardQuestion
        key={schema.name}
        value={value}
        onChange={(v) => {
          onChange(v);
          save(v);
        }}
        question={{
          id: schema.name,
          title: schema.title,
          type: useVertical ? 'radio_vertical' : 'radio',
          options: schema.options,
        }}
        radioPosition="left"
        verticalConstrainWidth={useVertical}
      />
    </div>
  );
}
