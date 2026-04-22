import type { ExtensionCheckService } from '@curvenote/scms-core';
import { CheckOptionItem } from './CheckOptionItem';
import type { ChecksObject } from '@curvenote/scms-server';

interface WorkUploadChecksFormProps extends ChecksObject {
  checkServices: ExtensionCheckService[];
}

export function WorkUploadChecksForm({ enabled, checkServices }: WorkUploadChecksFormProps) {
  return (
    <div className="space-y-4">
      {/* Dynamically render check options from extension check services */}
      {checkServices.map((service) => (
        <CheckOptionItem
          key={service.id}
          intent="toggle-check"
          name={service.id as any}
          label={service.name}
          description={service.description}
          checked={enabled.includes(service.id as any)}
          disabled={false}
        />
      ))}

      {/* Always show core Curvenote structure check */}
      <CheckOptionItem
        intent="toggle-check"
        name="curvenote-structure"
        label={
          <span>
            Article Structure <sup className="text-xs font-light">(coming soon)</sup>
          </span>
        }
        description="Validate document structure, metadata, and formatting."
        checked={enabled.includes('curvenote-structure')}
        disabled={true}
      />
    </div>
  );
}
