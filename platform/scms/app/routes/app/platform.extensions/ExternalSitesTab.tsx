import { ui, primitives } from '@curvenote/scms-core';
import type { Route } from './+types/route';

type Site = Route.ComponentProps['loaderData']['sites'][number];

export function ExternalSitesTab({ sites }: { sites: Site[] }) {
  if (sites.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No external sites are configured in this deployment.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {sites.map((site) => (
        <primitives.Card key={site.id} lift>
          <div className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-semibold">{site.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{site.description}</p>
              </div>
              <div className="text-sm text-muted-foreground">
                {site.private ? 'Private' : 'Public'} • {site.restricted ? 'Restricted' : 'Open'}{' '}
                Access
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-medium">Domains</h3>
                <div className="flex flex-wrap gap-2">
                  {site.domains.map((domain) => (
                    <ui.Badge key={domain.id} variant="default">
                      {domain.hostname}
                    </ui.Badge>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium">Default Workflow</h3>
                <p className="text-sm text-muted-foreground">{site.default_workflow}</p>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium">Submission Kinds</h3>
                <div className="flex flex-wrap gap-2">
                  {site.submissionKinds.map((kind) => {
                    const content = kind.content as { title?: string };
                    return (
                      <ui.Badge key={kind.id} variant="default">
                        {content?.title || kind.name}
                      </ui.Badge>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium">Collections</h3>
                <div className="flex flex-wrap gap-2">
                  {site.collections.map((collection) => {
                    const content = collection.content as { title?: string };
                    return (
                      <ui.Badge key={collection.id} variant="default">
                        {content?.title || collection.name}
                      </ui.Badge>
                    );
                  })}
                </div>
              </div>
            </div>

            <details className="mt-6">
              <summary className="text-sm font-medium cursor-pointer">Site Metadata</summary>
              <pre className="overflow-auto p-4 mt-2 text-sm rounded-md bg-muted">
                {JSON.stringify(site.metadata, null, 2)}
              </pre>
            </details>
          </div>
        </primitives.Card>
      ))}
    </div>
  );
}
