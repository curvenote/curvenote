import { CheckIcon, Cloud } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router';
import type {
  FieldSchema,
  FormPage,
  FormSubmission,
  ParagraphOption,
  RadioOption,
  StringOption,
} from './types.js';
import { cn, ui, WizardQuestion } from '@curvenote/scms-core';
import { useFormSyncContext } from './formSyncContext.js';
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
  className,
}: MultiStepFormProps) {
  const syncContext = useFormSyncContext();
  const isSaving = syncContext?.isSaving ?? false;
  const [showDraftSaved, setShowDraftSaved] = useState(false);
  const prevSavingRef = useRef(isSaving);

  useEffect(() => {
    if (prevSavingRef.current && !isSaving) {
      setShowDraftSaved(true);
      const t = setTimeout(() => setShowDraftSaved(false), 1000);
      return () => clearTimeout(t);
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
      <div className="shrink-0 flex flex-col gap-2 p-4">
        <div className="text-sm font-semibold text-muted-foreground">{formName}</div>
        <h2 className="text-xl font-bold line-clamp-2 wrap-break-words">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="flex-1 overflow-auto shrink min-h-0">
        {formPages.map((page, index) => {
          const stepNumber = index + 1;
          const completed = submission.pages[page.slug]?.completed || false;
          const active = page.slug === currentPage;
          return (
            <Link
              to={`${basePath ?? ''}${page.slug}`}
              key={index}
              className={cn(
                'relative flex gap-4 items-center p-4 transition-colors cursor-pointer',
                index === 0 ? 'border-t border-b border-border' : 'border-b border-border',
                'hover:bg-[#3E7AA9]/10',
                active
                  ? 'bg-[#3E7AA9]/20 before:absolute before:left-0 before:-top-px before:h-[calc(100%+2px)] before:w-1 before:bg-[#3E7AA9] before:content-[""]'
                  : 'bg-transparent',
              )}
            >
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
            </Link>
          );
        })}
      </div>
      <div className="shrink-0 flex flex-col gap-3 p-4 pt-4">
        {!user && <SubmitButton user={user} variant="sidebar" isSaving={false} />}
        {user && showDraftSaved && (
          <p className="flex gap-2 items-center text-sm text-muted-foreground" role="status">
            <Cloud className="w-4 h-4 shrink-0" aria-hidden />
            Draft saved
          </p>
        )}
        <div className="-mx-4 border-t border-border px-4 pt-3 flex flex-col gap-3">
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

type KeywordsFieldProps = {
  schema: StringOption;
  value: string;
  onChange: (value: string) => void;
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
        placeholder={schema.placeholder || 'Type and press enter...'}
        className="w-full"
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
  formFields: FieldSchema[];
  formChildren: FormPage['children'];
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
  formFields,
  formChildren,
  submission,
  user = null,
  draftObjectId = null,
  onDraftCreated,
}: FormBodyProps) {
  const [values, setValues] = useState<Record<string, any>>(submission.fields);
  const dp = draftProps(draftObjectId, onDraftCreated);

  const handleChange = (name: string, value: any) => {
    setValues((prev) => ({ ...prev, [name]: value }));
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
      case 'string':
        if (schema.name === 'keywords') {
          return (
            <KeywordsField
              key={schema.name}
              schema={schema}
              value={value}
              onChange={(v) => handleChange(schema.name, v)}
              {...dp}
            />
          );
        }
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
    </FormArea>
  );
}
