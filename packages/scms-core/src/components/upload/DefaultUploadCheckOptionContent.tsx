'use client';

import type { UploadCheckOptionProps } from '../../modules/extensions/types.js';
import { UploadCheckCardContent } from './UploadCheckCardContent.js';

type DefaultUploadCheckOptionContentProps = UploadCheckOptionProps & {
  name: string;
  description: string;
};

export function DefaultUploadCheckOptionContent({
  enabled,
  setEnabled,
  name,
  description,
}: DefaultUploadCheckOptionContentProps) {
  return (
    <UploadCheckCardContent
      title={name}
      description={description}
      enabled={enabled}
      onRequestEnable={() => {
        void setEnabled(true);
      }}
    />
  );
}
