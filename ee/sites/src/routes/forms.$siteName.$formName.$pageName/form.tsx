import { CheckIcon, Cloud } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router';
import type {
  FieldSchema,
  FormDefinition,
  FormPage,
  FormSubmission,
  KeywordsOption,
  ParagraphOption,
  RadioOption,
} from './types.js';
import { cn, ui, WizardQuestion } from '@curvenote/scms-core';
import { useFormSyncContext } from './formSyncContext.js';
import { getMissingRequiredForPage } from './validationUtils.js';
import { FormLabel } from './label.js';
import { AuthorField } from './authors.js';
import { ContactDetails } from './ContactDetails.js';
import { PoweredByCurvenote } from './PoweredByCurvenote.js';
import { SubmitButton } from './SubmitButton.js';
import { useSaveField } from './useSaveField.js';

type LoaderData = {
  nothing: null;
};

export async function loader(): Promise<LoaderData> {
  return { nothing: null };
}

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

type FormAreaProps = {
  stepNumber: number | string;
  stepTitle: string;
  children: React.ReactNode;
};

export function FormArea({ stepNumber, stepTitle, children }: FormAreaProps) {
  return (
    <div className="w-full max-w-2xl not-prose">
      <div className="flex gap-3 items-center p-4">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#3E7AA9] text-white font-semibold shrink-0">
          {stepNumber}
        </div>
        <h3 className="text-lg font-semibold">{stepTitle}</h3>
      </div>
      <div className="p-6 space-y-6 border border-border bg-background">{children}</div>
    </div>
  );
}

type PageNavProps = {
  basePath: string;
  currentPageSlug: string;
  formPages: FormPage[];
  /** If provided, Continue is only allowed when this returns true. Called on click; navigation is prevented when false. */
  onBeforeContinue?: () => boolean;
  /** When true, Continue is shown but disabled (e.g. when validation errors are visible). */
  continueDisabled?: boolean;
};

export function PageNav({
  basePath,
  currentPageSlug,
  formPages,
  onBeforeContinue,
  continueDisabled = false,
}: PageNavProps) {
  const currentIndex = formPages.findIndex((p) => p.slug === currentPageSlug);
  const prevPage = currentIndex > 0 ? formPages[currentIndex - 1] : null;
  const nextPage =
    currentIndex >= 0 && currentIndex < formPages.length - 1 ? formPages[currentIndex + 1] : null;
  const prevHref = prevPage ? `${basePath}${prevPage.slug}` : null;
  const nextHref = nextPage ? `${basePath}${nextPage.slug}` : null;

  const handleContinueClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onBeforeContinue && !onBeforeContinue()) {
      e.preventDefault();
    }
  };

  const continueClassName =
    'inline-flex gap-2 items-center px-4 py-2 text-sm font-medium rounded-md transition-colors';

  return (
    <div className="flex justify-between items-center pt-6 mt-6 border-t border-border">
      {prevHref ? (
        <Link
          to={prevHref}
          className={cn(
            continueClassName,
            'text-foreground bg-background border border-border hover:bg-muted',
          )}
        >
          ‹ Back
        </Link>
      ) : (
        <span />
      )}
      {nextHref ? (
        continueDisabled ? (
          <span
            className={cn(
              continueClassName,
              'text-white bg-[#3E7AA9]/60 cursor-not-allowed border border-transparent',
            )}
            aria-disabled="true"
          >
            Continue ›
          </span>
        ) : (
          <Link
            to={nextHref}
            onClick={handleContinueClick}
            className={cn(
              continueClassName,
              'text-white bg-[#3E7AA9] hover:bg-[#3E7AA9]/90 border border-transparent',
            )}
          >
            Continue ›
          </Link>
        )
      ) : (
        <span />
      )}
    </div>
  );
}

type TitleFieldProps = {
  schema: FieldSchema;
  value: string;
  onChange: (value: string) => void;
  draftObjectId?: string | null;
  onDraftCreated?: (id: string) => void;
};

export function TitleField({
  schema,
  value,
  onChange,
  draftObjectId = null,
  onDraftCreated,
}: TitleFieldProps) {
  const isValid = value.trim().length > 0;
  const save = useSaveField(draftObjectId ?? null, schema.name, onDraftCreated);

  return (
    <div className="space-y-2">
      <FormLabel htmlFor={schema.name} required={schema.required} valid={isValid}>
        {schema.title}
      </FormLabel>
      <ui.Input
        id={schema.name}
        type="text"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v);
          save(v);
        }}
        className="font-bold"
      />
    </div>
  );
}

type AbstractFieldProps = {
  schema: ParagraphOption;
  value: string;
  onChange: (value: string) => void;
  draftObjectId?: string | null;
  onDraftCreated?: (id: string) => void;
};

export function AbstractField({
  schema,
  value,
  onChange,
  draftObjectId = null,
  onDraftCreated,
}: AbstractFieldProps) {
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const maxWords = schema.wordCount?.max || 0;
  const progressPercentage = maxWords > 0 ? (wordCount / maxWords) * 100 : 0;
  const isOverLimit = wordCount > maxWords;
  const isValid = value.trim().length > 0;
  const save = useSaveField(draftObjectId ?? null, schema.name, onDraftCreated);

  return (
    <div className="space-y-2">
      <FormLabel htmlFor={schema.name} required={schema.required} valid={isValid}>
        {schema.title}
      </FormLabel>
      <textarea
        id={schema.name}
        rows={8}
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v);
          save(v);
        }}
        className={cn(
          'px-3 py-2 w-full text-base bg-transparent border rounded-xs min-h-[200px] border-input',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
          'resize-y',
        )}
      />
      {schema.wordCount && (
        <div className="flex gap-3 items-center">
          <div className="overflow-hidden flex-1 h-2 bg-gray-200 rounded-full dark:bg-gray-700">
            <div
              className={cn('h-full transition-all', isOverLimit ? 'bg-red-500' : 'bg-green-500')}
              style={{ width: `${Math.min(progressPercentage, 100)}%` }}
            />
          </div>
          <span
            className={cn(
              'text-sm whitespace-nowrap',
              isOverLimit ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {wordCount}/{maxWords} words
          </span>
        </div>
      )}
    </div>
  );
}

function normalizeKeywords(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string' && value.trim())
    return value
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
  return [];
}

type KeywordsFieldProps = {
  schema: KeywordsOption;
  value: string[];
  onChange: (value: string[]) => void;
  draftObjectId?: string | null;
  onDraftCreated?: (id: string) => void;
};

export function KeywordsField({
  schema,
  value,
  onChange,
  draftObjectId = null,
  onDraftCreated,
}: KeywordsFieldProps) {
  const isValid = !schema.required || value.length > 0;
  const save = useSaveField(draftObjectId ?? null, schema.name, onDraftCreated);

  const handleValueChange = (next: string[]) => {
    onChange(next);
    save(next);
  };

  return (
    <div className="space-y-2">
      <FormLabel htmlFor={schema.name} required={schema.required} valid={isValid}>
        {schema.title}
      </FormLabel>
      <ui.KeywordsInput
        id={schema.name}
        value={value}
        onValueChange={handleValueChange}
        placeholder={schema.placeholder || 'Type and press Enter to add'}
      />
    </div>
  );
}

type RadioFieldProps = {
  schema: RadioOption;
  value: string;
  onChange: (value: string) => void;
  draftObjectId?: string | null;
  onDraftCreated?: (id: string) => void;
};

export function RadioField({
  schema,
  value,
  onChange,
  draftObjectId = null,
  onDraftCreated,
}: RadioFieldProps) {
  const save = useSaveField(draftObjectId ?? null, schema.name, onDraftCreated);

  return (
    <div className="space-y-2">
      <WizardQuestion
        key={schema.name}
        value={value}
        onChange={(v) => {
          onChange(v);
          save(v);
        }}
        question={{
          id: schema.name,
          title: schema.title,
          type: 'radio',
          options: schema.options,
        }}
      />
    </div>
  );
}

type FormBodyUser = {
  name?: string;
  email?: string;
  orcid?: string;
  affiliation?: string;
} | null;

type FormBodyProps = {
  stepNumber: number;
  stepTitle: string;
  form: FormDefinition;
  formFields: FieldSchema[];
  formChildren: FormPage['children'];
  formPages: FormPage[];
  currentPageSlug: string;
  basePath: string;
  submission: FormSubmission;
  user?: FormBodyUser;
  draftObjectId?: string | null;
  onDraftCreated?: (id: string) => void;
};

const draftProps = (
  draftObjectId: string | null | undefined,
  onDraftCreated: ((id: string) => void) | undefined,
) => ({ draftObjectId: draftObjectId ?? null, onDraftCreated });

export function FormBody({
  stepNumber,
  stepTitle,
  form,
  formFields,
  formChildren,
  formPages,
  currentPageSlug,
  basePath,
  submission,
  user = null,
  draftObjectId = null,
  onDraftCreated,
}: FormBodyProps) {
  const [values, setValues] = useState<Record<string, any>>(submission.fields);
  const [attemptedContinue, setAttemptedContinue] = useState(false);
  const dp = draftProps(draftObjectId, onDraftCreated);

  // Only show validation on this page after user clicks Continue; clear when navigating away
  useEffect(() => {
    setAttemptedContinue(false);
  }, [currentPageSlug]);

  const currentPage = formPages.find((p) => p.slug === currentPageSlug);
  const missingRequired = currentPage ? getMissingRequiredForPage(currentPage, form, values) : [];
  const showValidationBox = attemptedContinue && missingRequired.length > 0;

  const handleChange = (name: string, value: any) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleBeforeContinue = () => {
    setAttemptedContinue(true);
    return missingRequired.length === 0;
  };

  const renderFormChild = (field: FormPage['children'][0]) => {
    if (field.type === 'content') {
      return <div>Content!</div>;
    }
    const schema = formFields.find((f) => f.name === field.id);
    if (!schema) {
      return <div>Field not found: {field.id}</div>;
    }
    const value = values[schema.name];

    switch (schema.type) {
      case 'keywords':
        return (
          <KeywordsField
            key={schema.name}
            schema={schema}
            value={normalizeKeywords(value)}
            onChange={(v) => handleChange(schema.name, v)}
            {...dp}
          />
        );
      case 'string':
        return (
          <TitleField
            key={schema.name}
            schema={schema}
            value={value}
            onChange={(v) => handleChange(schema.name, v)}
            {...dp}
          />
        );
      case 'radio':
        return (
          <RadioField
            key={schema.name}
            schema={schema}
            value={value}
            onChange={(v) => handleChange(schema.name, v)}
            {...dp}
          />
        );
      case 'paragraph':
        return (
          <AbstractField
            key={schema.name}
            schema={schema}
            value={value}
            onChange={(v) => handleChange(schema.name, v)}
            {...dp}
          />
        );
      case 'author':
        return (
          <div key={schema.name} className="space-y-6">
            <ContactDetails
              user={user ?? null}
              draftObjectId={draftObjectId}
              onDraftCreated={onDraftCreated}
              draftContactName={values.contactName}
              draftContactAffiliation={values.contactAffiliation}
              draftContactEmail={values.contactEmail}
              draftContactOrcidId={values.contactOrcidId}
            />
            <AuthorField
              schema={schema}
              value={value}
              onChange={(v) => handleChange(schema.name, v)}
              {...dp}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <FormArea stepNumber={stepNumber} stepTitle={stepTitle}>
      {formChildren.map((child) => renderFormChild(child))}
      {showValidationBox && (
        <section className="p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
          <h4 className="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
            Missing required information
          </h4>
          <ul className="space-y-1 text-sm list-disc list-inside text-amber-800 dark:text-amber-200">
            {missingRequired.map((f) => (
              <li key={f.name}>{f.title}</li>
            ))}
          </ul>
        </section>
      )}
      <PageNav
        basePath={basePath}
        currentPageSlug={currentPageSlug}
        formPages={formPages}
        onBeforeContinue={handleBeforeContinue}
        continueDisabled={showValidationBox}
      />
    </FormArea>
  );
}
