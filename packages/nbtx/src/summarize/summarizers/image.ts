/* eslint-disable import/no-cycle */
import type {
  CellOutput,
  DisplayData,
  ExecuteResult,
  OutputData,
  OutputSummaryEntry,
} from '@curvenote/blocks';
import {
  KnownCellOutputMimeTypes,
  CellOutputType,
  ensureString,
  OutputSummaryKind,
} from '@curvenote/blocks';
import type { IFileObjectFactoryFn } from '../../files';
import Summarizer from './base';
import { dictHasOneOf, stripTypesFromOutputData } from './utils';

const RankedImageTypes = [
  KnownCellOutputMimeTypes.ImagePng,
  KnownCellOutputMimeTypes.ImageJpeg,
  KnownCellOutputMimeTypes.ImageGif,
  KnownCellOutputMimeTypes.ImageBmp,
];

class ImageSummarizer extends Summarizer {
  data: OutputData;

  selectedContentType: KnownCellOutputMimeTypes | null;

  constructor(fileFactory: IFileObjectFactoryFn, item: CellOutput, basepath: string) {
    super(fileFactory, item, basepath);
    this.data = (item as DisplayData).data;
    this.selectedContentType = this.$pickBestImageType();
  }

  test(item: CellOutput): boolean {
    return (
      (item.output_type === CellOutputType.DisplayData ||
        item.output_type === CellOutputType.ExecuteResult) &&
      dictHasOneOf(item.data, RankedImageTypes)
    );
  }

  kind() {
    return OutputSummaryKind.image;
  }

  $pickBestImageType(): KnownCellOutputMimeTypes | null {
    return RankedImageTypes.reduce<KnownCellOutputMimeTypes | null>((selected, mtype) => {
      if (selected !== null) return selected;
      return mtype in this.data ? mtype : null;
    }, null);
  }

  $selectedTypeError() {
    return Error(
      `Trying to summarize as image but no image types found ${Object.keys(this.data).join(',')}`,
    );
  }

  /**
   * Removes the image key that this summarizer will process
   */
  next() {
    if (this.selectedContentType == null) throw this.$selectedTypeError();
    return stripTypesFromOutputData(this.item as DisplayData | ExecuteResult, [
      this.selectedContentType,
      KnownCellOutputMimeTypes.TextPlain,
    ]);
  }

  prepare(): OutputSummaryEntry {
    if (this.selectedContentType == null) throw this.$selectedTypeError();
    const base64 = ensureString(this.data[this.selectedContentType] as string).replace(/\n/g, '');
    return {
      kind: this.kind(),
      content_type: this.selectedContentType,
      content: `data:${this.selectedContentType};base64,${base64}`,
    };
  }

  async process(summary: OutputSummaryEntry): Promise<OutputSummaryEntry> {
    const filepath = this.$makeFilepath(summary.content_type);
    const outputFile = this.fileFactory(filepath);
    await outputFile.writeBase64(summary.content as string);
    return {
      kind: summary.kind,
      content_type: summary.content_type,
      path: outputFile.id,
    };
  }
}

export default ImageSummarizer;
