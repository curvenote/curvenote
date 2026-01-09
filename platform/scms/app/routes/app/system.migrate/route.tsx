import type { Route } from './+types/route';
import { withAppAdminContext } from '@curvenote/scms-server';
import { SystemAdminBadge, PageFrame, ui, primitives } from '@curvenote/scms-core';
import { data, Link, useFetcher } from 'react-router';
import classNames from 'classnames';
import {
  dbAddWorkToSubmission,
  dbCreateWorkUsers,
  dbListCollections,
  dbListSubmissions,
  dbListSubmissionsWithoutWorks,
  dbListWorksWithoutUsers,
  dbListAllDomains,
  dbSetDefaultDomain,
} from './db.server';
import { DomainManagement } from './DomainManagement';

export async function loader(args: Route.LoaderArgs) {
  await withAppAdminContext(args, { redirectTo: '/app' });
  return null;
}

export async function action(args: Route.ActionArgs) {
  await withAppAdminContext(args);
  const formData = await args.request.formData();
  const formAction = formData.get('action') as string;
  if (formAction === 'site-integrity') {
    const collections = await dbListCollections();
    const submissions = await dbListSubmissions();

    return { collections, submissions };
  } else if (formAction === 'work-owner') {
    const amount = formData.get('amount');
    const works = await dbListWorksWithoutUsers(amount ? +amount : 20);
    await Promise.all(works.map((work) => dbCreateWorkUsers(work)));
    return { works };
  } else if (formAction === 'submission-work') {
    const amount = formData.get('amount');
    const submissionsWithoutWorks = await dbListSubmissionsWithoutWorks(amount ? +amount : 20);
    await Promise.all(submissionsWithoutWorks.map((sub) => dbAddWorkToSubmission(sub.id)));
    return { submissionsWithWorks: submissionsWithoutWorks };
  } else if (formAction === 'list-domains') {
    const domains = await dbListAllDomains();
    return { domains };
  } else if (formAction === 'set-default-domain') {
    const domainId = formData.get('domainId');
    if (typeof domainId !== 'string') {
      return data({ error: 'Invalid domain ID' }, { status: 400 });
    }
    await dbSetDefaultDomain(domainId);
    const domains = await dbListAllDomains();
    return { domains };
  }
  return data({ error: 'Invalid form action' }, { status: 400 });
}

export default function Migrate() {
  const fetcher = useFetcher<typeof action>();
  const collections =
    fetcher.data && 'collections' in fetcher.data ? fetcher.data.collections : undefined;
  const submissions =
    fetcher.data && 'submissions' in fetcher.data ? fetcher.data.submissions : undefined;
  const works = fetcher.data && 'works' in fetcher.data ? fetcher.data.works : undefined;
  const submissionsWithWorks =
    fetcher.data && 'submissionsWithWorks' in fetcher.data
      ? fetcher.data.submissionsWithWorks
      : undefined;

  return (
    <PageFrame title="Migration Tools">
      <SystemAdminBadge />
      <h2 className="text-xl font-bold">Site / Collection / Kind integrity</h2>
      <p className="max-w-xl">
        This integrity check will show you which collections contain which kinds, and which
        submissions are in the database. If a submission is in a kind that is not associated with
        the site or is not in the collection is will be highlighted in red.
      </p>
      <fetcher.Form method="POST">
        <input type="hidden" name="action" value="site-integrity" />
        <ui.StatefulButton
          type="submit"
          disabled={fetcher.state === 'loading'}
          busy={fetcher.state === 'submitting'}
          overlayBusy
        >
          Run Query
        </ui.StatefulButton>
      </fetcher.Form>
      {collections && submissions && fetcher.state === 'idle' && (
        <>
          <h3 className="text-lg">Collections</h3>
          <div className="my-8">
            <table className="font-mono text-xs">
              <thead>
                <tr>
                  <th className="px-3 py-1 text-left">Collection</th>
                  <th className="px-3 py-1 text-left">Kinds</th>
                </tr>
              </thead>
              <tbody>
                {collections.map((c) => (
                  <tr key={c.id} className="bg-green-50 even:bg-green-100">
                    <td className="px-3 py-2 align-top">{`${c.name} (${c.site.name} - ${c.id})`}</td>
                    <td className="px-3 py-2 align-top">
                      <ul>
                        {c.kindsInCollection.map((kic) => (
                          <li
                            key={c.id + kic.id}
                          >{`${kic.kind.name} (${kic.kind.site.name} - ${kic.kind.id})`}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className="text-lg">Submissions</h3>
          <div className="my-8">
            <table className="font-mono text-xs">
              <thead>
                <tr>
                  <th className="px-3 py-1 text-left">Site</th>
                  <th className="px-3 py-1 text-left">Kind</th>
                  <th className="px-3 py-1 text-left">Collection</th>
                  <th className="px-3 py-1 text-left">Submission</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.id} className={classNames('bg-green-50 even:bg-green-100')}>
                    <td className="px-3 py-2 align-top">{s.site.name}</td>
                    <td
                      className={classNames('px-3 py-2 align-top', {
                        'text-red-500':
                          s.site.id !== s.kind.site.id ||
                          !s.collection.kindsInCollection.some((kic) => kic.kind.id === s.kind.id),
                      })}
                    >{`${s.kind.name} (${s.kind.site.name})`}</td>
                    <td
                      className={classNames('px-3 py-2 align-top', {
                        'text-red-500': !s.collection.kindsInCollection.some(
                          (kic) => kic.kind.id === s.kind.id,
                        ),
                      })}
                    >{`${(s.collection.content as any)?.title ?? 'no title'} (${s.collection.site.name})`}</td>
                    <td className="px-3 py-2 align-top">
                      <Link
                        className="underline"
                        to={`/app/sites/${s.site.name}/submissions/${s.id}`}
                      >
                        {s.id}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2 className="text-xl font-bold">Grant Work Owner Permissions</h2>
      <p className="max-w-xl">
        This migration will find all works with no users in the WorkUser list and grant the user who
        created the work OWNER permissions.
      </p>
      <fetcher.Form className="max-w-lg py-4 space-y-2" method="POST">
        <input type="hidden" name="action" value="work-owner" />
        <primitives.TextField
          id="amount"
          name="amount"
          label={'Number of Works to migrate'}
          required
        />
        <ui.StatefulButton
          type="submit"
          disabled={fetcher.state === 'loading'}
          busy={fetcher.state === 'submitting'}
          overlayBusy
        >
          Run Migration
        </ui.StatefulButton>
        {works && fetcher.state === 'idle' && (
          <div>
            <p>Added user for {works.length} works</p>
            {works.length > 0 && (
              <>
                <div>
                  Owners include{' '}
                  {[...new Set(works.map((work) => work.created_by.display_name))].join(', ')}
                </div>
                <ul className="text-xs list-disc list-inside">
                  {works.map((w) => (
                    <li key={w.id}>
                      {w.id} - {w.created_by.display_name}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </fetcher.Form>

      <h2 className="text-xl font-bold">Add Work to Submissions</h2>
      <p className="max-w-xl">
        This migration will find all Submissions without a Work. It will find the Work from the
        latest Submission Version and add that to the Submission.
      </p>
      <fetcher.Form className="max-w-lg py-4 space-y-2" method="POST">
        <input type="hidden" name="action" value="submission-work" />
        <primitives.TextField
          id="amount"
          name="amount"
          label={'Number of Submissions to migrate'}
          required
        />
        <ui.StatefulButton
          type="submit"
          disabled={fetcher.state === 'loading'}
          busy={fetcher.state === 'submitting'}
          overlayBusy
        >
          Run Migration
        </ui.StatefulButton>
        {submissionsWithWorks && fetcher.state === 'idle' && (
          <div>
            <p>Added works to {submissionsWithWorks.length} submissions</p>
            {submissionsWithWorks.length > 0 && (
              <>
                <div>
                  Sites with these submissions include{' '}
                  {[...new Set(submissionsWithWorks.map((sub) => sub.site.name))].join(', ')}
                </div>
                <ul className="text-xs list-disc list-inside">
                  {submissionsWithWorks.map((sub) => (
                    <li key={sub.id}>
                      {sub.id} - {sub.submitted_by.display_name}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </fetcher.Form>

      <DomainManagement />
    </PageFrame>
  );
}
