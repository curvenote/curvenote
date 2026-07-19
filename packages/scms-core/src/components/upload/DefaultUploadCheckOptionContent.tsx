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
  warning,
  warningMessage,
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
      warning={warning}
      warningMessage={warningMessage}
      busy={toggleBusy}
      spinnerWhenBusy
      onRequestEnable={() => {
        void setEnabled(true);
      }}
    />
  );
}
