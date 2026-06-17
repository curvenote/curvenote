import { useFetcher } from 'react-router';
import { GitBranch } from 'lucide-react';
import { ui, useCheckMaintenanceBlocked } from '@curvenote/scms-core';

type RunCheckOnLatestVersionButtonProps = {
  /** POST target (extension checksActionPath or platform fallback). */
  actionPath: string;
  /** Latest non-draft work version id to run the check against. */
  workVersionId: string;
  checkServiceId: string;
};

/**
 * Header action shown when a check service's latest run is from an older version.
 * Submits `intent=execute` for the given `workVersionId`, mirroring the "Run checks now"
 * CTA rendered inside extension activity placeholder panels.
 */
export function RunCheckOnLatestVersionButton({
  actionPath,
  workVersionId,
  checkServiceId,
}: RunCheckOnLatestVersionButtonProps) {
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state === 'submitting';
  const { blocked, message } = useCheckMaintenanceBlocked(checkServiceId);

  return (
    <ui.MaintenanceTooltip enabled={blocked} message={message}>
      <fetcher.Form method="post" action={actionPath}>
        <input type="hidden" name="workVersionId" value={workVersionId} />
        <ui.StatefulButton
          type="submit"
          variant="default"
          size="sm"
          name="intent"
          value="execute"
          busy={isSubmitting}
          disabled={blocked}
        >
          <span className="flex gap-1 items-center">
            <GitBranch className="w-3 h-3" aria-hidden />
            Check Latest Version
          </span>
        </ui.StatefulButton>
      </fetcher.Form>
    </ui.MaintenanceTooltip>
  );
}
