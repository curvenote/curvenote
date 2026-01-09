import { cn } from '../utils/cn.js';
import { getStatusButtonClasses } from '../utils/status.js';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ArrowTopRightOnSquareIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import type { Workflow, WorkflowTransition } from '../workflow/types.js';
import { LoadingSpinner } from './LoadingSpinner.js';

// TODO lucide icons
export function HistoryDraftIcon({ className, size }: { className?: string; size?: number }) {
  return (
    <svg
      className={className}
      width={size ?? 24}
      height={size ?? 24}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g clipPath="url(#clip0_2413_15637)">
        <path
          d="M14 11H8M10 15H8M16 7H8M20 6.8V17.2C20 18.8802 20 19.7202 19.673 20.362C19.3854 20.9265 18.9265 21.3854 18.362 21.673C17.7202 22 16.8802 22 15.2 22H8.8C7.11984 22 6.27976 22 5.63803 21.673C5.07354 21.3854 4.6146 20.9265 4.32698 20.362C4 19.7202 4 18.8802 4 17.2V6.8C4 5.11984 4 4.27976 4.32698 3.63803C4.6146 3.07354 5.07354 2.6146 5.63803 2.32698C6.27976 2 7.11984 2 8.8 2H15.2C16.8802 2 17.7202 2 18.362 2.32698C18.9265 2.6146 19.3854 3.07354 19.673 3.63803C20 4.27976 20 5.11984 20 6.8Z"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <defs>
        <clipPath id="clip0_2413_15637">
          <rect width="24" height="24" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

export function SubmissionActionsDropdown({
  workflow,
  keyStub,
  workflowStateName,
  transition,
  previewUrl,
  publishedUrl,
  buildUrl,
  canUpdateStatus,
  onClickAction,
}: {
  workflow: Workflow;
  workflowStateName: string;
  transition?: WorkflowTransition;
  keyStub?: string;
  previewUrl?: string;
  publishedUrl?: string;
  buildUrl?: string;
  canUpdateStatus?: boolean;
  onClickAction: (status: string) => any;
}) {
  const transitions = canUpdateStatus
    ? workflow.transitions.filter((t) => t.sourceStateName === workflowStateName && t.userTriggered)
    : [];
  const statusClasses = getStatusButtonClasses(workflowStateName);
  const transitionClasses = 'bg-stone-200 text-stone-600 stroke-stone-600 border border-stone-700';
  const currentState = workflow.states[workflowStateName];

  const label = (
    <>
      {' '}
      <span className="animate-pulse">
        {transition ? (
          <LoadingSpinner color="text-gray-600" className="w-4 h-4 mr-1" />
        ) : (
          <HistoryDraftIcon size={16} />
        )}
      </span>
      <span className="inline-flex mx-1">
        {transition
          ? (transition?.labels?.inProgress ?? 'Eeeekk...')
          : (currentState?.label ?? workflowStateName)}
      </span>
      {transitions.length > 0 && (
        <span className="inline-block w-[16px] h-[16px]">
          <ChevronDownIcon />
        </span>
      )}
    </>
  );

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={cn(
            { [statusClasses]: !transition, [transitionClasses]: !!transition },
            'rounded-sm inline-flex items-center px-2 py-[2px] text-sm opacity-90 justify-center outline-hidden focus:shadow-[0_0_0_2px] cursor-default',
            { 'pointer-events-none': transitions.length === 0 },
          )}
          aria-label="Change the status of the submission"
        >
          {label}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content className="min-w-[180px] text-sm text-left bg-white rounded-md p-2 shadow-[0px_10px_38px_-10px_rgba(22,_23,_24,_0.35),_0px_10px_20px_-15px_rgba(22,_23,_24,_0.2)]">
          {buildUrl && (
            <DropdownMenu.Item className="group leading-none text-stone-800 rounded-[3px] flex items-center h-[2rem] p-2 relative pl-[25px] select-none outline-hidden data-disabled:text-stone-800 data-disabled:pointer-events-none data-highlighted:bg-stone-100 data-highlighted:text-stone-800 cursor-pointer">
              <a
                className="inline-flex items-center grow"
                href={buildUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Build Details{' '}
                <div className="ml-auto pl-[20px] group-data-highlighted:text-black group-data-disabled:text-black">
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                </div>
              </a>
            </DropdownMenu.Item>
          )}
          {previewUrl && (
            <DropdownMenu.Item className="group leading-none text-stone-800 rounded-[3px] flex items-center h-[2rem] p-2 relative pl-[25px] select-none outline-hidden data-disabled:text-stone-800 data-disabled:pointer-events-none data-highlighted:bg-stone-100 data-highlighted:text-stone-800 cursor-pointer">
              <a
                className="inline-flex items-center"
                href={previewUrl ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
              >
                Preview Version{' '}
                <div className="ml-auto pl-[20px] group-data-highlighted:text-black group-data-disabled:text-black">
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                </div>
              </a>
            </DropdownMenu.Item>
          )}
          {publishedUrl && (
            <DropdownMenu.Item className="group leading-none text-stone-800 rounded-[3px] flex items-center h-[2rem] p-2 relative pl-[25px] select-none outline-hidden data-disabled:text-stone-800 data-disabled:pointer-events-none data-highlighted:bg-stone-100 data-highlighted:text-stone-800 cursor-pointer">
              <a
                href={publishedUrl}
                className="inline-flex items-center"
                target="_blank"
                rel="noopener noreferrer"
              >
                Latest Published{' '}
                <div className="ml-auto pl-[20px] group-data-highlighted:text-black group-data-disabled:text-black">
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                </div>
              </a>
            </DropdownMenu.Item>
          )}
          {transitions.length > 0 && (
            <DropdownMenu.Separator className="h-[1px] bg-gray-300 m-[5px]" />
          )}
          {transitions.map((tr: WorkflowTransition) => (
            <DropdownMenu.Item
              key={`${keyStub}-actions-${tr.name}`}
              title={tr.help}
              className="group leading-none text-stone-800 rounded-[3px] flex items-center h-[2rem] p-2 relative pl-[25px] select-none outline-hidden data-disabled:text-stone-800 data-disabled:pointer-events-none data-highlighted:bg-stone-100 data-highlighted:text-stone-800 cursor-default"
              onClick={(e) => {
                e.stopPropagation();
                e.currentTarget.blur();
                onClickAction(tr.targetStateName);
              }}
            >
              {`${tr.labels.button}...`}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
