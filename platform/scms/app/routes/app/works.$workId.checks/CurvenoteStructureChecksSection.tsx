import { SectionWithHeading, primitives, ui } from '@curvenote/scms-core';
import { CurvenoteIcon } from '@scienceicons/react/24/solid';

export function CurvenoteStructureChecksSection() {
  return (
    <SectionWithHeading heading="Curvenote Structure Checks" icon={CurvenoteIcon}>
      <primitives.Card lift className="p-6">
        <div className="flex flex-col justify-center items-center py-8 text-center">
          <CurvenoteIcon className="mb-4 w-16 h-16" />
          <h3 className="mb-2 text-lg font-semibold">No structure checks run yet</h3>
          <p className="mb-4 max-w-md text-sm text-muted-foreground">
            Run structure checks to validate document structure, metadata, and formatting.
          </p>
          <ui.Button variant="default" disabled>
            Run checks now
          </ui.Button>
        </div>
      </primitives.Card>
    </SectionWithHeading>
  );
}
