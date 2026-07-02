export enum BioRxivTrackEvent {
  BIORXIV_TASK_CARD_CLICKED = 'bioRxiv Task Card Clicked',
}

export const BioRxivTrackEventDescriptions: Record<BioRxivTrackEvent, string> = {
  [BioRxivTrackEvent.BIORXIV_TASK_CARD_CLICKED]: 'User clicked the bioRxiv submission task card',
};
