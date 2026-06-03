'use client';

import { useCallback, useEffect } from 'react';
import { useFetcher } from 'react-router';
import { cn } from '../../utils/cn.js';
import { Card } from '../primitives/Card.js';
import { toastError } from '../ui/toast.js';
import type { ClientExtensionCheckService } from '../../modules/extensions/types.js';
import { DefaultUploadCheckOptionContent } from './DefaultUploadCheckOptionContent.js';
import { uploadCheckCardClassName } from './uploadCheckCardStyles.js';

export interface UploadCheckOptionCardProps {
  service: ClientExtensionCheckService;
  workVersionId: string;
  enabled: boolean;
  disabled?: boolean;
  invalid?: boolean;
  /** Optional service logo URL (e.g. text integrity manifest from Object store). */
  logoUrl?: string;
}

export function UploadCheckOptionCard({
  service,
  workVersionId,
  enabled,
  disabled = false,
  invalid = false,
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

  useEffect(() => {
    if (fetcher.state !== 'idle' || !fetcher.data) return;
    const d = fetcher.data as { error?: { message?: string } };
    if (d.error?.message) {
      toastError(d.error.message);
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <Card
      lift
      className={cn('h-full', uploadCheckCardClassName({ enabled, disabled, invalid, busy: isBusy }))}
      onClick={() => {
        if (enabled) {
          void setEnabled(false);
        }
      }}
    >
      <Inner
        workVersionId={workVersionId}
        enabled={enabled}
        disabled={disabled}
        invalid={invalid}
        setEnabled={setEnabled}
        toggleBusy={isBusy}
        name={service.name}
        description={service.description}
        logoUrl={logoUrl}
      />
    </Card>
  );
}
