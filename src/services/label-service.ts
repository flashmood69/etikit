import { 
  LabelElement, 
  TextElement, 
  BarcodeElement, 
  QRCodeElement, 
  LineElement, 
  RectangleElement,
  ElementType,
  LabelTemplate, 
  DOTS_PER_MM, 
  COORDS_PER_MM, 
  PrintSettings, 
  Protocol, 
  FontMetadata, 
  DEFAULT_DPI 
} from '../types';
import { drivers } from '../drivers';

export const FONT_FAMILY_CSS: Record<string, string> = {
  times: '"Times New Roman", Times, serif',
  helvetica: 'Helvetica, Arial, sans-serif',
  courier: '"Courier New", Courier, monospace',
  presentation: '"Arial Black", Arial, sans-serif',
  'letter-gothic': '"Courier New", Courier, monospace',
  'prestige-elite': '"Courier New", Courier, monospace',
  'ocr-a': '"OCR A Std", "OCR A", monospace',
  'ocr-b': '"OCR B Std", "OCR B", monospace'
};

export const MM_PER_PT = 25.4 / 72;
export const TEXT_FONT_SIZE_SCALE = 1.4;
const ZPL_FONT_ZERO_WIDTH_SCALE = 0.8;
// TPCL barcode/QR module fields correspond to about 12 modules per mm.
const TPCL_SYMBOL_MODULE_SCALE = 2 / 3;
export const COMMON_DPI_PRESETS = [203, 300, 600];

export type LabelSizePreset = {
  id: string
  widthMm: number
  heightMm: number
}

export const LABEL_SIZE_PRESETS: LabelSizePreset[] = [
  { id: '102x76', widthMm: 102, heightMm: 76 },
  { id: '102x152', widthMm: 102, heightMm: 152 },
  { id: '100x150', widthMm: 100, heightMm: 150 },
  { id: '90x50', widthMm: 90, heightMm: 50 },
  { id: '102x51', widthMm: 102, heightMm: 51 },
  { id: '76x51', widthMm: 76, heightMm: 51 },
  { id: '70x50', widthMm: 70, heightMm: 50 },
  { id: '58x40', widthMm: 58, heightMm: 40 },
  { id: '50x25', widthMm: 50, heightMm: 25 },
  { id: '38x25', widthMm: 38, heightMm: 25 },
]

export const DEFAULT_LABEL_SIZE_PRESET_ID = '102x76'

const textMetricsCache = new Map<string, { ascent: number; descent: number }>();

export function normalizeTextScale(val: number) {
  return val >= 10 ? val / 10 : (val <= 0 ? 1 : val);
}

export function normalizeDpiToPreset(dpi: number) {
  const value = typeof dpi === 'number' && Number.isFinite(dpi) && dpi > 0 ? Math.round(dpi) : DEFAULT_DPI;
  if (COMMON_DPI_PRESETS.includes(value)) return value;
  let best = COMMON_DPI_PRESETS[0] ?? DEFAULT_DPI;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const preset of COMMON_DPI_PRESETS) {
    const diff = Math.abs(preset - value);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = preset;
    }
  }
  return best;
}

export function getDpi(printSettings: PrintSettings | undefined) {
  const dpi = printSettings?.dpi;
  if (typeof dpi !== 'number' || !Number.isFinite(dpi) || dpi <= 0) return DEFAULT_DPI;
  return dpi;
}

export function formatMm(value: number) {
  if (!Number.isFinite(value)) return String(value);
  const rounded = Math.round(value * 10) / 10;
  return rounded % 1 === 0 ? String(Math.round(rounded)) : rounded.toFixed(1);
}

export function roundMm(value: number) {
  if (!Number.isFinite(value)) return value;
  return Math.round(value * 10) / 10;
}

export function mmToPx(mm: number, zoom: number) {
  return mm * zoom;
}

export function createDefaultPrintSettings(dpi?: number): PrintSettings {
  return {
    quantity: 1,
    speed: 3,
    darkness: 10,
    dpi: normalizeDpiToPreset(dpi ?? DEFAULT_DPI)
  };
}

export function createDefaultGridSettings(): { enabled: boolean; visible: boolean; size: number } {
  return {
    enabled: false,
    visible: false,
    size: 2, // 2mm default
  };
}

export function getFileBaseName(filename: string) {
  const trimmed = (filename || '').trim();
  if (trimmed.length === 0) return 'Untitled';
  const lastDot = trimmed.lastIndexOf('.');
  if (lastDot <= 0) return trimmed;
  return trimmed.slice(0, lastDot);
}

export function formatInches(valueMm: number) {
  if (!Number.isFinite(valueMm)) return String(valueMm);
  const inches = valueMm / 25.4;
  const rounded = Math.round(inches * 10) / 10;
  return rounded % 1 === 0 ? String(Math.round(rounded)) : rounded.toFixed(1);
}

export function formatLabelSizePreset(preset: { widthMm: number; heightMm: number }) {
  return `${formatMm(preset.widthMm)} × ${formatMm(preset.heightMm)} mm (${formatInches(preset.widthMm)}" × ${formatInches(preset.heightMm)}")`;
}

export async function loadTemplate(file: File): Promise<{
  elements: LabelElement[];
  width: number;
  height: number;
  labelName: string;
  printSettings: PrintSettings;
  protocol: Protocol;
} | null> {
  const buffer = await file.arrayBuffer();
  let content = '';
  let template: LabelTemplate | null = null;

  // Try JSON first
  try {
    const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
    content = utf8Decoder.decode(buffer);
    try {
      const parsed = JSON.parse(content);
      if (parsed.elements && Array.isArray(parsed.elements)) {
        template = parsed as LabelTemplate;
      }
    } catch (e) {
      // Not JSON
    }
  } catch (e) {
    // Not UTF-8
  }

  // If not JSON, try drivers
  if (!template) {
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    const driver = Object.values(drivers).find(d => d.supportedExtensions.includes(ext));
    if (driver) {
      // Try different encodings for drivers
      try {
        const win1252Decoder = new TextDecoder('windows-1252');
        content = win1252Decoder.decode(buffer);
        template = driver.parse(content);
      } catch (err) {
        const utf8Decoder = new TextDecoder('utf-8');
        content = utf8Decoder.decode(buffer);
        template = driver.parse(content);
      }
    }
  }

  if (template && template.elements && Array.isArray(template.elements)) {
    const rawPs = (template as any).printSettings as any;
    const migratedPs: PrintSettings = (() => {
      const dpiFromLegacy =
        template.protocol === 'zpl' &&
        rawPs &&
        typeof rawPs.zplDotsPerMm === 'number' &&
        Number.isFinite(rawPs.zplDotsPerMm) &&
        rawPs.zplDotsPerMm > 0
          ? Math.round(rawPs.zplDotsPerMm * 25.4)
          : undefined;
      const dpi =
        typeof rawPs?.dpi === 'number' && Number.isFinite(rawPs.dpi) && rawPs.dpi > 0 ? rawPs.dpi : (dpiFromLegacy ?? DEFAULT_DPI);
      const quantity =
        typeof rawPs?.quantity === 'number' && Number.isFinite(rawPs.quantity) && rawPs.quantity > 0 ? rawPs.quantity : 1;
      const speed = typeof rawPs?.speed === 'number' && Number.isFinite(rawPs.speed) ? rawPs.speed : 3;
      const darkness = typeof rawPs?.darkness === 'number' && Number.isFinite(rawPs.darkness) ? rawPs.darkness : 10;
      return { quantity, speed, darkness, dpi: normalizeDpiToPreset(dpi) };
    })();

    let protocol = template.protocol;
    if (!protocol) {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.ezpl')) protocol = 'zpl';
      if (lower.endsWith('.etec')) protocol = 'tpcl';
    }

    return {
      elements: template.elements,
      width: roundMm(template.width),
      height: roundMm(template.height),
      labelName: getFileBaseName(file.name),
      printSettings: migratedPs,
      protocol: protocol ?? 'tpcl'
    };
  }
  return null;
}

export function resolveFontMeta(textEl: TextElement, supportedFonts: FontMetadata[]) {
  return supportedFonts.find((p) => p.key === textEl.fontCode) ?? supportedFonts[0];
}

export function getTextScales(textEl: TextElement, protocol: Protocol) {
  if (protocol === 'zpl') {
    const widthDots = typeof textEl.width === 'number' && Number.isFinite(textEl.width) ? textEl.width : 0;
    const heightDots = typeof textEl.height === 'number' && Number.isFinite(textEl.height) ? textEl.height : 0;
    const fontWidthCorrection = textEl.fontCode === '0' ? ZPL_FONT_ZERO_WIDTH_SCALE : 1;
    const scaleX = (widthDots > 0 && heightDots > 0 ? (widthDots / heightDots) : 1) * fontWidthCorrection;
    return { scaleX, scaleY: 1 };
  }
  const scaleX = normalizeTextScale(textEl.width || 10);
  const scaleY = normalizeTextScale(textEl.height || 10);
  return { scaleX, scaleY };
}

export function getTextFontStyle(
  textEl: TextElement,
  zoom: number,
  supportedFonts: FontMetadata[],
  protocol: Protocol,
  printSettings: PrintSettings
) {
  const fontMeta = resolveFontMeta(textEl, supportedFonts);
  const fontFamilyKey = fontMeta?.fontFamily ?? 'helvetica';
  const fontFamily = FONT_FAMILY_CSS[fontFamilyKey] || FONT_FAMILY_CSS.helvetica;
  const fontWeight = fontMeta?.fontWeight ?? 'normal';
  const fontStyle = fontMeta?.fontStyle ?? 'normal';
  const fontSizePx = (() => {
    if (protocol === 'tpcl') return (fontMeta?.fontSizePt ?? 10) * MM_PER_PT * zoom;
    const targetDotsPerMm = getDpi(printSettings) / 25.4;
    const heightDots =
      typeof textEl.height === 'number' && Number.isFinite(textEl.height) && textEl.height > 0
        ? textEl.height
        : Math.max(1, Math.round(((fontMeta?.fontSizePt ?? 10) * MM_PER_PT) * TEXT_FONT_SIZE_SCALE * targetDotsPerMm));
    return (heightDots / targetDotsPerMm) * zoom;
  })();
  return { fontSizePx, fontWeight, fontStyle, fontFamily };
}

export function getUnitsPerMm(protocol: Protocol, printSettings: PrintSettings) {
  return protocol === 'zpl' ? (getDpi(printSettings) / 25.4) : COORDS_PER_MM;
}

export function pxToUnits(px: number, zoom: number, protocol: Protocol, printSettings: PrintSettings) {
  return Math.round((px / zoom) * getUnitsPerMm(protocol, printSettings));
}

export function unitsToPx(units: number, zoom: number, protocol: Protocol, printSettings: PrintSettings) {
  return (units / getUnitsPerMm(protocol, printSettings)) * zoom;
}

export function unitsToMm(units: number, protocol: Protocol, printSettings: PrintSettings) {
  return units / getUnitsPerMm(protocol, printSettings);
}

export function rescaleElementsForDpi(elements: LabelElement[], prevDpi: number, nextDpi: number): LabelElement[] {
  if (!Number.isFinite(prevDpi) || prevDpi <= 0) return elements;
  if (!Number.isFinite(nextDpi) || nextDpi <= 0) return elements;
  if (Math.abs(nextDpi - prevDpi) < 0.001) return elements;

  const ratio = nextDpi / prevDpi;
  return elements.map((el) => {
    if (el.type !== 'text') return el;
    const textEl = el as TextElement;
    const w = typeof textEl.width === 'number' && Number.isFinite(textEl.width) ? textEl.width : 0;
    const h = typeof textEl.height === 'number' && Number.isFinite(textEl.height) ? textEl.height : 0;
    return {
      ...textEl,
      width: Math.max(1, Math.round(w * ratio)),
      height: Math.max(1, Math.round(h * ratio))
    };
  });
}

export function mmToUnits(mm: number, protocol: Protocol, printSettings: PrintSettings) {
  return mm * getUnitsPerMm(protocol, printSettings);
}

export function createDefaultElement(type: ElementType, protocol: Protocol, printSettings: PrintSettings, supportedFonts: FontMetadata[], supportedBarcodes: any[]): LabelElement {
  const id = Math.random().toString(36).substr(2, 9);
  const base = {
    id,
    type,
    x: 100,
    y: 100,
    rotation: 0,
  };

  switch (type) {
    case 'text': {
      const defaultFont = supportedFonts[0];
      const defaultTextSize = (() => {
        if (protocol !== 'zpl') return { width: 10, height: 10 };
        const targetDotsPerMm = getDpi(printSettings) / 25.4;
        const heightDots = Math.max(
          1,
          Math.round((((defaultFont?.fontSizePt ?? 10) * MM_PER_PT) * TEXT_FONT_SIZE_SCALE) * targetDotsPerMm)
        );
        return { width: heightDots, height: heightDots };
      })();
      return {
        ...base,
        type: 'text',
        content: 'New Text',
        fontCode: defaultFont?.key ?? '0',
        width: defaultTextSize.width,
        height: defaultTextSize.height
      } as TextElement;
    }
    case 'barcode': {
      const defaultBarcode = supportedBarcodes[0];
      return {
        ...base,
        type: 'barcode',
        content: '12345678',
        barcodeType: defaultBarcode?.type ?? 'code128',
        height: 100,
        width: 3
      } as BarcodeElement;
    }
    case 'qrcode':
      return { ...base, type: 'qrcode', content: '12345678', size: 5 } as QRCodeElement;
    case 'line':
      return { ...base, type: 'line', x2: 200, y2: 100, thickness: 3 } as LineElement;
    case 'rectangle':
      return { ...base, type: 'rectangle', width: 200, height: 100, thickness: 3 } as RectangleElement;
    default:
      throw new Error(`Unsupported element type: ${type}`);
  }
}

export function baseDotsToPx(dots: number, zoom: number) {
  return (dots / DOTS_PER_MM) * zoom;
}

function getCode128ModuleCount(value: string) {
  const countSetA = (input: string): number => {
    const untilC = input.match(/^([\x00-\x5F\xC8-\xCF]+?)([0-9]{2}(?:[0-9]{2})+)([^0-9]|$)/);
    if (untilC) return untilC[1].length + 1 + countSetC(input.slice(untilC[1].length));
    const chars = input.match(/^[\x00-\x5F\xC8-\xCF]+/)?.[0] ?? '';
    if (chars.length === 0) return input.length;
    return chars.length === input.length ? chars.length : chars.length + 1 + countSetB(input.slice(chars.length));
  };
  const countSetB = (input: string): number => {
    const untilC = input.match(/^([\x20-\x7F\xC8-\xCF]+?)([0-9]{2}(?:[0-9]{2})+)([^0-9]|$)/);
    if (untilC) return untilC[1].length + 1 + countSetC(input.slice(untilC[1].length));
    const chars = input.match(/^[\x20-\x7F\xC8-\xCF]+/)?.[0] ?? '';
    if (chars.length === 0) return input.length;
    return chars.length === input.length ? chars.length : chars.length + 1 + countSetA(input.slice(chars.length));
  };
  const countSetC = (input: string): number => {
    const pairs = input.match(/^(?:\xCF*[0-9]{2}\xCF*)+/)?.[0] ?? '';
    const remaining = input.slice(pairs.length);
    if (remaining.length === 0) return pairs.replace(/\xCF/g, '').length / 2;
    const setA = remaining.match(/^[\x00-\x5F\xC8-\xCF]*/)?.[0].length ?? 0;
    const setB = remaining.match(/^[\x20-\x7F\xC8-\xCF]*/)?.[0].length ?? 0;
    return pairs.replace(/\xCF/g, '').length / 2 + 1 + (setA >= setB
      ? countSetA(remaining)
      : countSetB(remaining));
  };

  const initialSetC = (value.match(/^(?:\xCF*[0-9]{2}\xCF*)+/)?.[0].length ?? 0) >= 2;
  const setA = value.match(/^[\x00-\x5F\xC8-\xCF]*/)?.[0].length ?? 0;
  const setB = value.match(/^[\x20-\x7F\xC8-\xCF]*/)?.[0].length ?? 0;
  const encodedSymbols = initialSetC
    ? 1 + countSetC(value)
    : 1 + (setA > setB ? countSetA(value) : countSetB(value));

  // Code 128 adds a checksum symbol and a 13-module stop pattern.
  return (encodedSymbols + 1) * 11 + 13;
}

const QR_ECC_CODEWORDS_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28]
];
const QR_ECC_BLOCK_COUNT = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
  [-1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8]
];

function getQRCodeModuleCount(element: QRCodeElement) {
  const value = element.content ?? '';
  const levelIndex = ({ L: 0, M: 1, Q: 2, H: 3 } as const)[element.errorCorrection || 'H'];
  const isNumeric = /^[0-9]+$/.test(value);
  const isAlphanumeric = /^[0-9A-Z $%*+./:-]+$/.test(value);
  const byteLength = new TextEncoder().encode(value).length;

  for (let version = 1; version <= 10; version++) {
    const countBits = version < 10
      ? (isNumeric ? 10 : isAlphanumeric ? 9 : 8)
      : (isNumeric ? 12 : isAlphanumeric ? 11 : 16);
    const dataBits = isNumeric
      ? Math.floor(value.length / 3) * 10 + [0, 4, 7][value.length % 3]
      : isAlphanumeric
        ? Math.floor(value.length / 2) * 11 + (value.length % 2) * 6
        : byteLength * 8;
    const characterCount = isNumeric || isAlphanumeric ? value.length : byteLength;
    if (characterCount >= 2 ** countBits) continue;
    const usedBits = 4 + countBits + dataBits;
    const rawModules = version === 1
      ? 16 * version * version + 128 * version + 64
      : 16 * version * version + 128 * version + 64
        - (25 * (Math.floor(version / 7) + 2) - 10) * (Math.floor(version / 7) + 2) + 55;
    const dataCodewords = Math.floor(rawModules / 8)
      - QR_ECC_CODEWORDS_PER_BLOCK[levelIndex][version] * QR_ECC_BLOCK_COUNT[levelIndex][version];
    if (usedBits <= dataCodewords * 8) return version * 4 + 17;
  }

  return Math.max(57, 17 + 4 * Math.ceil(byteLength / 20));
}

export function getThicknessPx(thickness: number, zoom: number, protocol: Protocol, printSettings: PrintSettings) {
  return Math.max(0.5, protocol === 'zpl' ? unitsToPx(thickness, zoom, protocol, printSettings) : baseDotsToPx(thickness, zoom));
}

export function getFontMetricsPx(font: { fontSizePx: number; fontWeight: number | string; fontStyle: string; fontFamily: string }) {
  const key = `${font.fontStyle}|${font.fontWeight}|${font.fontSizePx}|${font.fontFamily}`;
  const cached = textMetricsCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const fallback = { ascent: font.fontSizePx * 0.8, descent: font.fontSizePx * 0.2 };
    textMetricsCache.set(key, fallback);
    return fallback;
  }

  ctx.font = `${font.fontStyle} ${font.fontWeight} ${font.fontSizePx}px ${font.fontFamily}`;
  const metrics = ctx.measureText('Mg');
  const ascent = metrics.actualBoundingBoxAscent ?? font.fontSizePx * 0.8;
  const descent = metrics.actualBoundingBoxDescent ?? font.fontSizePx * 0.2;
  const result = { ascent, descent };
  textMetricsCache.set(key, result);
  return result;
}

export function getLineBoundingBoxPx(lineEl: LineElement, zoom: number, protocol: Protocol, printSettings: PrintSettings) {
  const dx = unitsToPx(lineEl.x2 - lineEl.x, zoom, protocol, printSettings);
  const dy = unitsToPx(lineEl.y2 - lineEl.y, zoom, protocol, printSettings);
  const thicknessPx = getThicknessPx(lineEl.thickness, zoom, protocol, printSettings);
  const minX = Math.min(0, dx);
  const minY = Math.min(0, dy);
  const maxX = Math.max(0, dx);
  const maxY = Math.max(0, dy);
  const width = (maxX - minX) + thicknessPx;
  const height = (maxY - minY) + thicknessPx;
  return { dx, dy, thicknessPx, minX, minY, width, height };
}

export function getElementVisualMetadata(
  element: LabelElement,
  zoom: number,
  supportedFonts: FontMetadata[],
  protocol: Protocol,
  printSettings: PrintSettings
) {
  const rotation = ((element.rotation || 0) % 4 + 4) % 4;
  const size = getElementSize(element, zoom, supportedFonts, protocol, printSettings);
  const rawWidth = size.width;
  const rawHeight = size.height;

  // Calculate bounding box for rotated element
  const rotationRad = (rotation * 90 * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rotationRad));
  const sin = Math.abs(Math.sin(rotationRad));
  const rotatedWidth = rawWidth * cos + rawHeight * sin;
  const rotatedHeight = rawWidth * sin + rawHeight * cos;

  // Calculate translation needed to keep content in a positive bounding box if rotated around top-left
  const translateX = (rotation === 1) ? rawHeight : (rotation === 2 ? rawWidth : (rotation === 3 ? 0 : 0));
  const translateY = (rotation === 1) ? 0 : (rotation === 2 ? rawHeight : (rotation === 3 ? rawWidth : 0));

  const baselineOffsetPx = (() => {
    if (element.type !== 'text') return 0;
    const textEl = element as TextElement;
    const font = getTextFontStyle(textEl, zoom, supportedFonts, protocol, printSettings);
    const { ascent } = getFontMetricsPx(font);
    const { scaleY } = getTextScales(textEl, protocol);
    return ascent * scaleY;
  })();

  return {
    rotation,
    rawWidth,
    rawHeight,
    rotatedWidth,
    rotatedHeight,
    translateX,
    translateY,
    baselineOffsetPx
  };
}

export function getBarcodeVisualMetadata(
  element: BarcodeElement,
  zoom: number,
  protocol: Protocol,
  printSettings: PrintSettings
) {
  const moduleScale = protocol === 'tpcl' ? TPCL_SYMBOL_MODULE_SCALE : 1;
  const targetModuleWidthPx = protocol === 'zpl' 
    ? unitsToPx(element.width, zoom, protocol, printSettings) 
    : baseDotsToPx(element.width, zoom) * moduleScale;
  const barHeightPx = Math.max(1, unitsToPx(element.height, zoom, protocol, printSettings));
  
  const modules = element.barcodeType === 'code128'
    ? protocol === 'zpl'
      ? (element.content?.length ?? 0) * 11 + 35
      : getCode128ModuleCount(element.content ?? '')
    : (element.content?.length ?? 0) * 11 + 35;
  const targetWidthPx = modules * targetModuleWidthPx;
  
  const baseModuleWidth = 2;
  const baseWidthPx = modules * baseModuleWidth;
  const scaleX = targetWidthPx / baseWidthPx;

  return {
    targetModuleWidthPx,
    barHeightPx,
    modules,
    targetWidthPx,
    baseModuleWidth,
    baseWidthPx,
    scaleX
  };
}

export function getQRCodeVisualMetadata(
  element: QRCodeElement,
  zoom: number,
  protocol: Protocol,
  printSettings: PrintSettings
) {
  const moduleScale = protocol === 'tpcl' ? TPCL_SYMBOL_MODULE_SCALE : 1;
  const moduleSizePx = protocol === 'zpl' 
    ? unitsToPx(element.size, zoom, protocol, printSettings) 
    : baseDotsToPx(element.size, zoom) * moduleScale;
  const sizePx = getQRCodeModuleCount(element) * moduleSizePx;
  
  return {
    moduleSizePx,
    sizePx
  };
}

export function getFontPresetKey(textEl: TextElement, supportedFonts: FontMetadata[]) {
  return textEl.fontCode || supportedFonts[0]?.key;
}

export function applyElementUpdates(element: LabelElement, updates: Partial<LabelElement>): LabelElement {
  const newEl = { ...element, ...updates } as LabelElement;
  
  if (element.type === 'line' && (updates.x !== undefined || updates.y !== undefined)) {
    const line = element as LineElement;
    const dx = updates.x !== undefined ? (updates.x - line.x) : 0;
    const dy = updates.y !== undefined ? (updates.y - line.y) : 0;
    (newEl as LineElement).x2 = line.x2 + dx;
    (newEl as LineElement).y2 = line.y2 + dy;
  }
  
  return newEl;
}

export function getElementSize(element: LabelElement, zoom: number, supportedFonts: FontMetadata[], protocol: Protocol, printSettings: PrintSettings) {
  const dotsPerMm = getDpi(printSettings) / 25.4;
  const baseDotsToPx = (baseDots: number) => (baseDots / DOTS_PER_MM) * zoom;
  const coordsToPx = (coords: number) => (coords / COORDS_PER_MM) * zoom;
  const zplDotsToPx = (dots: number) => (dots / dotsPerMm) * zoom;
  
  if (element.type === 'text') {
    const textEl = element as TextElement;
    const font = getTextFontStyle(textEl, zoom, supportedFonts, protocol, printSettings);
    const { scaleX, scaleY } = getTextScales(textEl, protocol);
    
    const lines = ((element.content && element.content.length > 0) ? element.content : '\u00A0').split('\n');
    let maxLineWidth = 0;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = `${font.fontStyle} ${font.fontWeight} ${font.fontSizePx}px ${font.fontFamily}`;
      for (const line of lines) {
        maxLineWidth = Math.max(maxLineWidth, ctx.measureText(line).width);
      }
    } else {
      maxLineWidth = Math.max(...lines.map((l) => l.length)) * (font.fontSizePx * 0.6);
    }

    const { ascent, descent } = getFontMetricsPx(font);
    const lineHeightPx = ascent + descent;
    return { width: maxLineWidth * scaleX, height: lines.length * lineHeightPx * scaleY };
  }
  if (element.type === 'barcode') {
    const { targetWidthPx, barHeightPx } = getBarcodeVisualMetadata(
      element as BarcodeElement,
      zoom,
      protocol,
      printSettings
    );
    return { width: targetWidthPx, height: barHeightPx };
  }
  if (element.type === 'qrcode') {
    const { sizePx } = getQRCodeVisualMetadata(element as QRCodeElement, zoom, protocol, printSettings);
    return { width: sizePx, height: sizePx };
  }
  if (element.type === 'line') {
    const { width, height } = getLineBoundingBoxPx(element as LineElement, zoom, protocol, printSettings);
    return { width, height };
  }
  if (element.type === 'rectangle') {
    if (protocol === 'zpl') {
      return {
        width: zplDotsToPx(element.width),
        height: zplDotsToPx(element.height)
      };
    }
    return { 
      width: coordsToPx(element.width), 
      height: coordsToPx(element.height) 
    };
  }
  return { width: 1, height: 1 };
}

export function exportLabel(label: LabelTemplate) {
  const driver = drivers[label.protocol];
  if (!driver) {
    throw new Error(`Driver for ${label.protocol} not found`);
  }

  const output = driver.generate(label);
  
  let bytes: Uint8Array;
  if (label.protocol === 'tpcl') {
    bytes = new Uint8Array(output.length);
    for (let i = 0; i < output.length; i++) {
      const charCode = output.charCodeAt(i);
      bytes[i] = charCode <= 255 ? charCode : 63;
    }
  } else {
    bytes = new TextEncoder().encode(output);
  }
  
  const blob = new Blob([bytes as any], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${label.name}${driver.supportedExtensions[0]}`;
  a.click();
  URL.revokeObjectURL(url);
}

export function saveTemplate(label: LabelTemplate) {
  const json = JSON.stringify(label, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${label.name}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
