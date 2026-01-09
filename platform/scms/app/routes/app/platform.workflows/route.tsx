import type { Route } from './+types/route';
import { withAppPlatformAdminContext } from '@curvenote/scms-server';
import {
  primitives,
  ui,
  PageFrame,
  getWorkflows,
  getWorkflowNames,
  validateWorkflows,
  registerExtensionWorkflows,
} from '@curvenote/scms-core';
import { extensions } from '../../../extensions/client';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAppPlatformAdminContext(args, { redirectTo: '/app' });
  const extensionWorkflows = registerExtensionWorkflows(extensions);
  // Validate workflows and get any missing ones (pass extensions for proper missing detection)
  const missingWorkflows = validateWorkflows(ctx.$config, extensionWorkflows, extensions);

  // Get all registered workflows
  const workflows = getWorkflows(ctx.$config, extensionWorkflows);
  const workflowNames = getWorkflowNames(ctx.$config, extensionWorkflows);

  // Build status information for each workflow
  const workflowStatus = workflowNames.map((name: string) => {
    const isExtension = name.includes(':');
    const [extensionName, workflowName] = isExtension ? name.split(':') : [undefined, name];

    return {
      name: workflowName,
      isExtension,
      extensionName,
      workflow: workflows[name],
    };
  });

  return {
    workflowStatus,
    missingWorkflows,
    totalWorkflows: workflowNames.length,
    hasMissingWorkflows: missingWorkflows.length > 0,
  };
}

type WorkflowStatus = Awaited<ReturnType<typeof loader>>['workflowStatus'][number];

function WorkflowCard({ name, isExtension, extensionName, workflow }: WorkflowStatus) {
  return (
    <primitives.Card className="p-0">
      <ui.Accordion type="single" collapsible>
        <ui.AccordionItem value="workflow" className="border-none">
          <ui.AccordionTrigger className="items-center px-4 cursor-pointer hover:no-underline">
            <div className="flex items-center justify-between w-full">
              <div>
                <h2 className="text-lg font-semibold">
                  {name}
                  {isExtension && (
                    <span className="ml-2 text-sm text-gray-500">(Extension: {extensionName})</span>
                  )}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  States: {Object.keys(workflow.states).length} | Transitions:{' '}
                  {workflow.transitions.length}
                </p>
              </div>
              <div className="text-sm">
                <span className="px-2 py-1 text-green-800 bg-green-100 rounded dark:bg-green-900/20 dark:text-green-300">
                  Valid
                </span>
              </div>
            </div>
          </ui.AccordionTrigger>
          <ui.AccordionContent className="px-0">
            <div className="bg-gray-50 dark:bg-gray-800/50 shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.05)]">
              {/* Diagram Section */}
              <div className="p-4">
                <h3 className="mb-2 font-semibold text-md">Diagram</h3>
                {workflow.mermaid ? (
                  <ui.MermaidDiagram>{workflow.mermaid}</ui.MermaidDiagram>
                ) : (
                  <div className="flex items-center justify-center p-8 bg-white border-2 border-gray-300 border-dashed rounded dark:bg-gray-800 dark:border-gray-600">
                    <div className="text-center">
                      <div className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                        No diagram available
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        Add a mermaid diagram to this workflow
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* States Section */}
              <div className="p-4">
                <h3 className="mb-2 font-semibold text-md">States</h3>
                <div className="grid gap-2">
                  {Object.entries(workflow.states).map(([stateName, state]) => {
                    // Determine card color based on tags
                    let cardBg = 'bg-white dark:bg-gray-800';
                    let cardBorder = 'border border-gray-200 dark:border-gray-700';
                    if (state.tags.includes('error')) {
                      cardBg = 'bg-red-50 dark:bg-red-900/20';
                      cardBorder = 'border border-red-200 dark:border-red-700';
                    } else if (state.tags.includes('warning')) {
                      cardBg = 'bg-yellow-50 dark:bg-yellow-900/20';
                      cardBorder = 'border border-yellow-200 dark:border-yellow-700';
                    } else if (state.tags.includes('end')) {
                      cardBg = 'bg-gray-50 dark:bg-gray-900/20';
                      cardBorder = 'border border-gray-300 dark:border-gray-800';
                    }
                    return (
                      <div
                        key={stateName}
                        className={`p-3 text-sm rounded shadow-sm ${cardBg} ${cardBorder}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-base font-medium">{state.label}</span>
                          <span className="bg-gray-100 dark:bg-gray-900 text-xs font-mono px-2 py-0.5 rounded border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300">
                            {state.name}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-1">
                          <span
                            className={`font-mono text-xs px-2 py-0.5 rounded border ${state.visible ? 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700' : 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-gray-900/20 dark:text-gray-500 dark:border-gray-700'}`}
                          >
                            VISIBLE
                          </span>
                          <span
                            className={`font-mono text-xs px-2 py-0.5 rounded border ${state.published ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-700' : 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-gray-900/20 dark:text-gray-500 dark:border-gray-700'}`}
                          >
                            PUBLISHED
                          </span>
                          <span
                            className={`font-mono text-xs px-2 py-0.5 rounded border ${state.authorOnly ? 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-700' : 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-gray-900/20 dark:text-gray-500 dark:border-gray-700'}`}
                          >
                            AUTHORONLY
                          </span>
                          <span
                            className={`font-mono text-xs px-2 py-0.5 rounded border ${state.inbox ? 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-700' : 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-gray-900/20 dark:text-gray-500 dark:border-gray-700'}`}
                          >
                            INBOX
                          </span>
                          {state.tags.map((tag) => {
                            let tagColor =
                              'bg-gray-200 text-gray-800 border-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600';
                            if (tag === 'ok')
                              tagColor =
                                'bg-green-200 text-green-900 border-green-300 dark:bg-green-800 dark:text-green-200 dark:border-green-700';
                            if (tag === 'error')
                              tagColor =
                                'bg-red-200 text-red-900 border-red-300 dark:bg-red-800 dark:text-red-200 dark:border-red-700';
                            if (tag === 'warning')
                              tagColor =
                                'bg-yellow-200 text-yellow-900 border-yellow-300 dark:bg-yellow-800 dark:text-yellow-200 dark:border-yellow-700';
                            if (tag === 'end')
                              tagColor =
                                'bg-gray-300 text-gray-900 border-gray-400 dark:bg-gray-900 dark:text-gray-200 dark:border-gray-700';
                            return (
                              <span
                                key={tag}
                                className={`font-mono text-xs px-2 py-0.5 rounded border ${tagColor}`}
                              >
                                {tag.toUpperCase()}
                              </span>
                            );
                          })}
                        </div>
                        {state.messages && (
                          <div className="mt-1 font-mono text-xs text-gray-500 dark:text-gray-400">
                            {Object.entries(state.messages).map(([role, msg]) => (
                              <div key={role}>
                                <span className="mr-1 font-bold">{role}:</span>
                                <span>{msg}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Transitions Section */}
              <div className="p-4">
                <h3 className="mb-2 font-semibold text-md">Transitions</h3>
                <div className="grid gap-4">
                  {workflow.transitions.map((transition) => (
                    <div
                      key={transition.name}
                      className="p-4 text-sm bg-white rounded shadow-sm dark:bg-gray-800"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium">
                          {transition.sourceStateName
                            ? workflow.states[transition.sourceStateName].label
                            : 'Any State'}{' '}
                          → {workflow.states[transition.targetStateName].label}
                        </div>
                        <div className="text-xs text-gray-500">
                          {transition.userTriggered ? 'User Triggered' : 'System Triggered'}
                        </div>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="font-medium text-gray-700 dark:text-gray-300">
                              Labels
                            </div>
                            <ul className="mt-1 space-y-1 text-gray-600 dark:text-gray-400">
                              <li>Button: {transition.labels.button}</li>
                              <li>Confirmation: {transition.labels.confirmation}</li>
                              <li>Success: {transition.labels.success}</li>
                              <li>Action: {transition.labels.action}</li>
                              {transition.labels.inProgress && (
                                <li>In Progress: {transition.labels.inProgress}</li>
                              )}
                            </ul>
                          </div>
                          <div>
                            <div className="font-medium text-gray-700 dark:text-gray-300">
                              Options
                            </div>
                            <ul className="mt-1 space-y-1 text-gray-600 dark:text-gray-400">
                              {transition.requiresJob && (
                                <li>Job Type: {transition.options?.jobType || 'Required'}</li>
                              )}
                              {transition.requiredScopes &&
                                transition.requiredScopes.length > 0 && (
                                  <li>Required Scopes: {transition.requiredScopes.join(', ')}</li>
                                )}
                              {transition.options?.updatesSlug && <li>Updates Slug</li>}
                              {transition.options?.setsPublishedDate && (
                                <li>Sets Published Date</li>
                              )}
                            </ul>
                          </div>
                        </div>
                        {transition.help && (
                          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                            <div className="font-medium text-gray-700 dark:text-gray-300">Help</div>
                            <p>{transition.help}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ui.AccordionContent>
        </ui.AccordionItem>
      </ui.Accordion>
    </primitives.Card>
  );
}

export default function SystemWorkflows({ loaderData }: Route.ComponentProps) {
  const { workflowStatus, missingWorkflows, totalWorkflows, hasMissingWorkflows } = loaderData;

  // Separate core and extension workflows
  const coreWorkflows = workflowStatus.filter((status: WorkflowStatus) => !status.isExtension);
  const extensionWorkflows = workflowStatus.filter((status: WorkflowStatus) => status.isExtension);

  return (
    <PageFrame title="System Workflows" description="View all workflows in the system.">
      <div className="mb-4">
        <p className="text-lg">
          Total Workflows: {totalWorkflows}
          {hasMissingWorkflows && (
            <span className="ml-2 text-red-500">({missingWorkflows.length} missing workflows)</span>
          )}
        </p>
      </div>

      {missingWorkflows.length > 0 && (
        <primitives.Card className="p-4 mb-4 bg-red-50 dark:bg-red-900/20">
          <h2 className="mb-2 text-lg font-semibold text-red-700 dark:text-red-300">
            Missing Workflows
          </h2>
          <ul className="list-disc list-inside">
            {missingWorkflows.map((name: string) => (
              <li key={name} className="text-red-600 dark:text-red-400">
                {name}
              </li>
            ))}
          </ul>
        </primitives.Card>
      )}

      {/* Core Workflows Section */}
      <div className="mb-8">
        <h2 className="mb-4 text-xl font-semibold">Core Workflows</h2>
        <div className="grid gap-4">
          {coreWorkflows.map((status: WorkflowStatus) => (
            <WorkflowCard key={status.name} {...status} />
          ))}
        </div>
      </div>

      {/* Extension Workflows Section */}
      {extensionWorkflows.length > 0 && (
        <div>
          <h2 className="mb-4 text-xl font-semibold">Extension Workflows</h2>
          <div className="grid gap-4">
            {extensionWorkflows.map((status: WorkflowStatus) => (
              <WorkflowCard key={status.name} {...status} />
            ))}
          </div>
        </div>
      )}
    </PageFrame>
  );
}
