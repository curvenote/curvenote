'use client';

import { useCallback } from 'react';
import { useFetcher } from 'react-router';
import { Card } from '../primitives/Card.js';
import type { ClientExtensionCheckService } from '../../modules/extensions/types.js';
import { DefaultUploadCheckOptionContent } from './DefaultUploadCheckOptionContent.js';
import { uploadCheckCardClassName } from './uploadCheckCardStyles.js';

export interface UploadCheckOptionCardProps {
  service: ClientExtensionCheckService;
  workVersionId: string;
  enabled: boolean;
  /** Optional service logo URL (e.g. text integrity manifest from Object store). */
  logoUrl?: string;
}

export function UploadCheckOptionCard({
  service,
  workVersionId,
  enabled,
  logoUrl,
}: UploadCheckOptionCardProps) {
  const fetcher = useFetcher();

  const setEnabled = useCallback(
    async (next: boolean) => {
      const formData = new FormData();
      formData.append('intent', 'toggle-check');
      formData.append('checkName', service.id);
      formData.append('checked', String(next));
      fetcher.submit(formData, { method: 'post' });
    },
    [fetcher, service.id],
  );

  const Inner = service.uploadCheckOptionComponent ?? DefaultUploadCheckOptionContent;
  const isBusy = fetcher.state !== 'idle';

  return (
    <Card
      lift
      className={uploadCheckCardClassName({ enabled, busy: isBusy })}
      onClick={() => {
        if (enabled) {
          void setEnabled(false);
        }
      }}
    >
      <Inner
        workVersionId={workVersionId}
        enabled={enabled}
        setEnabled={setEnabled}
        name={service.name}
        description={service.description}
        logoUrl={logoUrl}
      />
    </Card>
  );
}
