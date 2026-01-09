import { formatDate, formatToNow, primitives } from '@curvenote/scms-core';
import type { SubmissionsListItemDTO } from '@curvenote/common';
import { LockOpen, Lock, History } from 'lucide-react';

export function HasPublishedVersion({ date }: { date?: string }) {
  return (
    <primitives.Chip
      className="text-white bg-green-600"
      title={
        date
          ? `latest published version was created on ${formatDate(date, 'yyyy-MM-dd')}`
          : undefined
      }
    >
      Published
    </primitives.Chip>
  );
}

export function HasRetractedVersion({ date }: { date?: string }) {
  return (
    <primitives.Chip
      className="text-white bg-red-800 dark:bg-red-500"
      title={
        date ? `This submission was retracted on ${formatDate(date, 'yyyy-MM-dd')}` : undefined
      }
    >
      Retracted
    </primitives.Chip>
  );
}

export function Slug({ slug }: { slug?: string }) {
  if (!slug) return null;
  return (
    <primitives.Chip
      className="text-white bg-sky-600 border-[1px] border-sky-600 dark:border-sky-600 dark:bg-sky-600"
      title={slug}
    >
      Slug
    </primitives.Chip>
  );
}

export function Collection({
  className = 'w-3 h-3',
  collection,
}: {
  className?: string;
  collection: SubmissionsListItemDTO['collection'];
}) {
  if (!collection) return null;
  const title = collection.content?.title ?? collection.slug;
  return (
    <primitives.Chip
      className=" text-sky-700 border-[1px] border-sky-700 dark:border-sky-300 dark:text-sky-300"
      title={`Collection - ${collection.open ? 'is open for submissions' : 'is now closed'}`}
    >
      {collection.open ? <LockOpen className={className} /> : <Lock className={className} />}
      <span className="inline-block ml-1">{title}</span>
    </primitives.Chip>
  );
}

export function SubmissionKind({
  className,
  title,
  description,
}: {
  className?: string;
  title: string;
  description?: string;
}) {
  return (
    <primitives.Chip
      className=" text-sky-700 border-[1px] border-sky-700 dark:border-sky-300 dark:text-sky-300"
      title="Submission Kind"
    >
      <span className={className} title={description}>
        {title}
      </span>
    </primitives.Chip>
  );
}

export function SubmissionAge({ date }: { date: string }) {
  return (
    <primitives.Chip
      className="text-black bg-gray-200 dark:bg-gray-600 dark:text-white align-center"
      title={`First submitted on ${formatDate(date, 'yyyy-MM-dd')}`}
    >
      <History className="inline-block mr-1 h-[14px] w-[14px] stroke-black dark:stroke-white" />
      <span>{date ? `${formatToNow(date)} old` : 'Unknown age'}</span>
    </primitives.Chip>
  );
}
