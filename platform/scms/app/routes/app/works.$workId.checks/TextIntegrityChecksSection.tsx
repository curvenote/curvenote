import { SectionWithHeading, primitives, ui } from '@curvenote/scms-core';
import { FileCheck } from 'lucide-react';

export function TextIntegrityChecksSection() {
  return (
    <SectionWithHeading heading="Text Integrity Check (iThenticate)" icon={FileCheck}>
      <primitives.Card lift className="p-6">
        <div className="flex flex-col justify-center items-center py-8 text-center">
          <FileCheck className="mb-4 w-16 h-16 text-muted-foreground" strokeWidth={1.5} />
          <h3 className="mb-2 text-lg font-semibold">No text integrity checks run yet</h3>
          <p className="mb-4 max-w-md text-sm text-muted-foreground">
            Run text integrity checks to identify potential plagiarism and originality issues.
          </p>
          <ui.Button variant="default" disabled>
            Run checks now
          </ui.Button>
        </div>
      </primitives.Card>
    </SectionWithHeading>
  );
}
