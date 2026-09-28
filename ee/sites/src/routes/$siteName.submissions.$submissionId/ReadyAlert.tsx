import { ui } from '@curvenote/scms-core';
import type { DepositIssue } from '../../backend/deposit/types.js';

type ReadyAlertProps = {
  warnings: DepositIssue[];
};

/** The design has no slot for warnings, so they ride on the ready callout. */
export function ReadyAlert({ warnings }: ReadyAlertProps) {
  if (warnings.length === 0) {
    return (
      <ui.SimpleAlert
        type="success"
        size="compact"
        message={
          <>
            <strong>Ready to register</strong>
            <br />
            All required information is available.
          </>
        }
      />
    );
  }
  return (
    <ui.SimpleAlert
      type="warning"
      size="compact"
      message={
        <>
          <strong>Ready to register</strong>
          <br />
          This DOI can be registered, but some recommended metadata will not be included:
          <ul className="pl-5 mt-1 mb-0 list-disc [&>li]:my-0">
            {warnings.map((issue, index) => (
              <li key={`${issue.code}-${index}`}>{issue.message}</li>
            ))}
          </ul>
        </>
      }
    />
  );
}
