import { ui } from '@curvenote/scms-core';
import type { dbListAllDomains } from './db.server';
import classNames from 'classnames';
import type { FetcherWithComponents } from 'react-router';

type DomainsDBO = Awaited<ReturnType<typeof dbListAllDomains>>;
type DomainDBO = DomainsDBO[number];

interface DomainRowProps {
  domain: DomainDBO;
  isFirstInSite: boolean;
  isLastInSite: boolean;
  hasPrimaryDomain: boolean;
  backgroundColor: string;
  fetcher: FetcherWithComponents<{
    error?: string;
    success?: boolean;
    domains?: DomainsDBO;
  }>;
}

export function DomainRow({
  domain,
  isFirstInSite,
  isLastInSite,
  hasPrimaryDomain,
  backgroundColor,
  fetcher,
}: DomainRowProps) {
  const isSubmitting = fetcher.state === 'submitting';
  const isPrimary = domain.default;

  return (
    <tr
      className={classNames('group', backgroundColor, {
        'border-t border-gray-200': !isFirstInSite,
        'border-b border-gray-200': !isLastInSite,
      })}
    >
      <td
        className={classNames('px-3 py-2 align-middle', {
          'text-red-500': !hasPrimaryDomain,
        })}
      >
        {domain.site.name}
      </td>
      <td className="px-3 py-2 align-middle">{domain.hostname}</td>
      <td className="px-3 py-2 align-middle">
        {isPrimary ? (
          <span className="text-green-500">Primary</span>
        ) : (
          <span className="text-gray-500">Secondary</span>
        )}
      </td>
      <td className="px-3 py-2 align-middle">
        <fetcher.Form method="POST">
          <input type="hidden" name="action" value="set-default-domain" />
          <input type="hidden" name="domainId" value={domain.id} />
          <ui.StatefulButton
            variant="default"
            size="sm"
            type="submit"
            disabled={isPrimary}
            busy={isSubmitting}
            overlayBusy
            className={classNames({
              'opacity-50 cursor-not-allowed': isPrimary,
            })}
          >
            Set as Primary
          </ui.StatefulButton>
        </fetcher.Form>
      </td>
    </tr>
  );
}
