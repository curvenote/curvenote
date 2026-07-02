import { primitives, usePingEvent } from '@curvenote/scms-core';
import bioRxivGraphic from './assets/bioRxiv-favicon.svg';
import { BioRxivTrackEvent } from './analytics.js';

const BIORXIV_SUBMISSION_URL = 'https://www.biorxiv.org/submit-a-manuscript';

export function BioRxivTaskCard() {
  const pingEvent = usePingEvent();

  return (
    <a
      href={BIORXIV_SUBMISSION_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        pingEvent(
          BioRxivTrackEvent.BIORXIV_TASK_CARD_CLICKED,
          { url: BIORXIV_SUBMISSION_URL },
          { anonymous: true, ignoreAdmin: true },
        );
      }}
      className="block h-full"
    >
      <primitives.Card
        lift
        className="relative p-0 h-full bg-white transition-colors border-stone-400 hover:bg-accent/50"
      >
        <div className="px-2 py-4 w-full h-full cursor-pointer">
          <div className="flex gap-2 items-center mx-2 h-full">
            <div className="flex-shrink-0">
              <img src={bioRxivGraphic} alt="bioRxiv logo" className="w-20 h-20" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="text-lg font-normal">Submit to bioRxiv</h3>
              <p className="text-sm text-muted-foreground line-clamp-3">
                Visit bioRxiv to learn about preprint submissions and start the process.
              </p>
            </div>
          </div>
        </div>
      </primitives.Card>
    </a>
  );
}
