'use client';

import type { UploadCheckOptionProps } from '../../modules/extensions/types.js';
import { UploadCheckCardContent } from './UploadCheckCardContent.js';

type DefaultUploadCheckOptionContentProps = UploadCheckOptionProps & {
  name: string;
  description: string;
};

export function DefaultUploadCheckOptionContent({
  enabled,
  disabled,
  invalid,
  setEnabled,
  toggleBusy = false,
  name,
  description,
}: DefaultUploadCheckOptionContentProps) {
  return (
    <UploadCheckCardContent
      title={name}
      description={description}
      enabled={enabled}
      disabled={disabled}
      invalid={invalid}
      busy={toggleBusy}
      spinnerWhenBusy
      onRequestEnable={() => {
        void setEnabled(true);
      }}
    />
  );
}
