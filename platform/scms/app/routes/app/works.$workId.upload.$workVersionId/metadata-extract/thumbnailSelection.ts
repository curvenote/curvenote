/**
 * Stable locator for a selected thumbnail figure, shared by the client (selection UI)
 * and the server (materialisation on submit).
 *
 * Encodes the source file path and the image's index within that file. The source
 * file's parsed AST is cached by md5, so this index is stable unless the file is
 * re-uploaded — unlike a flattened global index across all files, which can shift
 * when previews change.
 */

const SEP = '\u0000';

export interface FigureLocatorParts {
  sourcePath: string;
  figureIndex: number;
}

export function encodeFigureLocator({ sourcePath, figureIndex }: FigureLocatorParts): string {
  return `${sourcePath}${SEP}${figureIndex}`;
}

export function decodeFigureLocator(locator: string): FigureLocatorParts | null {
  const sep = locator.lastIndexOf(SEP);
  if (sep < 0) return null;
  const sourcePath = locator.slice(0, sep);
  const figureIndex = Number.parseInt(locator.slice(sep + SEP.length), 10);
  if (!sourcePath || Number.isNaN(figureIndex) || figureIndex < 0) return null;
  return { sourcePath, figureIndex };
}
