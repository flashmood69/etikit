export const COORDS_PER_MM = 10; // TPCL coordinates are always in 0.1mm units
export const DOTS_PER_MM = 8;   // Printer resolution (203 DPI = 8 dots/mm)

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
  font: string;
  width: number;
  height: number;
}

export interface BarcodeElement extends BaseElement {
  type: 'barcode';
  content?: string;
  barcodeType: string;
  height: number;
  width: number;
  ratio: string;
  checkDigitControl?: string;
  sequentialValue?: string;
  degreeRotation?: string;
  selectionOfCheckDigit?: string;
  selectionOfFont?: string;
}

export interface QRCodeElement extends BaseElement {
  type: 'qrcode';
  content?: string;
  qrType?: string;
  errorCorrection?: string;
  size: number;
  mode?: string;
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
  issueMode: string;
  quantity: number;
  speed?: string;
  sensor?: string;
  statusResponse?: string;
}

export interface LabelTemplate {
  name: string;
  width: number; // in dots or mm? usually dots for TPCL
  height: number;
  elements: LabelElement[];
  printSettings?: PrintSettings;
}
