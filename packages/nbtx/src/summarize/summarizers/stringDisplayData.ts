/* eslint-disable import/no-cycle */
import type {
  CellOutput,
  KnownCellOutputMimeTypes,
  DisplayData,
  ExecuteResult,
  OutputSummaryEntry,
  OutputSummaryKind,
} from '@curvenote/blocks';
import { CellOutputType, ensureString } from '@curvenote/blocks';
import type { IFileObjectFactoryFn } from '../../files';
import Summarizer from './base';
import type { SummarizerOptions } from './types';
import { stripTypesFromOutputData } from './utils';

class StringDisplayDataSummarizer extends Summarizer {
  myKind: OutputSummaryKind;

  content_type: KnownCellOutputMimeTypes;

  additionalTypesToStrip: KnownCellOutputMimeTypes[];

  constructor(
    fileFactory: IFileObjectFactoryFn,
    item: CellOutput,
    basepath: string,
    kind: OutputSummaryKind,
    content_type: KnownCellOutputMimeTypes,
    additionalTypesToStrip: KnownCellOutputMimeTypes[],
    options?: SummarizerOptions,
  ) {
    super(fileFactory, item, basepath, options);
    this.myKind = kind;
    this.content_type = content_type;
    this.additionalTypesToStrip = additionalTypesToStrip;
  }

  test(item: CellOutput): boolean {
    return (
      (item.output_type === CellOutputType.DisplayData ||
        item.output_type === CellOutputType.ExecuteResult) &&
      this.content_type in item.data
    );
  }

  kind() {
    return this.myKind;
  }

  next() {
    return stripTypesFromOutputData(this.item as DisplayData | ExecuteResult, [
      this.content_type,
      ...this.additionalTypesToStrip,
    ]);
  }

  prepare(): OutputSummaryEntry {
    const { data } = this.item as DisplayData;
    return {
      kind: this.kind(),
      content_type: this.content_type,
      content: ensureString(data[this.content_type] as string[] | string),
    };
  }
}

export default StringDisplayDataSummarizer;
