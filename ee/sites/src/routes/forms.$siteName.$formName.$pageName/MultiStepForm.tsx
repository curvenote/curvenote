import { CheckIcon, Cloud } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router';
import type { FormPage, FormSubmission } from './types.js';
import { cn } from '@curvenote/scms-core';
import { useFormSyncContext } from './formSyncContext.js';
import { SubmitButton } from './SubmitButton.js';
import { PoweredByCurvenote } from './PoweredByCurvenote.js';

type SubmitButtonUser = {
  name?: string;
  email?: string;
  orcid?: string;
  affiliation?: string;
};

type MultiStepFormProps = {
  formName: string;
  title: string;
  description?: string;
  formPages: FormPage[];
  basePath?: string;
  currentPage?: string;
  submission: Pick<FormSubmission, 'pages'>;
  user: SubmitButtonUser | null;
  /** When true (e.g. on success page), step links are not clickable. */
  stepsDisabled?: boolean;
  className?: string;
};

export function MultiStepForm({
  formName,
  title,
  description,
  formPages,
  basePath,
  currentPage,
  submission,
  user,
  stepsDisabled = false,
  className,
}: MultiStepFormProps) {
  const syncContext = useFormSyncContext();
  const isSaving = syncContext?.isSaving ?? false;
  type DraftSavedPhase = 'hidden' | 'visible' | 'fadingOut';
  const [draftSavedPhase, setDraftSavedPhase] = useState<DraftSavedPhase>('hidden');
  const prevSavingRef = useRef(isSaving);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (prevSavingRef.current && !isSaving) {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
      setDraftSavedPhase('visible');
      timeoutsRef.current.push(
        setTimeout(() => {
          setDraftSavedPhase('fadingOut');
          timeoutsRef.current.push(setTimeout(() => setDraftSavedPhase('hidden'), 150));
        }, 1500),
      );
      return () => timeoutsRef.current.forEach(clearTimeout);
    }
    prevSavingRef.current = isSaving;
  }, [isSaving]);

  return (
    <div
      className={cn(
        'flex flex-col h-full w-full border max-w-[300px] border-border not-prose bg-background',
        className,
      )}
    >
      <div className="flex flex-col gap-2 p-4 shrink-0">
        <div className="text-sm font-semibold text-muted-foreground">{formName}</div>
        <h2 className="text-xl font-bold line-clamp-2 wrap-break-words">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="overflow-auto flex-1 min-h-0 shrink">
        {formPages.map((page, index) => {
          const stepNumber = index + 1;
          const completed = submission.pages[page.slug]?.completed || false;
          const active = page.slug === currentPage;
          const stepClassName = cn(
            'relative flex gap-4 items-center p-4 transition-colors',
            index === 0 ? 'border-t border-b border-border' : 'border-b border-border',
            stepsDisabled ? 'cursor-default' : 'cursor-pointer hover:bg-[#3E7AA9]/10',
            active
              ? 'bg-[#3E7AA9]/20 before:absolute before:left-0 before:-top-px before:h-[calc(100%+2px)] before:w-1 before:bg-[#3E7AA9] before:content-[""]'
              : 'bg-transparent',
          );
          const content = (
            <>
              <div
                className={cn('flex items-center justify-center w-8 h-8 rounded-full shrink-0', {
                  'bg-[#3E7AA9] text-white': completed,
                  'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-2 border-dashed border-gray-400 dark:border-gray-500':
                    !completed && !active,
                  'bg-gray-200 dark:bg-gray-700 text-[#3E7AA9] border-2 border-[#3E7AA9]':
                    !completed && active,
                })}
              >
                {completed ? (
                  <CheckIcon className="w-5 h-5" />
                ) : (
                  <span className="text-sm font-semibold">{stepNumber}</span>
                )}
              </div>
              <div className={cn('font-medium', active && 'font-semibold')}>
                {page.shortTitle || page.title}
              </div>
            </>
          );
          return stepsDisabled ? (
            <span key={index} className={stepClassName}>
              {content}
            </span>
          ) : (
            <Link to={`${basePath ?? ''}${page.slug}`} key={index} className={stepClassName}>
              {content}
            </Link>
          );
        })}
      </div>
      <div className="flex flex-col gap-3 p-4 pt-4 shrink-0">
        {!user && <SubmitButton user={user} variant="sidebar" isSaving={false} />}
        {user && draftSavedPhase !== 'hidden' && (
          <p
            className={cn(
              'flex gap-2 items-center text-sm text-muted-foreground transition-opacity duration-150 ease-out',
              draftSavedPhase === 'fadingOut' ? 'opacity-0' : 'opacity-100',
            )}
            role="status"
          >
            <Cloud className="w-4 h-4 shrink-0" aria-hidden />
            Draft saved
          </p>
        )}
        <div className="flex flex-col gap-3 px-4 pt-3 -mx-4 border-t border-border">
          <PoweredByCurvenote />
        </div>
      </div>
    </div>
  );
}
