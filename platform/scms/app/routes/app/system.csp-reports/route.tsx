import type { Route } from './+types/route';
import { Form, useActionData } from 'react-router';
import { useEffect } from 'react';
import { withAppAdminContext, withValidFormData } from '@curvenote/scms-server';
import { PageFrame, getBrandingFromMetaMatches, joinPageTitle, ui } from '@curvenote/scms-core';
import { Trash2, ShieldAlert } from 'lucide-react';
import { z } from 'zod';
import { zfd } from 'zod-form-data';
import {
  dbClearCspViolationReports,
  dbCountCspViolationReports,
  dbDeleteCspViolationReport,
  dbGetCspViolationReports,
  type CspViolationReportDTO,
} from './db.server';

const FormSchema = zfd.formData({
  intent: z.enum(['delete-one', 'clear-all']),
  id: zfd.text(z.string().optional()),
});

export const meta: Route.MetaFunction = ({ matches }) => {
  const branding = getBrandingFromMetaMatches(matches);
  return [{ title: joinPageTitle('CSP Reports', 'System Administration', branding.title) }];
};

export async function loader(args: Route.LoaderArgs) {
  await withAppAdminContext(args, { redirectTo: '/app' });
  const [reports, total] = await Promise.all([
    dbGetCspViolationReports(),
    dbCountCspViolationReports(),
  ]);
  return { reports, total };
}

export async function action(args: Route.ActionArgs) {
  await withAppAdminContext(args);
  const formData = await args.request.formData();
  return withValidFormData(FormSchema, formData, async (payload) => {
    switch (payload.intent) {
      case 'delete-one': {
        if (!payload.id) throw new Error('id is required for delete-one');
        await dbDeleteCspViolationReport(payload.id);
        return { success: true, message: 'Report deleted' };
      }
      case 'clear-all': {
        const { count } = await dbClearCspViolationReports();
        return { success: true, message: `Cleared ${count} report${count === 1 ? '' : 's'}` };
      }
      default:
        throw new Error('Invalid intent');
    }
  });
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function directiveBadgeVariant(
  directive: string | null | undefined,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (!directive) return 'outline';
  if (directive.startsWith('script-')) return 'destructive';
  if (directive.startsWith('frame-')) return 'destructive';
  if (directive.startsWith('style-') || directive.startsWith('font-')) return 'secondary';
  return 'default';
}

function ReportRow({ report }: { report: CspViolationReportDTO }) {
  return (
    <tr className="border-b last:border-b-0">
      <td className="py-2 pr-3 align-top whitespace-nowrap">
        <ui.Badge variant={directiveBadgeVariant(report.effective_directive)}>
          {report.effective_directive ?? 'unknown'}
        </ui.Badge>
      </td>
      <td className="py-2 pr-3 align-top">
        <span className="font-mono text-xs break-all">{report.blocked_origin ?? '—'}</span>
        {report.blocked_uri && report.blocked_uri !== report.blocked_origin && (
          <div
            className="font-mono text-xs break-all text-muted-foreground"
            title={report.blocked_uri}
          >
            {report.blocked_uri}
          </div>
        )}
      </td>
      <td className="py-2 pr-3 align-top">
        <span className="font-mono text-xs break-all">{report.document_path ?? '—'}</span>
      </td>
      <td className="py-2 pr-3 tabular-nums text-right align-top">{report.count}</td>
      <td className="py-2 pr-3 align-top whitespace-nowrap text-xs text-muted-foreground">
        {formatDate(report.date_first_seen)}
      </td>
      <td className="py-2 pr-3 align-top whitespace-nowrap text-xs text-muted-foreground">
        {formatDate(report.date_last_seen)}
      </td>
      <td className="py-2 align-top whitespace-nowrap">
        <Form method="post" className="inline">
          <input type="hidden" name="intent" value="delete-one" />
          <input type="hidden" name="id" value={report.id} />
          <ui.Button type="submit" variant="ghost" size="sm" className="text-destructive">
            <Trash2 className="w-4 h-4" />
          </ui.Button>
        </Form>
      </td>
    </tr>
  );
}

export default function CspReportsAdmin({ loaderData }: Route.ComponentProps) {
  const { reports, total } = loaderData;
  const actionData = useActionData<typeof action>();

  useEffect(() => {
    if (!actionData) return;
    if ('success' in actionData && actionData.success && 'message' in actionData) {
      ui.toastSuccess(actionData.message);
    } else if ('error' in actionData && actionData.error) {
      ui.toastError(actionData.error.message);
    }
  }, [actionData]);

  return (
    <PageFrame title="CSP Reports">
      <div className="space-y-6">
        <ui.Card className="p-6 bg-card">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <ShieldAlert className="w-5 h-5" />
                Content Security Policy violations
              </h2>
              <p className="text-sm text-muted-foreground">
                Aggregated violation reports submitted by browsers to{' '}
                <code className="font-mono text-xs">/app/resources/csp-report</code>. Rows are
                deduplicated on <code className="font-mono text-xs">directive</code>,{' '}
                <code className="font-mono text-xs">blocked origin</code>,{' '}
                <code className="font-mono text-xs">document path</code>, and{' '}
                <code className="font-mono text-xs">disposition</code>.
              </p>
              <p className="text-sm text-muted-foreground">
                Showing {reports.length} of {total}
                {total > reports.length ? ` (top ${reports.length} by last seen)` : ''}.
              </p>
            </div>
            <Form method="post">
              <input type="hidden" name="intent" value="clear-all" />
              <ui.Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={total === 0}
                onClick={(e) => {
                  if (!window.confirm('Clear all CSP violation reports?')) e.preventDefault();
                }}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Clear all
              </ui.Button>
            </Form>
          </div>
        </ui.Card>

        <ui.Card className="p-6 bg-card">
          {reports.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">No CSP violations recorded.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Violations submitted by browsers will appear here, aggregated and counted.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Directive</th>
                    <th className="py-2 pr-3 font-medium">Blocked origin</th>
                    <th className="py-2 pr-3 font-medium">Document path</th>
                    <th className="py-2 pr-3 font-medium text-right">Count</th>
                    <th className="py-2 pr-3 font-medium">First seen</th>
                    <th className="py-2 pr-3 font-medium">Last seen</th>
                    <th className="py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <ReportRow key={report.id} report={report} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ui.Card>
      </div>
    </PageFrame>
  );
}
