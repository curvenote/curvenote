import { Link2 } from 'lucide-react';
import { ui } from '@curvenote/scms-core';
import { CONTACT_SALES_URL } from './doi.utils.js';

type EnterpriseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteTitle: string;
};

export function EnterpriseDialog({ open, onOpenChange, siteTitle }: EnterpriseDialogProps) {
  return (
    <ui.Dialog open={open} onOpenChange={onOpenChange}>
      <ui.DialogContent className="max-w-md text-center">
        <ui.DialogHeader className="items-center">
          <Link2 className="w-6 h-6" aria-hidden />
          <ui.DialogTitle>Use your own DOI prefix</ui.DialogTitle>
          <ui.DialogDescription>
            Upgrade to Enterprise to register DOIs using {siteTitle}&apos;s own prefix and Crossref
            membership.
          </ui.DialogDescription>
        </ui.DialogHeader>
        <ui.DialogFooter className="flex-col gap-2 sm:flex-col">
          <ui.Button asChild className="w-full">
            <a href={CONTACT_SALES_URL} target="_blank" rel="noopener noreferrer">
              Contact Sales
            </a>
          </ui.Button>
          <ui.DialogClose asChild>
            <ui.Button variant="ghost" className="w-full">
              Close
            </ui.Button>
          </ui.DialogClose>
        </ui.DialogFooter>
      </ui.DialogContent>
    </ui.Dialog>
  );
}
