/* eslint-disable import/no-cycle */
import type {
  CellOutput,
  DisplayData,
  ExecuteResult,
  OutputSummaryEntry,
  OutputSummary,
} from '@curvenote/blocks';
import { KnownCellOutputMimeTypes, OutputSummaryKind } from '@curvenote/blocks';
import type { IFileObjectFactoryFn } from '../files';
import { ORDER, Summarizer } from './summarizers';
import type { SummarizerOptions } from './summarizers/types';

export const summarizeDisplayDataOrExecuteResult = async (
  fileFactory: IFileObjectFactoryFn,
  item: CellOutput,
  basepath: string,
  options: SummarizerOptions,
) => {
  const dbo: OutputSummary = {
    kind: OutputSummaryKind.unknown,
    items: {},
  };
  const summaries: { summary: OutputSummaryEntry; summarizer: Summarizer }[] = [];
  const unprocessed = ORDER.reduce<DisplayData | ExecuteResult>(
    (output, kind) => {
      const summarizer = Summarizer.new(fileFactory, kind, output, basepath, options);
      if (summarizer != null && summarizer.test(output)) {
        if (dbo.kind === OutputSummaryKind.unknown) dbo.kind = kind;
        const summary = summarizer.prepare();
        summaries.push({ summary, summarizer });
        const nextItem = summarizer.next() as DisplayData | ExecuteResult;
        return nextItem;
      }
      return output;
    },
    { ...item } as DisplayData | ExecuteResult,
  );

  const entries = await Promise.all(
    summaries.map(async ({ summary, summarizer }) => {
      const dboEntry = await summarizer.process(summary);
      return [summary.kind, dboEntry];
    }),
  );

  dbo.items = Object.fromEntries(entries);

  // there may be remaining unprocessed keys/entries? do something with them?
  if (Object.keys((unprocessed as DisplayData | ExecuteResult)?.data ?? {}).length > 0) {
    dbo.items = {
      ...dbo.items,
      [OutputSummaryKind.unknown]: {
        kind: OutputSummaryKind.unknown,
        content_type: KnownCellOutputMimeTypes.TextPlain,
        content: Object.keys((unprocessed as DisplayData | ExecuteResult)?.data ?? {}).join(', '),
      },
    };
  }

  return dbo;
};
