import type { ExtensionCheckService } from '@curvenote/scms-core';
import { CheckOptionItem } from './CheckOptionItem';
import type { ChecksObject } from './checks.schema';

interface WorkUploadChecksFormProps extends ChecksObject {
  checkServices: ExtensionCheckService[];
}

export function WorkUploadChecksForm({ enabled, checkServices }: WorkUploadChecksFormProps) {
  return (
    <div className="space-y-4">
      {/* Always show core Curvenote structure check */}
      <CheckOptionItem
        intent="toggle-check"
        name="curvenote-structure"
        label="Article Structure"
        description="Validate document structure, metadata, and formatting."
        checked={enabled.includes('curvenote-structure')}
        disabled={true}
      />

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

      {/* Text Integrity check (not yet implemented as extension) */}
      <CheckOptionItem
        intent="toggle-check"
        name="ithenticate"
        label="Text Integrity"
        description="Identify potential plagiarism and originality issues."
        checked={enabled.includes('ithenticate')}
        disabled={true}
      />
    </div>
  );
}
