'use client';

import type { ReactNode } from 'react';
import type { UploadCheckCardMeta } from '../../modules/extensions/checks.js';
import { cn } from '../../utils/cn.js';
import { Card } from '../primitives/Card.js';
import { UploadCheckCardContent } from './UploadCheckCardContent.js';
import { uploadCheckCardClassName } from './uploadCheckCardStyles.js';

type Props = {
  meta: UploadCheckCardMeta;
  logo?: ReactNode;
};

/** Static upload check card shell for SSR / hydration (matches final card chrome and padding). */
export function UploadCheckCardPlaceholder({ meta, logo }: Props) {
  return (
    <Card
      lift
      className={cn('h-full', uploadCheckCardClassName({ enabled: false, disabled: false }))}
    >
      <UploadCheckCardContent
        logo={logo}
        title={meta.name}
        description={meta.description}
        enabled={false}
        disabled
      />
    </Card>
  );
}
