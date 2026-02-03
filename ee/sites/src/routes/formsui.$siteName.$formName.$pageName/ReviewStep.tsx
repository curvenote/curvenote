import { Link } from 'react-router';
import type { Author, FieldSchema, FormDefinition, FormSubmission } from './types.js';
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

function isFieldEmpty(schema: FieldSchema, value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
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

  const missingRequired = fields.filter((f) => f.required && isFieldEmpty(f, values[f.name]));

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

        {/* Missing data */}
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

        {/* Submit / Sign in to submit */}
        <div className="flex flex-col gap-2 pt-4">
          <SubmitButton user={user} variant="review" draftObjectId={draftObjectId} />
        </div>
      </div>
    </FormArea>
  );
}
