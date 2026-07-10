import { useFetcher } from 'react-router';
import { GitBranch } from 'lucide-react';
import { ui, useCheckMaintenanceBlocked } from '@curvenote/scms-core';

type RunCheckOnLatestVersionButtonProps = {
  /** POST target (extension checksActionPath or platform fallback). */
  actionPath: string;
  /** Latest non-draft work version id to run the check against. */
  workVersionId: string;
  checkServiceId: string;
  /** 1-based version number for the target work version (shown in the button). */
  versionNumber: number;
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
  versionNumber,
}: RunCheckOnLatestVersionButtonProps) {
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state === 'submitting';
  const { blocked, message } = useCheckMaintenanceBlocked(checkServiceId);

  return (
    <ui.MaintenanceTooltip enabled={blocked} message={message}>
      <fetcher.Form method="post" action={actionPath}>
        <input type="hidden" name="workVersionId" value={workVersionId} />
        <input type="hidden" name="checkServiceId" value={checkServiceId} />
        <ui.StatefulButton
          type="submit"
          variant="default"
          size="sm"
          name="intent"
          value="execute"
          busy={isSubmitting}
          disabled={blocked}
        >
          <span className="flex gap-1.5 items-center">
            <ui.VersionTagBadge
              tag={`v${versionNumber}`}
              titlePrefix="Version"
              icon={GitBranch}
              compact
            />
            Check Latest Version
          </span>
        </ui.StatefulButton>
      </fetcher.Form>
    </ui.MaintenanceTooltip>
  );
}
