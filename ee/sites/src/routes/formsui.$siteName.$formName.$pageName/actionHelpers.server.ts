import { data } from 'react-router';
import { zfd } from 'zod-form-data';
import { scopes } from '@curvenote/scms-core';
import { userHasSiteScope } from '@curvenote/scms-server';
import type { SiteContextWithUser } from '@curvenote/scms-server';
import { dbCreateWorkAndSubmission } from './db.server.js';
import { z } from 'zod';

const SubmitFormSchema = zfd.formData({
  name: zfd.text(z.string().min(1)),
  email: zfd.text(z.string().email()),
  orcid: zfd.text(z.string().optional()),
  affiliation: zfd.text(z.string().optional()),
  collectionId: zfd.text(z.string().uuid()).optional(),
  workTitle: zfd.text(z.string().min(1)),
  workDescription: zfd.text(z.string().optional()),
  isCorrespondingAuthor: zfd.text(z.string().optional()),
  /** JSON array of author names; when present used instead of isCorrespondingAuthor. */
  authors: zfd.text(z.string().optional()),
});

export async function submitForm(ctx: SiteContextWithUser, form: any, formData: FormData) {
  if (!userHasSiteScope(ctx.user, scopes.site.submissions.create, ctx.site.id)) {
    return data({ error: { message: 'Forbidden' } }, { status: 403 });
  }

  return zfd
    .formData(SubmitFormSchema)
    .parseAsync(Object.fromEntries(formData))
    .then(
      async (dataParsed) => {
        // Determine collection - use provided one or the single one from form
        let collectionId = dataParsed.collectionId;
        if (!collectionId && form.collections.length === 1) {
          collectionId = form.collections[0].collection.id;
        }
        if (!collectionId) {
          return data({ error: { message: 'Collection is required' } }, { status: 400 });
        }

        // Authors: use JSON from formData if present (e.g. from draft), else isCorrespondingAuthor
        let authors: string[];
        if (dataParsed.authors) {
          try {
            const parsed = JSON.parse(dataParsed.authors) as unknown;
            authors = Array.isArray(parsed)
              ? parsed.filter((a): a is string => typeof a === 'string')
              : [];
          } catch {
            authors = [];
          }
        } else {
          const isCorrespondingAuthor = dataParsed.isCorrespondingAuthor === 'true';
          authors = isCorrespondingAuthor ? [dataParsed.name] : [];
        }

        const result = await dbCreateWorkAndSubmission(ctx, ctx.user, form, {
          name: dataParsed.name,
          email: dataParsed.email,
          orcid: dataParsed.orcid,
          affiliation: dataParsed.affiliation,
          collectionId,
          workTitle: dataParsed.workTitle,
          workDescription: dataParsed.workDescription,
          authors,
        });

        return { submissionId: result.submissionId, workId: result.workId };
      },
      (error) => {
        return data(
          { error: { message: error.errors?.[0]?.message || 'Invalid form data' } },
          { status: 400 },
        );
      },
    );
}
