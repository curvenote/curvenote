import { JobStatus } from '@prisma/client';

export function getStatusButtonClasses(status: string | undefined) {
  if (!status)
    return 'text-neutral-700 bg-neutral-200 stroke-neutral-700 border border-neutral-700';
  switch (status) {
    case 'INCOMPLETE':
      return 'text-gray-700 bg-gray-200 stroke-gray-700 focus:shadow-gray-400 border border-gray-700';
    case 'DRAFT':
      return 'text-neutral-700 bg-neutral-200 stroke-neutral-700 focus:shadow-neutral-400 border border-neutral-700';
    case 'APPROVED':
      return 'text-green-700 bg-green-200 stroke-green-700 focus:shadow-green-400 border border-green-700';
    case 'PENDING':
      return 'text-orange-700 bg-orange-200 stroke-orange-700 focus:shadow-orange-600 border border-orange-700';
    case 'IN_REVIEW':
      return 'text-sky-700 bg-sky-200 stroke-sky-700 focus:shadow-sky-400 border border-sky-700';
    case 'PUBLISHING':
      return 'text-lime-700 bg-lime-200 stroke-lime-700 focus:shadow-lime-400 border border-lime-700';
    case 'PUBLISHED':
      return 'text-green-700 bg-green-200 stroke-green-700 focus:shadow-green-400 border border-green-700';
    case 'UNPUBLISHING':
      return 'text-cyan-700 bg-cyan-200 stroke-cyan-700 focus:shadow-cyan-400 border border-cyan-700';
    case 'REJECTED':
      return 'text-red-700 bg-red-200 stroke-red-700 focus:shadow-red-400 border border-red-700';
    case 'RETRACTED':
      return 'text-neutral-700 bg-neutral-200 stroke-neutral-700 focus:shadow-neutral-400 border border-neutral-700';
    default:
      return 'text-neutral-700 bg-neutral-200 stroke-neutral-700 border border-neutral-700';
  }
}

export function getStatusDotClasses(status: JobStatus | string) {
  switch (status) {
    case 'INCOMPLETE':
    case 'DRAFT':
    case JobStatus.QUEUED:
    case 'RETRACTED':
    case 'UNPUBLISHED':
      return 'bg-neutral-400';
    case 'IN_REVIEW':
    case 'APPROVED':
      return 'bg-sky-500';
    case JobStatus.RUNNING:
    case 'PENDING':
    case 'PUBLISHING':
    case 'UNPUBLISHING':
      return 'bg-orange-500';
    case JobStatus.COMPLETED:
    case 'PUBLISHED':
      return 'bg-green-500';
    case JobStatus.FAILED:
    case 'REJECTED':
      return 'bg-red-500';
  }

  return 'bg-neutral-400';
}
