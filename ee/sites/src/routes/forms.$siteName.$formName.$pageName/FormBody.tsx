import { useState, useEffect } from 'react';
import type { FieldSchema, FormDefinition, FormPage, FormSubmission } from './types.js';
import { getMissingRequiredForPage, getFieldErrors } from './validationUtils.js';
import { FormArea } from './FormArea.js';
import { PageNav } from './PageNav.js';
import { TitleField } from './TitleField.js';
import { AbstractField } from './AbstractField.js';
import { KeywordsField, normalizeKeywords } from './KeywordsField.js';
import { RadioField } from './RadioField.js';
import { ContactDetails } from './ContactDetails.js';
import { AuthorField } from './authors.js';
import { useSaveField } from './useSaveField.js';

type FormBodyUser = {
  name?: string;
  email?: string;
  orcid?: string;
  affiliation?: string;
} | null;

export type ContactDetailsForAuthor = {
  name: string;
  email: string;
  orcidId: string;
  nameReadOnly: boolean;
  emailReadOnly: boolean;
  orcidReadOnly: boolean;
};

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
  /** When set, expand this author card (0-based index) after navigation from review error link. */
  initialExpandAuthorIndex?: number;
  /** When set, expand this affiliation (0-based index in list) after navigation from review error link. */
  initialExpandAffiliationIndex?: number;
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
  initialExpandAuthorIndex,
  initialExpandAffiliationIndex,
}: FormBodyProps) {
  const [values, setValues] = useState<Record<string, any>>(submission.fields);
  const [attemptedContinue, setAttemptedContinue] = useState(false);
  const dp = draftProps(draftObjectId, onDraftCreated);
  const saveAffiliationChoices = useSaveField(
    draftObjectId ?? null,
    'affiliations',
    onDraftCreated,
  );
  // Only show validation on this page after user clicks Continue; clear when navigating away
  useEffect(() => {
    setAttemptedContinue(false);
  }, [currentPageSlug]);

  const currentPage = formPages.find((p) => p.slug === currentPageSlug);
  const missingRequired = currentPage ? getMissingRequiredForPage(currentPage, form, values) : [];
  const fieldErrors = getFieldErrors(form, values);
  const currentPageFieldErrors = fieldErrors.filter((e) =>
    currentPage?.children.some((c) => c.type === 'field' && c.id === e.schema.name),
  );
  const showValidationBox =
    attemptedContinue && (missingRequired.length > 0 || currentPageFieldErrors.length > 0);

  const handleChange = (name: string, value: any) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleBeforeContinue = () => {
    setAttemptedContinue(true);
    return missingRequired.length === 0 && currentPageFieldErrors.length === 0;
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
      case 'author': {
        const contactAllFromUser = !!(
          user?.name != null &&
          user.name !== '' &&
          user?.email != null &&
          user.email !== '' &&
          user?.orcid != null &&
          user.orcid !== ''
        );
        return (
          <div key={schema.name} className="space-y-6">
            <h2 id="contact-details-heading" className="mb-2 text-sm font-medium text-foreground">
              {contactAllFromUser ? 'Your contact details' : 'What are your contact details?'}
            </h2>
            <section
              className="rounded-lg border border-border bg-muted/30 p-4"
              aria-labelledby="contact-details-heading"
            >
              <ContactDetails
                user={user ?? null}
                draftObjectId={draftObjectId}
                onDraftCreated={onDraftCreated}
                draftContactName={values.contactName}
                draftContactEmail={values.contactEmail}
                draftContactOrcidId={values.contactOrcidId}
                onContactChange={(updates) => {
                  Object.entries(updates).forEach(([k, v]) => {
                    handleChange(k, v);
                  });
                }}
              />
            </section>
            <AuthorField
              schema={schema}
              value={value}
              onChange={(v) => handleChange(schema.name, v)}
              affiliationList={Array.isArray(values.affiliations) ? values.affiliations : []}
              onAffiliationListChange={(list) => {
                handleChange('affiliations', list);
                saveAffiliationChoices(list);
              }}
              initialOpenAuthorIndex={initialExpandAuthorIndex}
              initialOpenAffiliationIndex={initialExpandAffiliationIndex}
              contactDetails={{
                name: String(values.contactName ?? '').trim() || (user?.name ?? ''),
                email: String(values.contactEmail ?? '').trim() || (user?.email ?? ''),
                orcidId: String(values.contactOrcidId ?? '').trim() || (user?.orcid ?? ''),
                nameReadOnly: !!(user && user.name != null && user.name !== ''),
                emailReadOnly: !!(user && user.email != null && user.email !== ''),
                orcidReadOnly: !!(user && user.orcid != null && user.orcid !== ''),
              }}
              {...dp}
            />
          </div>
        );
      }
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
            Please fix the following
          </h4>
          <ul className="space-y-1 text-sm list-disc list-inside text-amber-800 dark:text-amber-200">
            {missingRequired.map((f) => (
              <li key={f.name}>{f.title} (required)</li>
            ))}
            {currentPageFieldErrors.map(({ schema, message }) => (
              <li key={schema.name}>
                {schema.title}: {message}
              </li>
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
