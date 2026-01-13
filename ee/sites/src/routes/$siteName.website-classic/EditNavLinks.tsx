import type { SiteNavItem } from 'myst-config';
import { Link } from 'lucide-react';
import { AddLinkItemForm, EditLinkItemForm } from './LinkItemForms.js';
import { primitives, SectionWithHeading } from '@curvenote/scms-core';

export function EditNavLinks({ nav, canEdit }: { nav: SiteNavItem[]; canEdit: boolean }) {
  return (
    <SectionWithHeading heading="Navigation Links" icon={Link}>
      <primitives.Card lift className="p-12">
        <div className="flex flex-col space-y-6">
          {nav.map((n) => (
            <EditLinkItemForm key={n.url} item={n} disabled={!canEdit} />
          ))}
          <AddLinkItemForm disabled={!canEdit} />
        </div>
      </primitives.Card>
    </SectionWithHeading>
  );
}
