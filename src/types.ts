export const COORDS_PER_MM = 10;
export const DOTS_PER_MM = 8;
export const DEFAULT_DPI = 203;

export type ElementType = 'text' | 'barcode' | 'qrcode' | 'line' | 'rectangle';

export interface BaseElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  rotation: number;
}

export interface TextElement extends BaseElement {
  type: 'text';
  content?: string;
  fontCode: string;
  width: number; // Magnification or scale
  height: number; // Magnification or scale
}

export interface BarcodeElement extends BaseElement {
  type: 'barcode';
  content?: string;
  barcodeType: string; // Generic type like 'code128', 'ean13'
  height: number;
  width: number; // Narrow bar width
  ratio?: number;
  showText?: boolean;
}

export interface QRCodeElement extends BaseElement {
  type: 'qrcode';
  content?: string;
  size: number;
  errorCorrection?: 'L' | 'M' | 'Q' | 'H';
}

export interface LineElement extends BaseElement {
  type: 'line';
  x2: number;
  y2: number;
  thickness: number;
}

export interface RectangleElement extends BaseElement {
  type: 'rectangle';
  width: number;
  height: number;
  thickness: number;
}

export type LabelElement = TextElement | BarcodeElement | QRCodeElement | LineElement | RectangleElement;

export interface PrintSettings {
  quantity: number;
  speed?: number;
  darkness?: number;
  dpi?: number;
}

export type Protocol = 'zpl' | 'tpcl';

export interface FontMetadata {
  key: string;
  label: string;
  fontFamily: string;
  fontSizePt: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
}

export interface BarcodeMetadata {
  type: string;
  label: string;
}

export interface LabelTemplate {
  name: string;
  width: number; // mm
  height: number; // mm
  elements: LabelElement[];
  printSettings?: PrintSettings;
  protocol: Protocol;
}

export interface EditorState {
  name: string;
  labelSize: { width: number; height: number };
  elements: LabelElement[];
  printSettings: PrintSettings;
  protocol: Protocol;
  selectedId: string | null;
}

export interface LabelDriver {
  protocol: Protocol;
  generate(label: LabelTemplate): string;
  parse(content: string): LabelTemplate;
  supportedExtensions: string[];
  supportedFonts: FontMetadata[];
  supportedBarcodes: BarcodeMetadata[];
}
