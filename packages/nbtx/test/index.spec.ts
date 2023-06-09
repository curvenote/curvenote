import { describe, expect, it } from 'vitest';
import type { JsonObject, Blocks, NotebookCell, CellOutput } from '@curvenote/blocks';
import { KINDS, TARGET, ContentFormatTypes, CELL_TYPE } from '@curvenote/blocks';
import { translateToJupyter } from '../src';

describe('High level translator functions', () => {
  describe('Translate to Jupyter ', () => {
    describe('Mappings based on block KIND', () => {
      it('notebook', () => {
        const cell = translateToJupyter({
          kind: KINDS.Notebook,
          metadata: { nbformat: 0, nbformat_minor: 0 },
        } as Blocks.Notebook) as NotebookCell;
        expect(cell).toHaveProperty('cells');
        expect(cell).toHaveProperty('metadata');
        expect(cell).toHaveProperty('nbformat');
        expect(cell).toHaveProperty('nbformat_minor');
      });
      it('content > markdown', () => {
        const cell = translateToJupyter({
          kind: KINDS.Content,
          format: ContentFormatTypes.md,
          content: '',
          metadata: {
            jupyter: {
              collapsed: false,
              selected: true,
            },
          },
        } as unknown as Blocks.Content) as NotebookCell;
        expect(cell.cell_type).toEqual(CELL_TYPE.Markdown);
      });
      it('content > markdown (explicit)', () => {
        const cell = translateToJupyter({
          kind: KINDS.Content,
          targets: [TARGET.JupyterMarkdown],
          content: '',
          metadata: {
            jupyter: {
              collapsed: false,
              selected: true,
            },
          },
        } as unknown as Blocks.Content) as NotebookCell;
        expect(cell.cell_type).toEqual(CELL_TYPE.Markdown);
      });
      it('content > raw', () => {
        const cell = translateToJupyter({
          kind: KINDS.Content,
          format: ContentFormatTypes.txt,
          targets: [TARGET.JupyterRaw],
          content: '',
          metadata: {
            jupyter: {
              collapsed: false,
              selected: true,
            },
          },
        } as unknown as Blocks.Content) as NotebookCell;
        expect(cell.cell_type).toEqual(CELL_TYPE.Raw);
      });
      it('code', () => {
        const cell = translateToJupyter({
          kind: KINDS.Code,
          metadata: { jupyter: {} },
          content: '',
        } as Blocks.Code) as NotebookCell;
        expect(cell.cell_type).toEqual(CELL_TYPE.Code);
      });
      it('output', () => {
        const outputCell = translateToJupyter({
          kind: KINDS.Output,
          original: [{ a: 1 }, { b: 2 }] as JsonObject[],
        } as Blocks.Output) as CellOutput[];
        expect(outputCell).toEqual([{ a: 1 }, { b: 2 }]);
      });
    });
  });
});
