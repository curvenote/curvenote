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
              affiliationChoices={values.affiliations}
              onAffiliationChoicesChange={(list) => {
                handleChange('affiliations', list);
                saveAffiliationChoices(list);
              }}
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
