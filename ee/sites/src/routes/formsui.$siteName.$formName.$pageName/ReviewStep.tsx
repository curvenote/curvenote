import { Link } from 'react-router';
import type { Author, FieldSchema, FormDefinition, FormSubmission } from './types.js';
import { getMissingRequiredForPage } from './validationUtils.js';
import { FormArea } from './form.js';
import { SubmitButton } from './SubmitButton.js';

type ReviewStepUser = {
  name?: string;
  email?: string;
  orcid?: string;
  affiliation?: string;
} | null;

type ReviewStepProps = {
  stepNumber: number;
  form: FormDefinition;
  submission: Pick<FormSubmission, 'fields'>;
  user: ReviewStepUser;
  basePath: string;
  draftObjectId?: string | null;
};

function formatFieldValue(schema: FieldSchema, value: unknown): string {
  if (value == null || value === '') return '—';
  if (schema.type === 'author' && Array.isArray(value)) {
    const authors = value as Author[];
    return authors.length === 0 ? '—' : authors.map((a) => a.name).join(', ');
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
}: ReviewStepProps) {
  const fields = form.fields;
  const values = submission.fields;
  const reviewPage = form.pages.find((p) => p.slug === 'review');
  const missingRequired = reviewPage ? getMissingRequiredForPage(reviewPage, form, values) : [];
  const canSubmit = missingRequired.length === 0;
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

        {/* Same row as other pages: Back left, Submit right */}
        <div className="flex justify-between items-center pt-6 mt-6 border-t border-border">
          {prevHref ? (
            <Link
              to={prevHref}
              className="inline-flex gap-2 items-center px-4 py-2 text-sm font-medium text-foreground rounded-md bg-background border border-border hover:bg-muted transition-colors"
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
          />
        </div>
      </div>
    </FormArea>
  );
}
