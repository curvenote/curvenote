import type { Route } from './+types/route';
import { withAppAdminContext } from '@curvenote/scms-server';
import { PageFrame, SystemAdminBadge, ui, primitives, FrameHeader } from '@curvenote/scms-core';
import type { Workflow } from '@curvenote/scms-core';
import { Palette, ExternalLink } from 'lucide-react';

export async function loader(args: Route.LoaderArgs) {
  await withAppAdminContext(args);
  return null;
}

export const meta: Route.MetaFunction = () => {
  return [{ title: 'Design System - Curvenote' }];
};

function ComponentSection({
  id,
  title,
  children,
  note,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="mb-12" id={id}>
      <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>
      {note && <p className="mb-4 text-sm italic text-gray-600 dark:text-gray-400">{note}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {children}
      </div>
    </div>
  );
}

function ComponentCard({
  component,
  title,
  metadata,
  sourceUrl,
}: {
  component: React.ReactNode;
  title: string;
  metadata: string;
  sourceUrl?: string;
}) {
  return (
    <div className="relative flex flex-col items-center p-4 space-y-3 bg-white border border-gray-200 rounded-lg dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-center min-h-[40px]">{component}</div>
      <div className="space-y-1 text-center">
        <div className="text-sm font-medium text-gray-900 dark:text-white">{title}</div>
        <div className="font-mono text-xs text-gray-600 break-words dark:text-gray-400">
          {metadata}
        </div>
      </div>
      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute flex items-center gap-1 text-xs text-blue-600 transition-colors right-2 bottom-2 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
        >
          go to source
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

function TableOfContents() {
  const sections = [
    { id: 'toast', title: 'Toast' },
    { id: 'simple-alerts', title: 'Simple Alerts' },
    { id: 'chips', title: 'Chips' },
    { id: 'badge', title: 'Badge' },
    { id: 'submission-badge-default', title: 'Submission Badge - Default' },
    { id: 'submission-badge-outline', title: 'Submission Badge - Outline' },
    { id: 'submission-badge-with-link-default', title: 'With Link (Default)' },
    { id: 'submission-badge-with-link-outline', title: 'With Link (Outline)' },
    { id: 'submission-badge-with-site-default', title: 'With Site (Default)' },
    { id: 'submission-badge-with-site-outline', title: 'With Site (Outline)' },
  ];

  const handleClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="p-4 mb-8 bg-white border border-gray-200 rounded-lg dark:border-gray-700 dark:bg-gray-900">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        Table of Contents
      </h2>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {sections.map((section, index) => (
          <div key={section.id} className="flex items-center">
            <button
              onClick={() => handleClick(section.id)}
              className="text-blue-600 transition-colors dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
            >
              {section.title}
            </button>
            {index < sections.length - 1 && (
              <span className="ml-2 text-gray-400 dark:text-gray-600">•</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Mock data for SubmissionVersionBadge
const mockSubmissionVersion = {
  id: 'sv-123',
  status: 'published',
  submission: {
    id: 'sub-456',
    site: {
      name: 'cn-testing',
      title: 'CN Testing',
      metadata: {
        logo: 'https://cdn.curvenote.com/static/site/curvenote/logo-icon-blue.svg',
      },
    },
    collection: {
      workflow: 'peer-review',
    },
  },
};

const mockWorkflows: Record<string, Workflow> = {
  'peer-review': {
    version: 1,
    name: 'peer-review',
    label: 'Peer Review Workflow',
    initialState: 'draft',
    states: {
      draft: {
        name: 'draft',
        label: 'Draft',
        tags: [],
        authorOnly: true,
        inbox: false,
        visible: false,
        published: false,
      },
      submitted: {
        name: 'submitted',
        label: 'Under Review',
        tags: [],
        authorOnly: false,
        inbox: true,
        visible: true,
        published: false,
      },
      published: {
        name: 'published',
        label: 'Published',
        tags: ['end'],
        authorOnly: false,
        inbox: false,
        visible: true,
        published: true,
      },
      rejected: {
        name: 'rejected',
        label: 'Rejected',
        tags: ['end', 'error'],
        authorOnly: false,
        inbox: false,
        visible: true,
        published: false,
      },
      'revision-required': {
        name: 'revision-required',
        label: 'Revision Required',
        tags: ['warning'],
        authorOnly: false,
        inbox: true,
        visible: true,
        published: false,
      },
    },
    transitions: [],
  },
};

export default function SystemDesign() {
  return (
    <PageFrame
      header={<FrameHeader icon={<Palette />} title="Design" subtitle="Standard UI components" />}
    >
      <SystemAdminBadge />

      <div className="mx-auto space-y-12 max-w-7xl">
        <TableOfContents />

        {/* Toast Section */}
        <ComponentSection id="toast" title="Toast">
          <ComponentCard
            component={
              <ui.Button
                onClick={() =>
                  ui.toastInfo('This is an info message', {
                    description: 'Additional details about the information',
                  })
                }
                variant="outline"
              >
                Show Info Toast
              </ui.Button>
            }
            title="Info"
            metadata="toastInfo(message, options)"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/toast.tsx"
          />

          <ComponentCard
            component={
              <ui.Button
                onClick={() =>
                  ui.toastSuccess('Operation completed successfully!', {
                    description: 'Your changes have been saved',
                  })
                }
                variant="outline"
                className="text-green-700 border-green-200 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950"
              >
                Show Success Toast
              </ui.Button>
            }
            title="Success"
            metadata="toastSuccess(message, options)"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/toast.tsx"
          />

          <ComponentCard
            component={
              <ui.Button
                onClick={() =>
                  ui.toastWarning('Please check your input', {
                    description: 'Some fields require your attention',
                  })
                }
                variant="outline"
                className="text-yellow-700 border-yellow-200 hover:bg-yellow-50 dark:border-yellow-800 dark:text-yellow-400 dark:hover:bg-yellow-950"
              >
                Show Warning Toast
              </ui.Button>
            }
            title="Warning"
            metadata="toastWarning(message, options)"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/toast.tsx"
          />

          <ComponentCard
            component={
              <ui.Button
                onClick={() =>
                  ui.toastError('Something went wrong', {
                    description: 'Please try again later or contact support',
                  })
                }
                variant="outline"
                className="text-red-700 border-red-200 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
              >
                Show Error Toast
              </ui.Button>
            }
            title="Error"
            metadata="toastError(message, options)"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/toast.tsx"
          />
        </ComponentSection>

        {/* Simple Alerts Section */}
        <div className="mb-12" id="simple-alerts">
          <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
            Simple Alerts
          </h2>
          <div className="grid max-w-2xl grid-cols-1 gap-4">
            <ComponentCard
              component={
                <ui.SimpleAlert
                  type="info"
                  size="compact"
                  message="This is an informational message to provide context about an action."
                />
              }
              title="Info (Compact)"
              metadata='type="info" size="compact"'
              sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SimpleAlert.tsx"
            />

            <ComponentCard
              component={
                <ui.SimpleAlert
                  type="success"
                  size="compact"
                  message="Operation completed successfully! Your changes have been saved."
                />
              }
              title="Success (Compact)"
              metadata='type="success" size="compact"'
              sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SimpleAlert.tsx"
            />

            <ComponentCard
              component={
                <ui.SimpleAlert
                  type="warning"
                  size="compact"
                  message="Please review your input. Some fields may require attention."
                />
              }
              title="Warning (Compact)"
              metadata='type="warning" size="compact"'
              sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SimpleAlert.tsx"
            />

            <ComponentCard
              component={
                <ui.SimpleAlert
                  type="error"
                  size="compact"
                  message="An error occurred while processing your request. Please try again."
                />
              }
              title="Error (Compact)"
              metadata='type="error" size="compact"'
              sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SimpleAlert.tsx"
            />

            <ComponentCard
              component={
                <ui.SimpleAlert
                  type="neutral"
                  size="normal"
                  message="This is a neutral message that provides general information."
                />
              }
              title="Neutral (Normal)"
              metadata='type="neutral" size="normal"'
              sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SimpleAlert.tsx"
            />
          </div>
        </div>

        {/* Chips Section */}
        <ComponentSection id="chips" title="Chips">
          <ComponentCard
            component={
              <primitives.Chip className="text-stone-800 dark:text-white dark:bg-stone-500 bg-stone-200">
                Default Chip
              </primitives.Chip>
            }
            title="Default"
            metadata="text-stone-800 dark:text-white dark:bg-stone-500 bg-stone-200"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/primitives/Chip.tsx"
          />

          <ComponentCard
            component={
              <primitives.Chip className="text-white bg-green-600">Published</primitives.Chip>
            }
            title="Published"
            metadata="text-white bg-green-600"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/ee/sites/src/components/Chips.tsx#L6-L19"
          />

          <ComponentCard
            component={
              <primitives.Chip className="text-white bg-red-800 dark:bg-red-500">
                Retracted
              </primitives.Chip>
            }
            title="Retracted"
            metadata="text-white bg-red-800 dark:bg-red-500"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/ee/sites/src/components/Chips.tsx#L21-L32"
          />

          <ComponentCard
            component={
              <primitives.Chip className="text-white bg-sky-600 border-[1px] border-sky-600 dark:border-sky-600 dark:bg-sky-600">
                my-article-slug
              </primitives.Chip>
            }
            title="Slug"
            metadata="text-white bg-sky-600 border-[1px] border-sky-600"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/ee/sites/src/components/Chips.tsx#L34-L44"
          />

          <ComponentCard
            component={
              <primitives.Chip className="text-sky-700 border-[1px] border-sky-700 dark:border-sky-300 dark:text-sky-300">
                Research Article
              </primitives.Chip>
            }
            title="Submission Kind"
            metadata="text-sky-700 border-[1px] border-sky-700 dark:border-sky-300 dark:text-sky-300"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/ee/sites/src/components/Chips.tsx#L66-L85"
          />

          <ComponentCard
            component={
              <primitives.Chip className="text-sky-700 border-[1px] border-sky-700 dark:border-sky-300 dark:text-sky-300">
                Special Issue: AI Research
              </primitives.Chip>
            }
            title="Collection"
            metadata="text-sky-700 border-[1px] border-sky-700 dark:border-sky-300 dark:text-sky-300"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/ee/sites/src/components/Chips.tsx#L46-L64"
          />

          <ComponentCard
            component={
              <primitives.Chip className="text-black bg-gray-200 dark:bg-gray-600 dark:text-white">
                3 days ago
              </primitives.Chip>
            }
            title="Age"
            metadata="text-black bg-gray-200 dark:bg-gray-600 dark:text-white"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/ee/sites/src/components/Chips.tsx#L87-L97"
          />

          <ComponentCard
            component={
              <primitives.Chip className="text-gray-500 border-[1px] border-gray-200 dark:border-gray-500 dark:text-gray-500">
                2 weeks ago
              </primitives.Chip>
            }
            title="Last Activity"
            metadata="text-gray-500 border-[1px] border-gray-200 dark:border-gray-500"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/platform/scms/app/routes/app/works._index/WorkListItem.tsx#L137-L142"
          />
        </ComponentSection>

        {/* Badge Section */}
        <ComponentSection id="badge" title="Badge">
          <ComponentCard
            component={<ui.Badge>Default Badge</ui.Badge>}
            title="Default"
            metadata="variant='default'"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/badge.tsx"
          />

          <ComponentCard
            component={<ui.Badge variant="primary">Primary Badge</ui.Badge>}
            title="Primary"
            metadata="variant='primary'"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/badge.tsx#L13"
          />

          <ComponentCard
            component={<ui.Badge variant="secondary">Secondary Badge</ui.Badge>}
            title="Secondary"
            metadata="variant='secondary'"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/badge.tsx#L14-L15"
          />

          <ComponentCard
            component={<ui.Badge variant="destructive">Destructive Badge</ui.Badge>}
            title="Destructive"
            metadata="variant='destructive'"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/badge.tsx#L16-L17"
          />

          <ComponentCard
            component={<ui.Badge variant="outline">Outline Badge</ui.Badge>}
            title="Outline"
            metadata="variant='outline'"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/badge.tsx#L19-L20"
          />

          <ComponentCard
            component={<ui.Badge variant="outline-muted">Outline Muted</ui.Badge>}
            title="Outline Muted"
            metadata="variant='outline-muted'"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/badge.tsx#L21-L22"
          />

          <ComponentCard
            component={<ui.Badge variant="warning">Warning Badge</ui.Badge>}
            title="Warning"
            metadata="variant='warning'"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/badge.tsx#L23-L24"
          />

          <ComponentCard
            component={<ui.Badge variant="success">Success Badge</ui.Badge>}
            title="Success"
            metadata="variant='success'"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/badge.tsx#L25-L26"
          />

          <ComponentCard
            component={<ui.Badge variant="mono-dark">Mono Dark</ui.Badge>}
            title="Mono Dark"
            metadata="variant='mono-dark'"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/badge.tsx#L27-L28"
          />

          <ComponentCard
            component={<ui.Badge variant="mono-light">Mono Light</ui.Badge>}
            title="Mono Light"
            metadata="variant='mono-light'"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/badge.tsx#L29-L30"
          />
        </ComponentSection>

        {/* Submission Version Badge - Default Variant */}
        <ComponentSection id="submission-badge-default" title="Submission Version Badge - Default">
          <ComponentCard
            component={
              <ui.SubmissionVersionBadge
                submissionVersion={{
                  ...mockSubmissionVersion,
                  status: 'draft',
                }}
                workflows={mockWorkflows}
                basePath="/app"
                workVersionId="wv-123"
                showLink={false}
                variant="default"
              />
            }
            title="Draft"
            metadata="status='draft' variant='default' showLink=false"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SubmissionVersionBadge.tsx"
          />

          <ComponentCard
            component={
              <ui.SubmissionVersionBadge
                submissionVersion={{
                  ...mockSubmissionVersion,
                  status: 'submitted',
                }}
                workflows={mockWorkflows}
                basePath="/app"
                workVersionId="wv-123"
                showLink={false}
                variant="default"
              />
            }
            title="Under Review"
            metadata="status='submitted' variant='default' showLink=false"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SubmissionVersionBadge.tsx"
          />

          <ComponentCard
            component={
              <ui.SubmissionVersionBadge
                submissionVersion={{
                  ...mockSubmissionVersion,
                  status: 'published',
                }}
                workflows={mockWorkflows}
                basePath="/app"
                workVersionId="wv-123"
                showLink={false}
                variant="default"
              />
            }
            title="Published"
            metadata="status='published' variant='default' showLink=false"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SubmissionVersionBadge.tsx"
          />

          <ComponentCard
            component={
              <ui.SubmissionVersionBadge
                submissionVersion={{
                  ...mockSubmissionVersion,
                  status: 'rejected',
                }}
                workflows={mockWorkflows}
                basePath="/app"
                workVersionId="wv-123"
                showLink={false}
                variant="default"
              />
            }
            title="Rejected"
            metadata="status='rejected' variant='default' showLink=false"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SubmissionVersionBadge.tsx"
          />

          <ComponentCard
            component={
              <ui.SubmissionVersionBadge
                submissionVersion={{
                  ...mockSubmissionVersion,
                  status: 'revision-required',
                }}
                workflows={mockWorkflows}
                basePath="/app"
                workVersionId="wv-123"
                showLink={false}
                variant="default"
              />
            }
            title="Revision Required"
            metadata="status='revision-required' variant='default' showLink=false"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SubmissionVersionBadge.tsx"
          />
        </ComponentSection>

        {/* Submission Version Badge - Outline Variant */}
        <ComponentSection id="submission-badge-outline" title="Submission Version Badge - Outline">
          <ComponentCard
            component={
              <ui.SubmissionVersionBadge
                submissionVersion={{
                  ...mockSubmissionVersion,
                  status: 'draft',
                }}
                workflows={mockWorkflows}
                basePath="/app"
                workVersionId="wv-123"
                showLink={false}
                variant="outline"
              />
            }
            title="Draft"
            metadata="status='draft' variant='outline' showLink=false"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SubmissionVersionBadge.tsx#L65-L84"
          />

          <ComponentCard
            component={
              <ui.SubmissionVersionBadge
                submissionVersion={{
                  ...mockSubmissionVersion,
                  status: 'submitted',
                }}
                workflows={mockWorkflows}
                basePath="/app"
                workVersionId="wv-123"
                showLink={false}
                variant="outline"
              />
            }
            title="Under Review"
            metadata="status='submitted' variant='outline' showLink=false"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SubmissionVersionBadge.tsx#L65-L84"
          />

          <ComponentCard
            component={
              <ui.SubmissionVersionBadge
                submissionVersion={{
                  ...mockSubmissionVersion,
                  status: 'published',
                }}
                workflows={mockWorkflows}
                basePath="/app"
                workVersionId="wv-123"
                showLink={false}
                variant="outline"
              />
            }
            title="Published"
            metadata="status='published' variant='outline' showLink=false"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SubmissionVersionBadge.tsx#L65-L84"
          />

          <ComponentCard
            component={
              <ui.SubmissionVersionBadge
                submissionVersion={{
                  ...mockSubmissionVersion,
                  status: 'rejected',
                }}
                workflows={mockWorkflows}
                basePath="/app"
                workVersionId="wv-123"
                showLink={false}
                variant="outline"
              />
            }
            title="Rejected"
            metadata="status='rejected' variant='outline' showLink=false"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SubmissionVersionBadge.tsx#L65-L84"
          />

          <ComponentCard
            component={
              <ui.SubmissionVersionBadge
                submissionVersion={{
                  ...mockSubmissionVersion,
                  status: 'revision-required',
                }}
                workflows={mockWorkflows}
                basePath="/app"
                workVersionId="wv-123"
                showLink={false}
                variant="outline"
              />
            }
            title="Revision Required"
            metadata="status='revision-required' variant='outline' showLink=false"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SubmissionVersionBadge.tsx#L65-L84"
          />
        </ComponentSection>

        {/* Submission Version Badge - With Link (Default) */}
        <ComponentSection
          id="submission-badge-with-link-default"
          title="Submission Version Badge - With Link (Default)"
          note="These components have hover effects when you interact with them."
        >
          <ComponentCard
            component={
              <ui.SubmissionVersionBadge
                submissionVersion={{
                  ...mockSubmissionVersion,
                  status: 'draft',
                }}
                workflows={mockWorkflows}
                basePath="/app"
                workVersionId="wv-123"
                showLink={true}
                variant="default"
              />
            }
            title="Draft"
            metadata="status='draft' variant='default' showLink=true"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SubmissionVersionBadge.tsx#L115-L127"
          />

          <ComponentCard
            component={
              <ui.SubmissionVersionBadge
                submissionVersion={{
                  ...mockSubmissionVersion,
                  status: 'submitted',
                }}
                workflows={mockWorkflows}
                basePath="/app"
                workVersionId="wv-123"
                showLink={true}
                variant="default"
              />
            }
            title="Under Review"
            metadata="status='submitted' variant='default' showLink=true"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SubmissionVersionBadge.tsx#L115-L127"
          />

          <ComponentCard
            component={
              <ui.SubmissionVersionBadge
                submissionVersion={{
                  ...mockSubmissionVersion,
                  status: 'published',
                }}
                workflows={mockWorkflows}
                basePath="/app"
                workVersionId="wv-123"
                showLink={true}
                variant="default"
              />
            }
            title="Published"
            metadata="status='published' variant='default' showLink=true"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SubmissionVersionBadge.tsx#L115-L127"
          />

          <ComponentCard
            component={
              <ui.SubmissionVersionBadge
                submissionVersion={{
                  ...mockSubmissionVersion,
                  status: 'rejected',
                }}
                workflows={mockWorkflows}
                basePath="/app"
                workVersionId="wv-123"
                showLink={true}
                variant="default"
              />
            }
            title="Rejected"
            metadata="status='rejected' variant='default' showLink=true"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SubmissionVersionBadge.tsx#L115-L127"
          />

          <ComponentCard
            component={
              <ui.SubmissionVersionBadge
                submissionVersion={{
                  ...mockSubmissionVersion,
                  status: 'revision-required',
                }}
                workflows={mockWorkflows}
                basePath="/app"
                workVersionId="wv-123"
                showLink={true}
                variant="default"
              />
            }
            title="Revision Required"
            metadata="status='revision-required' variant='default' showLink=true"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SubmissionVersionBadge.tsx#L115-L127"
          />
        </ComponentSection>

        {/* Submission Version Badge - With Link (Outline) */}
        <ComponentSection
          id="submission-badge-with-link-outline"
          title="Submission Version Badge - With Link (Outline)"
          note="These components have hover effects when you interact with them."
        >
          <ComponentCard
            component={
              <ui.SubmissionVersionBadge
                submissionVersion={{
                  ...mockSubmissionVersion,
                  status: 'draft',
                }}
                workflows={mockWorkflows}
                basePath="/app"
                workVersionId="wv-123"
                showLink={true}
                variant="outline"
              />
            }
            title="Draft"
            metadata="status='draft' variant='outline' showLink=true"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SubmissionVersionBadge.tsx#L115-L127"
          />

          <ComponentCard
            component={
              <ui.SubmissionVersionBadge
                submissionVersion={{
                  ...mockSubmissionVersion,
                  status: 'submitted',
                }}
                workflows={mockWorkflows}
                basePath="/app"
                workVersionId="wv-123"
                showLink={true}
                variant="outline"
              />
            }
            title="Under Review"
            metadata="status='submitted' variant='outline' showLink=true"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SubmissionVersionBadge.tsx#L115-L127"
          />

          <ComponentCard
            component={
              <ui.SubmissionVersionBadge
                submissionVersion={{
                  ...mockSubmissionVersion,
                  status: 'published',
                }}
                workflows={mockWorkflows}
                basePath="/app"
                workVersionId="wv-123"
                showLink={true}
                variant="outline"
              />
            }
            title="Published"
            metadata="status='published' variant='outline' showLink=true"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SubmissionVersionBadge.tsx#L115-L127"
          />

          <ComponentCard
            component={
              <ui.SubmissionVersionBadge
                submissionVersion={{
                  ...mockSubmissionVersion,
                  status: 'rejected',
                }}
                workflows={mockWorkflows}
                basePath="/app"
                workVersionId="wv-123"
                showLink={true}
                variant="outline"
              />
            }
            title="Rejected"
            metadata="status='rejected' variant='outline' showLink=true"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SubmissionVersionBadge.tsx#L115-L127"
          />

          <ComponentCard
            component={
              <ui.SubmissionVersionBadge
                submissionVersion={{
                  ...mockSubmissionVersion,
                  status: 'revision-required',
                }}
                workflows={mockWorkflows}
                basePath="/app"
                workVersionId="wv-123"
                showLink={true}
                variant="outline"
              />
            }
            title="Revision Required"
            metadata="status='revision-required' variant='outline' showLink=true"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SubmissionVersionBadge.tsx#L115-L127"
          />
        </ComponentSection>

        {/* Submission Version Badge - With Site (Default) */}
        <ComponentSection
          id="submission-badge-with-site-default"
          title="Submission Version Badge - With Site (Default)"
          note="These components have hover effects when you interact with them."
        >
          <ComponentCard
            component={
              <ui.SubmissionVersionBadge
                submissionVersion={{
                  ...mockSubmissionVersion,
                  status: 'draft',
                }}
                workflows={mockWorkflows}
                basePath="/app"
                workVersionId="wv-123"
                showSite={true}
                variant="default"
              />
            }
            title="Draft"
            metadata="status='draft' variant='default' showSite=true"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SubmissionVersionBadge.tsx#L89-L101"
          />

          <ComponentCard
            component={
              <ui.SubmissionVersionBadge
                submissionVersion={{
                  ...mockSubmissionVersion,
                  status: 'submitted',
                }}
                workflows={mockWorkflows}
                basePath="/app"
                workVersionId="wv-123"
                showSite={true}
                variant="default"
              />
            }
            title="Under Review"
            metadata="status='submitted' variant='default' showSite=true"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SubmissionVersionBadge.tsx#L89-L101"
          />

          <ComponentCard
            component={
              <ui.SubmissionVersionBadge
                submissionVersion={{
                  ...mockSubmissionVersion,
                  status: 'published',
                }}
                workflows={mockWorkflows}
                basePath="/app"
                workVersionId="wv-123"
                showSite={true}
                variant="default"
              />
            }
            title="Published"
            metadata="status='published' variant='default' showSite=true"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SubmissionVersionBadge.tsx#L89-L101"
          />

          <ComponentCard
            component={
              <ui.SubmissionVersionBadge
                submissionVersion={{
                  ...mockSubmissionVersion,
                  status: 'rejected',
                }}
                workflows={mockWorkflows}
                basePath="/app"
                workVersionId="wv-123"
                showSite={true}
                variant="default"
              />
            }
            title="Rejected"
            metadata="status='rejected' variant='default' showSite=true"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SubmissionVersionBadge.tsx#L89-L101"
          />

          <ComponentCard
            component={
              <ui.SubmissionVersionBadge
                submissionVersion={{
                  ...mockSubmissionVersion,
                  status: 'revision-required',
                }}
                workflows={mockWorkflows}
                basePath="/app"
                workVersionId="wv-123"
                showSite={true}
                variant="default"
              />
            }
            title="Revision Required"
            metadata="status='revision-required' variant='default' showSite=true"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SubmissionVersionBadge.tsx#L89-L101"
          />
        </ComponentSection>

        {/* Submission Version Badge - With Site (Outline) */}
        <ComponentSection
          id="submission-badge-with-site-outline"
          title="Submission Version Badge - With Site (Outline)"
          note="These components have hover effects when you interact with them."
        >
          <ComponentCard
            component={
              <ui.SubmissionVersionBadge
                submissionVersion={{
                  ...mockSubmissionVersion,
                  status: 'draft',
                }}
                workflows={mockWorkflows}
                basePath="/app"
                workVersionId="wv-123"
                showSite={true}
                variant="outline"
              />
            }
            title="Draft"
            metadata="status='draft' variant='outline' showSite=true"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SubmissionVersionBadge.tsx#L89-L101"
          />

          <ComponentCard
            component={
              <ui.SubmissionVersionBadge
                submissionVersion={{
                  ...mockSubmissionVersion,
                  status: 'submitted',
                }}
                workflows={mockWorkflows}
                basePath="/app"
                workVersionId="wv-123"
                showSite={true}
                variant="outline"
              />
            }
            title="Under Review"
            metadata="status='submitted' variant='outline' showSite=true"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SubmissionVersionBadge.tsx#L89-L101"
          />

          <ComponentCard
            component={
              <ui.SubmissionVersionBadge
                submissionVersion={{
                  ...mockSubmissionVersion,
                  status: 'published',
                }}
                workflows={mockWorkflows}
                basePath="/app"
                workVersionId="wv-123"
                showSite={true}
                variant="outline"
              />
            }
            title="Published"
            metadata="status='published' variant='outline' showSite=true"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SubmissionVersionBadge.tsx#L89-L101"
          />

          <ComponentCard
            component={
              <ui.SubmissionVersionBadge
                submissionVersion={{
                  ...mockSubmissionVersion,
                  status: 'rejected',
                }}
                workflows={mockWorkflows}
                basePath="/app"
                workVersionId="wv-123"
                showSite={true}
                variant="outline"
              />
            }
            title="Rejected"
            metadata="status='rejected' variant='outline' showSite=true"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SubmissionVersionBadge.tsx#L89-L101"
          />

          <ComponentCard
            component={
              <ui.SubmissionVersionBadge
                submissionVersion={{
                  ...mockSubmissionVersion,
                  status: 'revision-required',
                }}
                workflows={mockWorkflows}
                basePath="/app"
                workVersionId="wv-123"
                showSite={true}
                variant="outline"
              />
            }
            title="Revision Required"
            metadata="status='revision-required' variant='outline' showSite=true"
            sourceUrl="https://github.com/curvenote/curvenote/blob/dev/packages/scms-core/src/components/ui/SubmissionVersionBadge.tsx#L89-L101"
          />
        </ComponentSection>
      </div>
    </PageFrame>
  );
}
