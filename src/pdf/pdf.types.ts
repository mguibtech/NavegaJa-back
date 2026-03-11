export type PdfStream = NodeJS.ReadableStream & {
  end: () => void;
  pipe: (destination: NodeJS.WritableStream) => NodeJS.WritableStream;
  fontSize: (size: number) => PdfStream;
  font: (name: string) => PdfStream;
  fillColor: (color: string) => PdfStream;
  text: (
    text: string,
    x?: number,
    y?: number,
    options?: Record<string, unknown>,
  ) => PdfStream;
  moveTo: (x: number, y: number) => PdfStream;
  lineTo: (x: number, y: number) => PdfStream;
  stroke: (color?: string) => PdfStream;
  image: (
    src: Buffer,
    x?: number,
    y?: number,
    options?: { width?: number; height?: number },
  ) => PdfStream;
  addPage: () => PdfStream;
};

export type PdfDocumentCtor = new (options?: {
  margin?: number;
  size?: string;
}) => PdfStream;
