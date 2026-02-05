import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { useDeploymentConfig } from '@curvenote/scms-core';
import type { Author, FieldSchema, FormDefinition, FormSubmission } from './types.js';
import { getMissingRequiredForPage } from './validationUtils.js';
import { FormArea } from './form.js';
import { SubmitButton } from './SubmitButton.js';
import { useSaveField } from './useSaveField.js';

type FormCollectionOption = { id: string; name: string; title: string };
type AgreementURL = { label: string; url: string };

type ReviewStepUser = {
  name?: string;
  email?: string;
  orcid?: string;
  affiliation?: string;
  pending?: boolean;
} | null;

type ReviewStepProps = {
  stepNumber: number;
  form: FormDefinition;
  submission: Pick<FormSubmission, 'fields'>;
  user: ReviewStepUser;
  basePath: string;
  draftObjectId?: string | null;
  onDraftCreated?: (id: string) => void;
  siteTitle: string;
  formCollections: FormCollectionOption[];
};

function formatFieldValue(schema: FieldSchema, value: unknown): string {
  if (value == null || value === '') return '—';
  if (schema.type === 'author' && Array.isArray(value)) {
    const authors = value as Author[];
    return authors.length === 0 ? '—' : authors.map((a) => a.name).join(', ');
  }
  if (schema.type === 'keywords' && Array.isArray(value)) {
    const keywords = value as string[];
    return keywords.length === 0 ? '—' : keywords.join(', ');
  }
  if (schema.type === 'radio' && 'options' in schema) {
    const opt = schema.options.find((o) => o.value === value);
    return opt ? opt.label : String(value);
  }
  if (typeof value === 'string' && value.length > 200) {
    return value.slice(0, 200) + '…';
  }
  return String(value);
}

export function ReviewStep({
  stepNumber,
  form,
  submission,
  user,
  basePath,
  draftObjectId = null,
  onDraftCreated,
  siteTitle,
  formCollections,
}: ReviewStepProps) {
  const config = useDeploymentConfig();
  const agreementStep = config.signupConfig?.signup?.steps?.find(
    (step: { type: string }) => step.type === 'agreement',
  );
  const agreementUrls: AgreementURL[] = agreementStep?.agreementUrls ?? [];
  const isPending = user?.pending ?? false;
  const showTermsCheckbox = isPending && agreementUrls.length > 0;
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const fields = form.fields;
  const values = submission.fields;
  const defaultCollectionId = formCollections[0]?.id ?? '';
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(
    () => (values.collectionId as string) || defaultCollectionId,
  );
  const saveCollectionId = useSaveField(draftObjectId ?? null, 'collectionId', onDraftCreated);

  useEffect(() => {
    const fromDraft = values.collectionId as string | undefined;
    if (fromDraft && formCollections.some((c) => c.id === fromDraft)) {
      setSelectedCollectionId(fromDraft);
    } else if (defaultCollectionId && !fromDraft) {
      setSelectedCollectionId(defaultCollectionId);
    }
  }, [values.collectionId, defaultCollectionId, formCollections]);

  const handleCollectionChange = (newId: string) => {
    setSelectedCollectionId(newId);
    saveCollectionId(newId);
  };

  const selectedCollection = formCollections.find((c) => c.id === selectedCollectionId);
  const selectedCollectionTitle = selectedCollection?.title ?? selectedCollection?.name ?? '—';
  const canChangeCollection = formCollections.length > 1;

  const reviewPage = form.pages.find((p) => p.slug === 'review');
  const missingRequired = reviewPage ? getMissingRequiredForPage(reviewPage, form, values) : [];
  const canSubmit = missingRequired.length === 0 && (!showTermsCheckbox || agreedToTerms);
  const reviewIndex = form.pages.findIndex((p) => p.slug === 'review');
  const prevPage = reviewIndex > 0 ? form.pages[reviewIndex - 1] : null;
  const prevHref = prevPage ? `${basePath}${prevPage.slug}` : null;

  return (
    <FormArea stepNumber={stepNumber} stepTitle="Review and Submit">
      <div className="space-y-8">
        {/* Summary of all fields */}
        <section>
          <h4 className="mb-3 text-sm font-semibold text-muted-foreground">Summary</h4>
          <dl className="space-y-3">
            {fields.map((schema) => (
              <div key={schema.name} className="flex flex-col gap-0.5">
                <dt className="text-sm font-medium text-muted-foreground">{schema.title}</dt>
                <dd className="text-base">{formatFieldValue(schema, values[schema.name])}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Collection picker: above error, label and dropdown side by side */}
        {canChangeCollection && (
          <section className="flex gap-3 items-center w-full">
            <label
              htmlFor="review-collection"
              className="text-sm font-medium text-muted-foreground shrink-0"
            >
              Choose collection:
            </label>
            <select
              id="review-collection"
              value={selectedCollectionId}
              onChange={(e) => handleCollectionChange(e.target.value)}
              className="flex-1 px-3 py-2 min-w-0 text-sm rounded-md border border-input bg-background"
            >
              {formCollections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title || c.name}
                </option>
              ))}
            </select>
          </section>
        )}

        {/* Missing data: always visible when there are errors */}
        {missingRequired.length > 0 && (
          <section className="p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
            <h4 className="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
              Missing required information
            </h4>
            <ul className="space-y-1 text-sm list-disc list-inside text-amber-800 dark:text-amber-200">
              {missingRequired.map((f) => (
                <li key={f.name}>
                  <Link
                    to={`${basePath}${
                      form.pages.find((p) =>
                        p.children.some((c) => c.type === 'field' && c.id === f.name),
                      )?.slug ??
                      form.pages[0]?.slug ??
                      ''
                    }`}
                    className="underline hover:no-underline"
                  >
                    {f.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Terms acceptance (pending users only – form handles new account, no pending page visit) */}
        {showTermsCheckbox && (
          <section className="p-4 rounded-lg border border-border bg-background">
            <div className="flex gap-3 items-start">
              <input
                type="checkbox"
                id="terms-checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-1 rounded border-input"
              />
              <label htmlFor="terms-checkbox" className="text-sm cursor-pointer">
                I accept the{' '}
                {agreementUrls.map((url, index) => (
                  <span key={index}>
                    {index > 0 && index === agreementUrls.length - 1 && ' and '}
                    {index > 0 && index < agreementUrls.length - 1 && ', '}
                    <a
                      href={url.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400"
                    >
                      {url.label}
                    </a>
                  </span>
                ))}
              </label>
            </div>
          </section>
        )}

        {/* Same row as other pages: Back left, Submit right */}
        <div className="flex flex-col gap-0 items-end pt-6 mt-6 border-t border-border">
          {formCollections.length > 0 && (
            <p className="text-sm text-right text-muted-foreground">
              Submitting to <span className="font-semibold text-foreground">{siteTitle}</span>
              {' – '}
              <span className="font-semibold text-foreground">{selectedCollectionTitle}</span>
            </p>
          )}
          <div className="flex justify-between items-center w-full">
            {prevHref ? (
              <Link
                to={prevHref}
                className="inline-flex gap-2 items-center px-4 py-2 text-sm font-medium rounded-md border transition-colors text-foreground bg-background border-border hover:bg-muted"
              >
                ‹ Back
              </Link>
            ) : (
              <span />
            )}
            <SubmitButton
              user={user}
              variant="review"
              draftObjectId={draftObjectId}
              canSubmit={canSubmit}
              validate={() => missingRequired.length === 0}
              agreedToTerms={showTermsCheckbox ? agreedToTerms : undefined}
            />
          </div>
        </div>
      </div>
    </FormArea>
  );
}
