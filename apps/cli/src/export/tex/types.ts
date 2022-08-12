export type PdfBuildCommand = 'xelatex' | 'pdflatex';

export interface TexExportOptions {
  filename: string;
  command?: PdfBuildCommand;
  multiple?: boolean;
  images?: string;
  template?: string;
  templatePath?: string;
  options?: string;
  useBuildFolder?: boolean;
  texIsIntermediate?: boolean;
  converter?: 'inkscape' | 'imagemagick';
}
