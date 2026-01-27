import { useState, useRef, useEffect } from 'react'
import { Plus, Save, FileDown, Type, Barcode as BarcodeIcon, Square, Minus, Trash2, Move, Settings, ChevronDown, ChevronUp, QrCode, Upload } from 'lucide-react'
import Draggable from 'react-draggable'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import Barcode from 'react-barcode'
import { QRCodeSVG } from 'qrcode.react'
import { LabelElement, ElementType, TextElement, BarcodeElement, QRCodeElement, LineElement, RectangleElement, LabelTemplate, DOTS_PER_MM, COORDS_PER_MM, PrintSettings, Protocol, FontMetadata, DEFAULT_DPI } from './types'
import { drivers, getDriverForFile } from './drivers'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const FONT_FAMILY_CSS: Record<string, string> = {
  times: '"Times New Roman", Times, serif',
  helvetica: 'Helvetica, Arial, sans-serif',
  courier: '"Courier New", Courier, monospace',
  presentation: '"Arial Black", Arial, sans-serif',
  'letter-gothic': '"Courier New", Courier, monospace',
  'prestige-elite': '"Courier New", Courier, monospace',
  'ocr-a': '"OCR A Std", "OCR A", monospace',
  'ocr-b': '"OCR B Std", "OCR B", monospace'
}

const normalizeTextScale = (val: number) => (val >= 10 ? val / 10 : (val <= 0 ? 1 : val));

const MM_PER_PT = 25.4 / 72;
const TEXT_FONT_SIZE_SCALE = 1.4;
const textMetricsCache = new Map<string, { ascent: number; descent: number }>();
const COMMON_DPI_PRESETS = [203, 300, 600]
const normalizeDpiToPreset = (dpi: number) => {
  const value = typeof dpi === 'number' && Number.isFinite(dpi) && dpi > 0 ? Math.round(dpi) : DEFAULT_DPI
  if (COMMON_DPI_PRESETS.includes(value)) return value
  let best = COMMON_DPI_PRESETS[0] ?? DEFAULT_DPI
  let bestDiff = Number.POSITIVE_INFINITY
  for (const preset of COMMON_DPI_PRESETS) {
    const diff = Math.abs(preset - value)
    if (diff < bestDiff) {
      bestDiff = diff
      best = preset
    }
  }
  return best
}
const getDpi = (printSettings: PrintSettings | undefined) => {
  const dpi = printSettings?.dpi
  if (typeof dpi !== 'number' || !Number.isFinite(dpi) || dpi <= 0) return DEFAULT_DPI
  return dpi
}

function formatMm(value: number) {
  if (!Number.isFinite(value)) return String(value)
  const rounded = Math.round(value * 10) / 10
  return rounded % 1 === 0 ? String(Math.round(rounded)) : rounded.toFixed(1)
}

function roundMm(value: number) {
  if (!Number.isFinite(value)) return value
  return Math.round(value * 10) / 10
}

type LabelSizePreset = {
  id: string
  widthMm: number
  heightMm: number
}

const DEFAULT_LABEL_SIZE_PRESET_ID = '102x76'
const LABEL_SIZE_PRESETS: LabelSizePreset[] = [
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

function getFileBaseName(filename: string) {
  const trimmed = (filename || '').trim()
  if (trimmed.length === 0) return 'Untitled'
  const lastDot = trimmed.lastIndexOf('.')
  if (lastDot <= 0) return trimmed
  return trimmed.slice(0, lastDot)
}

function formatInches(valueMm: number) {
  if (!Number.isFinite(valueMm)) return String(valueMm)
  const inches = valueMm / 25.4
  const rounded = Math.round(inches * 10) / 10
  return rounded % 1 === 0 ? String(Math.round(rounded)) : rounded.toFixed(1)
}

function formatLabelSizePreset(preset: LabelSizePreset) {
  return `${formatMm(preset.widthMm)} × ${formatMm(preset.heightMm)} mm (${formatInches(preset.widthMm)}" × ${formatInches(preset.heightMm)}")`
}

function resolveFontMeta(textEl: TextElement, supportedFonts: FontMetadata[]) {
  return supportedFonts.find((p) => p.key === textEl.fontCode) ?? supportedFonts[0];
}

function getTextScales(textEl: TextElement, protocol: Protocol) {
  if (protocol === 'zpl') {
    const widthDots = typeof textEl.width === 'number' && Number.isFinite(textEl.width) ? textEl.width : 0;
    const heightDots = typeof textEl.height === 'number' && Number.isFinite(textEl.height) ? textEl.height : 0;
    const scaleX = widthDots > 0 && heightDots > 0 ? (widthDots / heightDots) : 1;
    return { scaleX, scaleY: 1 };
  }
  const scaleX = normalizeTextScale(textEl.width || 10);
  const scaleY = normalizeTextScale(textEl.height || 10);
  return { scaleX, scaleY };
}

function getTextFontStyle(
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
    if (protocol !== 'zpl') return (fontMeta?.fontSizePt ?? 10) * MM_PER_PT * zoom * TEXT_FONT_SIZE_SCALE;
    const targetDotsPerMm = getDpi(printSettings) / 25.4;
    const heightDots =
      typeof textEl.height === 'number' && Number.isFinite(textEl.height) && textEl.height > 0
        ? textEl.height
        : Math.max(1, Math.round(((fontMeta?.fontSizePt ?? 10) * MM_PER_PT) * TEXT_FONT_SIZE_SCALE * targetDotsPerMm));
    return (heightDots / targetDotsPerMm) * zoom;
  })();
  return { fontSizePx, fontWeight, fontStyle, fontFamily };
}

function getFontMetricsPx(font: { fontSizePx: number; fontWeight: number | string; fontStyle: string; fontFamily: string }) {
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

function getLineBoundingBoxPx(lineEl: LineElement, zoom: number, protocol: Protocol, printSettings: PrintSettings) {
  const dotsPerMm = getDpi(printSettings) / 25.4
  const dx = protocol === 'zpl'
    ? ((lineEl.x2 - lineEl.x) / dotsPerMm) * zoom
    : ((lineEl.x2 - lineEl.x) / COORDS_PER_MM) * zoom
  const dy = protocol === 'zpl'
    ? ((lineEl.y2 - lineEl.y) / dotsPerMm) * zoom
    : ((lineEl.y2 - lineEl.y) / COORDS_PER_MM) * zoom
  const thicknessPx = Math.max(
    0.5,
    protocol === 'zpl'
      ? (Math.max(1, lineEl.thickness) / dotsPerMm) * zoom
      : (lineEl.thickness / DOTS_PER_MM) * zoom
  )
  const minX = Math.min(0, dx);
  const minY = Math.min(0, dy);
  const maxX = Math.max(0, dx);
  const maxY = Math.max(0, dy);
  const width = (maxX - minX) + thicknessPx;
  const height = (maxY - minY) + thicknessPx;
  return { dx, dy, thicknessPx, minX, minY, width, height };
}

function getElementSize(element: LabelElement, zoom: number, supportedFonts: FontMetadata[], protocol: Protocol, printSettings: PrintSettings) {
  const dotsPerMm = getDpi(printSettings) / 25.4
  const baseDotsToPx = (baseDots: number) => (baseDots / DOTS_PER_MM) * zoom
  const coordsToPx = (coords: number) => (coords / COORDS_PER_MM) * zoom
  const zplDotsToPx = (dots: number) => (dots / dotsPerMm) * zoom
  
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
    const targetModuleWidthPx = protocol === 'zpl' ? zplDotsToPx(element.width) : baseDotsToPx(element.width)
    const barHeightPx = Math.max(1, protocol === 'zpl' ? zplDotsToPx(element.height) : coordsToPx(element.height))
    const modules = (element.content?.length ?? 0) * 11 + 35;
    return { width: modules * targetModuleWidthPx, height: barHeightPx };
  }
  if (element.type === 'qrcode') {
    const qrEl = element as QRCodeElement;
    const moduleSizePx = protocol === 'zpl' ? zplDotsToPx(qrEl.size) : baseDotsToPx(qrEl.size)
    const modules = 21;
    const sizePx = modules * moduleSizePx;
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
      }
    }
    return { 
      width: coordsToPx(element.width), 
      height: coordsToPx(element.height) 
    };
  }
  return { width: 1, height: 1 };
}

function App() {
  const [elements, setElements] = useState<LabelElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [labelSize, setLabelSize] = useState({ width: 102, height: 76 });
  const [labelName, setLabelName] = useState('Untitled');
  const [protocol, setProtocol] = useState<Protocol>('tpcl');
  const [zoom, setZoom] = useState(4); // 1mm = 4px
  const [isAutoZoom, setIsAutoZoom] = useState(false);
  const [printSettings, setPrintSettings] = useState<PrintSettings>({
    quantity: 1,
    speed: 3,
    darkness: 10,
    dpi: DEFAULT_DPI
  });
  const [isNewConfirmOpen, setIsNewConfirmOpen] = useState(false);
  const [newLabelPresetId, setNewLabelPresetId] = useState(DEFAULT_LABEL_SIZE_PRESET_ID);
  const [newProtocol, setNewProtocol] = useState<Protocol>('tpcl');
  const [newDpi, setNewDpi] = useState<number>(DEFAULT_DPI);
  const editorViewportRef = useRef<HTMLDivElement | null>(null);
  
  const selectedElement = elements.find(el => el.id === selectedId);
  const currentDriver = drivers[protocol];

  const getFontPresetKey = (textEl: TextElement) => {
    return textEl.fontCode || currentDriver.supportedFonts[0]?.key;
  };

  const applyFontPreset = (id: string, presetKey: string) => {
    updateElement(id, {
      fontCode: presetKey,
    } as any);
  };

  const addElement = (type: ElementType) => {
    const id = Math.random().toString(36).substr(2, 9);
    let newElement: LabelElement;

    const base = {
      id,
      type,
      x: 100, // 10mm
      y: 100, // 10mm
      rotation: 0,
    };

    switch (type) {
      case 'text':
        {
          const defaultFont = currentDriver.supportedFonts[0];
          const defaultTextSize = (() => {
            if (protocol !== 'zpl') return { width: 10, height: 10 };
            const targetDotsPerMm = getDpi(printSettings) / 25.4;
            const heightDots = Math.max(
              1,
              Math.round((((defaultFont?.fontSizePt ?? 10) * MM_PER_PT) * TEXT_FONT_SIZE_SCALE) * targetDotsPerMm)
            );
            return { width: heightDots, height: heightDots };
          })();
          newElement = { 
            ...base, 
            type: 'text', 
            content: 'New Text', 
            fontCode: defaultFont?.key ?? '0',
            width: defaultTextSize.width,
            height: defaultTextSize.height
          } as TextElement;
        }
        break;
      case 'barcode':
        {
          const defaultBarcode = currentDriver.supportedBarcodes[0];
          newElement = { 
            ...base, 
            type: 'barcode', 
            content: '12345678', 
            barcodeType: defaultBarcode?.type ?? 'code128', 
            height: 100, 
            width: 3 
          } as BarcodeElement;
        }
        break;
      case 'qrcode':
        newElement = { ...base, type: 'qrcode', content: '12345678', size: 5 } as QRCodeElement;
        break;
      case 'line':
        newElement = { ...base, type: 'line', x2: 200, y2: 100, thickness: 3 } as LineElement;
        break;
      case 'rectangle':
        newElement = { ...base, type: 'rectangle', width: 200, height: 100, thickness: 3 } as RectangleElement;
        break;
      default:
        return;
    }

    setElements([...elements, newElement]);
    setSelectedId(id);
  };

  const updateElement = (id: string, updates: Partial<LabelElement>) => {
    setElements(elements.map(el => {
      if (el.id !== id) return el;
      
      const newEl = { ...el, ...updates } as LabelElement;
      
      // If we are moving a line (changing x or y), adjust x2/y2 to maintain length/angle
      if (el.type === 'line' && (updates.x !== undefined || updates.y !== undefined)) {
        const line = el as LineElement;
        const dx = updates.x !== undefined ? updates.x - line.x : 0;
        const dy = updates.y !== undefined ? updates.y - line.y : 0;
        (newEl as LineElement).x2 = line.x2 + dx;
        (newEl as LineElement).y2 = line.y2 + dy;
      }
      
      return newEl;
    }));
  };

  const deleteElement = (id: string) => {
    setElements(elements.filter(el => el.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleDrag = (id: string, data: { x: number, y: number }) => {
    const unitsPerMm = protocol === 'zpl' ? (getDpi(printSettings) / 25.4) : COORDS_PER_MM
    const x = Math.round((data.x / zoom) * unitsPerMm)
    const y = Math.round((data.y / zoom) * unitsPerMm)
    updateElement(id, { x, y });
  };

  useEffect(() => {
    if (!isAutoZoom) return;
    const el = editorViewportRef.current;
    if (!el) return;

    const compute = () => {
      const paddingPx = 32;
      const availableWidthPx = Math.max(0, el.clientWidth - paddingPx);
      const availableHeightPx = Math.max(0, el.clientHeight - paddingPx);
      if (availableWidthPx <= 0 || availableHeightPx <= 0) return;

      const next = Math.min(
        availableWidthPx / labelSize.width,
        availableHeightPx / labelSize.height
      );
      if (!Number.isFinite(next) || next <= 0) return;

      const clamped = Math.min(10, Math.max(0.2, next));
      const rounded = Math.round(clamped * 20) / 20;
      setZoom((prev) => (Math.abs(prev - rounded) < 0.001 ? prev : rounded));
    };

    compute();
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(compute);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isAutoZoom, labelSize.width, labelSize.height]);

  const exportLabel = () => {
    const template: LabelTemplate = {
      name: labelName,
      width: labelSize.width,
      height: labelSize.height,
      elements,
      printSettings,
      protocol
    };
    
    const driver = drivers[protocol];
    if (!driver) {
      alert(`Driver for ${protocol} not found`);
      return;
    }

    const output = driver.generate(template);
    
    // Convert string to bytes. TPCL might need Windows-1252, ZPL might need UTF-8.
    // For now, we'll use a basic mapping or TextEncoder.
    let bytes: Uint8Array;
    if (protocol === 'tpcl') {
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
    a.download = `${labelName}${driver.supportedExtensions[0]}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveTemplate = () => {
    const template: LabelTemplate = {
      name: labelName,
      width: labelSize.width,
      height: labelSize.height,
      elements,
      printSettings,
      protocol
    };
    const json = JSON.stringify(template, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${labelName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadTemplate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
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
          const driver = getDriverForFile(file.name);
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
          const rawPs = (template as any).printSettings as any
          const migratedPs: PrintSettings = (() => {
            const dpiFromLegacy =
              template.protocol === 'zpl' &&
              rawPs &&
              typeof rawPs.zplDotsPerMm === 'number' &&
              Number.isFinite(rawPs.zplDotsPerMm) &&
              rawPs.zplDotsPerMm > 0
                ? Math.round(rawPs.zplDotsPerMm * 25.4)
                : undefined
            const dpi =
              typeof rawPs?.dpi === 'number' && Number.isFinite(rawPs.dpi) && rawPs.dpi > 0 ? rawPs.dpi : (dpiFromLegacy ?? DEFAULT_DPI)
            const quantity =
              typeof rawPs?.quantity === 'number' && Number.isFinite(rawPs.quantity) && rawPs.quantity > 0 ? rawPs.quantity : 1
            const speed = typeof rawPs?.speed === 'number' && Number.isFinite(rawPs.speed) ? rawPs.speed : 3
            const darkness = typeof rawPs?.darkness === 'number' && Number.isFinite(rawPs.darkness) ? rawPs.darkness : 10
            return { quantity, speed, darkness, dpi: normalizeDpiToPreset(dpi) }
          })()
          setElements(template.elements);
          setLabelSize({ width: roundMm(template.width), height: roundMm(template.height) });
          setLabelName(getFileBaseName(file.name));
          setPrintSettings(migratedPs);
          if (template.protocol) {
            setProtocol(template.protocol);
          } else {
            const lower = file.name.toLowerCase()
            if (lower.endsWith('.ezpl')) setProtocol('zpl')
            if (lower.endsWith('.etec')) setProtocol('tpcl')
          }
          setSelectedId(null);
        } else {
          alert('Could not parse file');
        }
      } catch (err) {
        console.error('Failed to parse template:', err);
        alert('Invalid template file');
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input
    e.target.value = '';
  };

  const resetToNew = (size?: { width: number; height: number }, newProtocol?: Protocol, dpi?: number) => {
    const nextSize = size ?? { width: 102, height: 76 }
    setElements([]);
    setSelectedId(null);
    setLabelName('Untitled');
    setLabelSize(nextSize);
    if (newProtocol) setProtocol(newProtocol);
    const nextDpi = typeof dpi === 'number' && Number.isFinite(dpi) && dpi > 0 ? dpi : DEFAULT_DPI
    setPrintSettings({ quantity: 1, speed: 3, darkness: 10, dpi: nextDpi });
  };

  const setDpiPreservingZplTextSizes = (nextDpiRaw: number) => {
    const nextDpi = normalizeDpiToPreset(nextDpiRaw)
    const prevDpi = getDpi(printSettings)

    setPrintSettings({ ...printSettings, dpi: nextDpi })

    if (protocol !== 'zpl') return
    if (!Number.isFinite(prevDpi) || prevDpi <= 0) return
    if (!Number.isFinite(nextDpi) || nextDpi <= 0) return
    if (Math.abs(nextDpi - prevDpi) < 0.001) return

    const ratio = nextDpi / prevDpi
    setElements((prev) =>
      prev.map((el) => {
        if (el.type !== 'text') return el
        const textEl = el as TextElement
        const w = typeof textEl.width === 'number' && Number.isFinite(textEl.width) ? textEl.width : 0
        const h = typeof textEl.height === 'number' && Number.isFinite(textEl.height) ? textEl.height : 0
        return {
          ...textEl,
          width: Math.max(1, Math.round(w * ratio)),
          height: Math.max(1, Math.round(h * ratio))
        }
      })
    )
  }

  return (
    <div className="flex h-screen w-full flex-col bg-slate-50 text-slate-900 overflow-hidden font-sans">
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-white px-6 py-3 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg shadow-blue-200 shadow-lg">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M7 7h10M7 12h10M7 17h10" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-none">Etikit</h1>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Label Designer</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setNewLabelPresetId(DEFAULT_LABEL_SIZE_PRESET_ID);
              setNewProtocol(protocol);
              setNewDpi(normalizeDpiToPreset(getDpi(printSettings)));
              setIsNewConfirmOpen(true);
            }}
            className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <Plus size={16} />
            New
          </button>
          <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer">
            <Upload size={16} />
            Load
            <input type="file" accept=".json,.etec,.ezpl" className="hidden" onChange={loadTemplate} />
          </label>
          <button onClick={saveTemplate} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 transition-colors">
            <Save size={16} />
            Save
          </button>
          <div className="flex items-center gap-2 ml-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-100 border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Protocol</span>
              <span className="text-xs font-bold text-slate-700 uppercase">{protocol}</span>
            </div>
            <button onClick={exportLabel} className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm transition-all active:scale-95">
              <FileDown size={16} />
              Export
            </button>
          </div>
        </div>
      </header>

      {isNewConfirmOpen && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 p-4"
          onMouseDown={() => setIsNewConfirmOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-100">
              <div className="text-sm font-bold text-slate-900">Start a new label?</div>
              <div className="mt-1 text-xs font-medium text-slate-500">
                This will clear the current design.
              </div>
            </div>
            <div className="p-5 border-b border-slate-100 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Protocol</label>
                <select
                  className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  value={newProtocol}
                  onChange={(e) => setNewProtocol(e.target.value as Protocol)}
                >
                  <option value="tpcl">TPCL (Toshiba)</option>
                  <option value="zpl">ZPL (Zebra)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">DPI</label>
                <select
                  className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  value={String(normalizeDpiToPreset(newDpi))}
                  onChange={(e) => setNewDpi(normalizeDpiToPreset(parseInt(e.target.value, 10)))}
                >
                  {COMMON_DPI_PRESETS.map((dpi) => (
                    <option key={dpi} value={dpi}>{dpi}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Label Size</label>
                <select
                  className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  value={newLabelPresetId}
                  onChange={(e) => setNewLabelPresetId(e.target.value)}
                >
                  {LABEL_SIZE_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {formatLabelSizePreset(preset)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-5 flex justify-end gap-2">
              <button
                onClick={() => setIsNewConfirmOpen(false)}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const preset =
                    LABEL_SIZE_PRESETS.find((p) => p.id === newLabelPresetId) ??
                    LABEL_SIZE_PRESETS.find((p) => p.id === DEFAULT_LABEL_SIZE_PRESET_ID) ??
                    LABEL_SIZE_PRESETS[0];
                  resetToNew({ width: preset.widthMm, height: preset.heightMm }, newProtocol, newDpi);
                  setIsNewConfirmOpen(false);
                }}
                className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm transition-all active:scale-95"
              >
                New
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Toolbar */}
        <aside className="w-16 border-r bg-white flex flex-col items-center py-6 gap-4 shadow-sm z-10 shrink-0">
          <ToolButton title="Text" icon={<Type size={22} />} onClick={() => addElement('text')} />
          <ToolButton title="Barcode" icon={<BarcodeIcon size={22} />} onClick={() => addElement('barcode')} />
          <ToolButton title="QR Code" icon={<QrCode size={22} />} onClick={() => addElement('qrcode')} />
          <ToolButton title="Line" icon={<Minus size={22} className="rotate-45" />} onClick={() => addElement('line')} />
          <ToolButton title="Rectangle" icon={<Square size={22} />} onClick={() => addElement('rectangle')} />
        </aside>

        {/* Main Editor Area */}
        <main className="flex-1 overflow-auto bg-slate-100 p-8 flex flex-col items-center">
          <div className="mb-4 flex items-center gap-4 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-200">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Zoom</span>
              <input 
                type="range" min="0.2" max="10" step="0.05" 
                value={zoom}
                onChange={(e) => {
                  setIsAutoZoom(false);
                  setZoom(parseFloat(e.target.value));
                }}
                disabled={isAutoZoom}
                className={cn("w-24 accent-blue-600", isAutoZoom && "opacity-50")}
              />
              <span className="text-xs font-mono w-8">{Math.round(zoom * 25)}%</span>
              <button
                type="button"
                onClick={() => setIsAutoZoom((v) => !v)}
                className={cn(
                  "ml-1 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors",
                  isAutoZoom
                    ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                )}
              >
                Auto
              </button>
            </div>
            <div className="w-px h-4 bg-slate-200" />
            <div className="text-[10px] font-bold text-slate-400 uppercase">
              {formatMm(labelSize.width)} x {formatMm(labelSize.height)} mm
            </div>
          </div>

          <div ref={editorViewportRef} className="w-full flex-1 min-h-0 flex items-start justify-center">
            <div 
              className="bg-white shadow-2xl border border-slate-300 relative transition-all duration-300 shrink-0" 
              style={{ 
                width: `${labelSize.width * zoom}px`, 
                height: `${labelSize.height * zoom}px`,
              }}
              onClick={() => setSelectedId(null)}
            >
              {/* Grid Pattern */}
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                style={{ 
                  backgroundImage: `radial-gradient(#000 1px, transparent 1px)`,
                  backgroundSize: `${zoom}px ${zoom}px`
                }} 
              />

              {elements.map((el) => (
                <DraggableElement 
                  key={el.id} 
                  element={el} 
                  zoom={zoom} 
                  protocol={protocol}
                  printSettings={printSettings}
                  supportedFonts={currentDriver.supportedFonts}
                  isSelected={selectedId === el.id}
                  onSelect={() => setSelectedId(el.id)}
                  onDrag={(data) => handleDrag(el.id, data)}
                />
              ))}
            </div>
          </div>
        </main>

        {/* Properties Sidebar */}
        <aside className="w-80 border-l bg-white flex flex-col shadow-sm shrink-0">
          <div className="p-4 border-b flex items-center gap-2 bg-slate-50/50">
            <Settings size={14} className="text-slate-400" />
            <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Properties</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5">
            {selectedElement ? (
              <div className="space-y-6">
                <header className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-600 p-1.5 rounded text-xs">
                      {selectedElement.type === 'text' && <Type size={14} />}
                      {selectedElement.type === 'barcode' && <BarcodeIcon size={14} />}
                      {selectedElement.type === 'qrcode' && <QrCode size={14} />}
                      {selectedElement.type === 'line' && <Minus size={14} />}
                      {selectedElement.type === 'rectangle' && <Square size={14} />}
                    </span>
                    <span className="text-sm font-bold capitalize">{selectedElement.type}</span>
                  </div>
                  <button 
                    onClick={() => deleteElement(selectedElement.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </header>

                <PropertyGrid>
                  <PropertyInput 
                    label="X (mm)" 
                    value={(selectedElement.x / COORDS_PER_MM).toFixed(1)} 
                    onChange={(val) => updateElement(selectedElement.id, { x: parseFloat(val) * COORDS_PER_MM })}
                    type="number"
                    step={0.1}
                  />
                  <PropertyInput 
                    label="Y (mm)" 
                    value={(selectedElement.y / COORDS_PER_MM).toFixed(1)} 
                    onChange={(val) => updateElement(selectedElement.id, { y: parseFloat(val) * COORDS_PER_MM })}
                    type="number"
                    step={0.1}
                  />
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Rotation</label>
                    <select 
                      className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                      value={selectedElement.rotation}
                      onChange={(e) => updateElement(selectedElement.id, { rotation: parseInt(e.target.value) })}
                    >
                      <option value={0}>0°</option>
                      <option value={1}>90°</option>
                      <option value={2}>180°</option>
                      <option value={3}>270°</option>
                    </select>
                  </div>
                </PropertyGrid>

                {selectedElement.type === 'text' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Content</label>
                      <textarea 
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-h-[80px]"
                        value={selectedElement.content}
                        onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Font</label>
                      <select 
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                        value={getFontPresetKey(selectedElement as TextElement)}
                        onChange={(e) => applyFontPreset(selectedElement.id, e.target.value)}
                      >
                        {currentDriver.supportedFonts.map(p => (
                          <option key={p.key} value={p.key}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                    <PropertyGrid>
                      <PropertyInput 
                        label={protocol === 'zpl' ? 'Font Width (dots)' : 'Width Scale'} 
                        value={selectedElement.width} 
                        onChange={(val) => updateElement(selectedElement.id, { width: parseFloat(val) })}
                        type="number"
                        step={protocol === 'zpl' ? 1 : 0.1}
                      />
                      <PropertyInput 
                        label={protocol === 'zpl' ? 'Font Height (dots)' : 'Height Scale'} 
                        value={selectedElement.height} 
                        onChange={(val) => updateElement(selectedElement.id, { height: parseFloat(val) })}
                        type="number"
                        step={protocol === 'zpl' ? 1 : 0.1}
                      />
                    </PropertyGrid>
                  </>
                )}

                {selectedElement.type === 'barcode' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Data</label>
                      <input 
                        type="text"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        value={selectedElement.content}
                        onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Type</label>
                      <select 
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                        value={selectedElement.barcodeType}
                        onChange={(e) => updateElement(selectedElement.id, { barcodeType: e.target.value })}
                      >
                        {currentDriver.supportedBarcodes.map(b => (
                          <option key={b.type} value={b.type}>{b.label}</option>
                        ))}
                      </select>
                    </div>
                    <PropertyGrid>
                      <PropertyInput 
                        label="Height" 
                        value={selectedElement.height} 
                        onChange={(val) => updateElement(selectedElement.id, { height: parseInt(val) })}
                        type="number"
                        step={1}
                      />
                      <PropertyInput 
                        label="Narrow Bar" 
                        value={selectedElement.width} 
                        onChange={(val) => updateElement(selectedElement.id, { width: parseInt(val) })}
                        type="number"
                        step={1}
                      />
                    </PropertyGrid>
                  </>
                )}

                {selectedElement.type === 'qrcode' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Data</label>
                      <input 
                        type="text"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        value={selectedElement.content}
                        onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                      />
                    </div>
                    <PropertyInput 
                      label="Size" 
                      value={selectedElement.size} 
                      onChange={(val) => updateElement(selectedElement.id, { size: parseInt(val) })}
                      type="number"
                      step={1}
                    />
                  </div>
                )}

                {selectedElement.type === 'line' && (
                  <div className="space-y-4">
                    <PropertyGrid>
                      <PropertyInput 
                        label="End X (mm)" 
                        value={(selectedElement.x2 / COORDS_PER_MM).toFixed(1)} 
                        onChange={(val) => updateElement(selectedElement.id, { x2: parseFloat(val) * COORDS_PER_MM })}
                        type="number"
                        step={0.1}
                      />
                      <PropertyInput 
                        label="End Y (mm)" 
                        value={(selectedElement.y2 / COORDS_PER_MM).toFixed(1)} 
                        onChange={(val) => updateElement(selectedElement.id, { y2: parseFloat(val) * COORDS_PER_MM })}
                        type="number"
                        step={0.1}
                      />
                    </PropertyGrid>
                    <PropertyInput 
                      label="Thickness" 
                      value={selectedElement.thickness} 
                      onChange={(val) => updateElement(selectedElement.id, { thickness: parseInt(val) })}
                      type="number"
                      step={1}
                    />
                  </div>
                )}

                {selectedElement.type === 'rectangle' && (
                  <PropertyGrid>
                    <PropertyInput 
                      label="Width (mm)" 
                      value={(selectedElement.width / COORDS_PER_MM).toFixed(1)} 
                      onChange={(val) => updateElement(selectedElement.id, { width: parseFloat(val) * COORDS_PER_MM })}
                      type="number"
                      step={0.1}
                    />
                    <PropertyInput 
                      label="Height (mm)" 
                      value={(selectedElement.height / COORDS_PER_MM).toFixed(1)} 
                      onChange={(val) => updateElement(selectedElement.id, { height: parseFloat(val) * COORDS_PER_MM })}
                      type="number"
                      step={0.1}
                    />
                  </PropertyGrid>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center opacity-30">
                <div className="bg-slate-100 p-6 rounded-full mb-4">
                  <Move size={32} className="text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-500">Select an element<br/>to edit properties</p>
              </div>
            )}
          </div>

          {/* Label Settings (Bottom of sidebar) */}
          <div className="mt-auto border-t p-5 bg-slate-50/50 max-h-[50%] overflow-y-auto">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Label Settings</h3>
            <div className="mb-4">
              <PropertyInput 
                label="Name" 
                value={labelName} 
                onChange={(val) => setLabelName(val)}
              />
            </div>
            <PropertyGrid>
              <PropertyInput 
                label="Width (mm)" 
                value={formatMm(labelSize.width)} 
                onChange={(val) => setLabelSize({ ...labelSize, width: parseFloat(val) })}
                type="number"
                step={0.1}
              />
              <PropertyInput 
                label="Height (mm)" 
                value={formatMm(labelSize.height)} 
                onChange={(val) => setLabelSize({ ...labelSize, height: parseFloat(val) })}
                type="number"
                step={0.1}
              />
            </PropertyGrid>

            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-6 mb-4">Print Settings</h3>
            <div className="space-y-4">
              <PropertyInput 
                label="Quantity" 
                value={printSettings.quantity} 
                onChange={(val) => setPrintSettings({ ...printSettings, quantity: parseInt(val) || 1 })}
                type="number"
                step={1}
              />
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">DPI</label>
                <select
                  className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  value={String(normalizeDpiToPreset(printSettings.dpi ?? DEFAULT_DPI))}
                  onChange={(e) => setDpiPreservingZplTextSizes(parseInt(e.target.value, 10))}
                >
                  {COMMON_DPI_PRESETS.map((dpi) => (
                    <option key={dpi} value={dpi}>{dpi}</option>
                  ))}
                </select>
              </div>
              <PropertyGrid>
                <PropertyInput 
                  label="Speed" 
                  value={printSettings.speed ?? 3} 
                  onChange={(val) => setPrintSettings({ ...printSettings, speed: parseInt(val) || 3 })}
                  type="number"
                  step={1}
                />
                <PropertyInput 
                  label="Darkness" 
                  value={printSettings.darkness ?? 10} 
                  onChange={(val) => setPrintSettings({ ...printSettings, darkness: parseInt(val) || 10 })}
                  type="number"
                  step={1}
                />
              </PropertyGrid>
            </div>
          </div>
        </aside>
      </div>
      
      {/* Footer */}
      <footer className="h-8 border-t bg-white px-6 flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em]">
        <div className="flex gap-6">
          <span className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Ready
          </span>
          <span>Elements: {elements.length}</span>
        </div>
        <div>
          <span>Etikit v1.0.0</span>
        </div>
      </footer>
    </div>
  )
}

function ToolButton({ title, icon, onClick }: { title: string, icon: React.ReactNode, onClick: () => void }) {
  return (
    <button 
      title={title} 
      onClick={onClick}
      className="p-3 rounded-xl text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-all active:scale-90 border border-transparent hover:border-blue-100"
    >
      {icon}
    </button>
  )
}

function PropertyGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-4">{children}</div>
}

function PropertyInput({ 
  label, 
  value, 
  onChange,
  type = 'text',
  step = 1,
  list
}: { 
  label: string, 
  value: string | number, 
  onChange: (val: string) => void,
  type?: 'text' | 'number',
  step?: number,
  list?: string
}) {
  const [localValue, setLocalValue] = useState(value.toString());
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(value.toString());
    }
  }, [value, isFocused]);

  const handleIncrement = () => {
    const current = parseFloat(localValue) || 0;
    const next = (current + step).toFixed(step < 1 ? 1 : 0);
    onChange(next);
    setLocalValue(next);
  };

  const handleDecrement = () => {
    const current = parseFloat(localValue) || 0;
    const next = (current - step).toFixed(step < 1 ? 1 : 0);
    onChange(next);
    setLocalValue(next);
  };

  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-slate-400 uppercase">{label}</label>
      <div className="relative group">
        <input 
          type="text" 
          className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all pr-6" 
          value={localValue} 
          list={list}
          onChange={(e) => {
            setLocalValue(e.target.value);
            onChange(e.target.value);
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
            if (type === 'number') {
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                handleIncrement();
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                handleDecrement();
              }
            }
          }}
        />
        {type === 'number' && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={handleIncrement} className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600">
              <ChevronUp size={10} />
            </button>
            <button onClick={handleDecrement} className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600">
              <ChevronDown size={10} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function DraggableElement({ element, zoom, protocol, printSettings, supportedFonts, isSelected, onSelect, onDrag }: { 
  element: LabelElement, 
  zoom: number,
  protocol: Protocol,
  printSettings: PrintSettings,
  supportedFonts: FontMetadata[],
  isSelected: boolean,
  onSelect: () => void, 
  onDrag: (data: { x: number, y: number }) => void,
}) {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  
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

  const dotsPerMm = getDpi(printSettings) / 25.4
  const x = protocol === 'zpl' ? (element.x / dotsPerMm) * zoom : (element.x / COORDS_PER_MM) * zoom
  const y = protocol === 'zpl' ? (element.y / dotsPerMm) * zoom : (element.y / COORDS_PER_MM) * zoom

  const baselineOffsetPx = (() => {
    if (element.type !== 'text') return 0;
    const textEl = element as TextElement;
    const font = getTextFontStyle(textEl, zoom, supportedFonts, protocol, printSettings);
    const { ascent } = getFontMetricsPx(font);
    const { scaleY } = getTextScales(textEl, protocol);
    return ascent * scaleY;
  })();

  // The Draggable position is the top-left of the bounding box.
  // We subtract translateX/translateY from the pivot (x, y) to get the bounding box top-left.
  const visualX = x - translateX;
  const visualY = (y - baselineOffsetPx) - translateY;

  return (
    <Draggable
      nodeRef={nodeRef}
      position={{ x: visualX, y: visualY }}
      onStop={(_, data) => {
        // When stopping, we add back the translation to get the actual pivot coordinate
        const realX = data.x + translateX;
        const realY = data.y + translateY + baselineOffsetPx;
        onDrag({ x: realX, y: realY });
      }}
      onStart={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      grid={[1, 1]}
    >
      <div 
        ref={nodeRef}
        className={cn(
          "absolute cursor-move select-none group",
          isSelected && "ring-2 ring-blue-500 ring-offset-2 z-50",
          !isSelected && "hover:ring-1 hover:ring-blue-300"
        )}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        <ElementRenderer element={element} zoom={zoom} protocol={protocol} printSettings={printSettings} supportedFonts={supportedFonts} />
        
        {/* Selection handles (visual only for now) */}
        {isSelected && (
          <>
            <div className="absolute -top-1 -left-1 w-2 h-2 bg-white border border-blue-500 rounded-sm" />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-white border border-blue-500 rounded-sm" />
            <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-white border border-blue-500 rounded-sm" />
            <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-white border border-blue-500 rounded-sm" />
          </>
        )}
      </div>
    </Draggable>
  );
}

function ElementRenderer({ element, zoom, protocol, printSettings, supportedFonts }: { element: LabelElement, zoom: number, protocol: Protocol, printSettings: PrintSettings, supportedFonts: FontMetadata[] }) {
  const rotation = ((element.rotation || 0) % 4 + 4) % 4;
  const rotationDegrees = rotation * 90;

  const dotsPerMm = getDpi(printSettings) / 25.4
  const baseDotsToPx = (baseDots: number) => (baseDots / DOTS_PER_MM) * zoom
  const coordsToPx = (coords: number) => (coords / COORDS_PER_MM) * zoom
  const zplDotsToPx = (dots: number) => (dots / dotsPerMm) * zoom

  const renderContent = () => {
    switch (element.type) {
      case 'text': {
        const textEl = element as TextElement;
        const font = getTextFontStyle(textEl, zoom, supportedFonts, protocol, printSettings);
        const { scaleX, scaleY } = getTextScales(textEl, protocol);

        return (
          <div 
            className="whitespace-pre"
            style={{ 
              fontSize: `${font.fontSizePx}px`,
              transform: `scale(${scaleX}, ${scaleY})`,
              transformOrigin: 'left top',
              fontFamily: font.fontFamily,
              fontWeight: font.fontWeight,
              fontStyle: font.fontStyle,
              lineHeight: 1,
              color: 'black',
            }}
          >
            {(textEl.content && textEl.content.length > 0) ? textEl.content : '\u00A0'}
          </div>
        );
      }
      case 'barcode': {
        const barEl = element as BarcodeElement;
        const targetModuleWidthPx = protocol === 'zpl' ? zplDotsToPx(barEl.width) : baseDotsToPx(barEl.width)
        const barHeightPx = Math.max(1, protocol === 'zpl' ? zplDotsToPx(barEl.height) : coordsToPx(barEl.height))
        
        // Standard barcode modules calculation for Code128/others
        const modules = (barEl.content?.length ?? 0) * 11 + 35;
        const targetWidthPx = modules * targetModuleWidthPx;
        
        const baseModuleWidth = 2;
        const baseWidthPx = modules * baseModuleWidth;
        const scaleX = targetWidthPx / baseWidthPx;

        return (
          <div 
            style={{ 
              display: 'inline-block',
              transform: `scaleX(${scaleX})`,
              transformOrigin: 'left top'
            }}
          >
            <Barcode 
              value={barEl.content || ' '} 
              width={baseModuleWidth}
              height={barHeightPx}
              displayValue={false}
              margin={0}
              background="transparent"
            />
          </div>
        );
      }
      case 'qrcode': {
        const qrEl = element as QRCodeElement;
        const moduleSizePx = protocol === 'zpl' ? zplDotsToPx(qrEl.size) : baseDotsToPx(qrEl.size)
        const sizePx = 21 * moduleSizePx;
        
        return (
          <div>
            <QRCodeSVG 
              value={qrEl.content || ''}
              size={sizePx}
              level={(qrEl.errorCorrection || 'H') as 'L' | 'M' | 'Q' | 'H'}
              marginSize={0}
            />
          </div>
        );
      }
      case 'line': {
        const lineEl = element as LineElement;
        const { dx, dy, thicknessPx, minX, minY, width, height } = getLineBoundingBoxPx(lineEl, zoom, protocol, printSettings);
        const x1 = (-minX) + thicknessPx / 2;
        const y1 = (-minY) + thicknessPx / 2;
        const x2 = (dx - minX) + thicknessPx / 2;
        const y2 = (dy - minY) + thicknessPx / 2;
        return (
          <svg
            width={width}
            height={height}
            style={{ display: 'block' }}
          >
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="black"
              strokeWidth={thicknessPx}
              strokeLinecap="square"
            />
          </svg>
        );
      }
      case 'rectangle': {
        const rectEl = element as RectangleElement;
        const w = protocol === 'zpl' ? zplDotsToPx(rectEl.width) : coordsToPx(rectEl.width)
        const h = protocol === 'zpl' ? zplDotsToPx(rectEl.height) : coordsToPx(rectEl.height)
        const t = Math.max(0.5, protocol === 'zpl' ? zplDotsToPx(rectEl.thickness) : baseDotsToPx(rectEl.thickness))
        return (
          <div 
            style={{ 
              width: `${w}px`, 
              height: `${h}px`,
              border: `${t}px solid black`,
              boxSizing: 'border-box'
            }} 
          />
        );
      }
      default:
        return null;
    }
  };

  const { width: rawWidth, height: rawHeight } = getElementSize(element, zoom, supportedFonts, protocol, printSettings);
  
  // Calculate bounding box for rotated element
  const rotationRad = (rotation * 90 * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rotationRad));
  const sin = Math.abs(Math.sin(rotationRad));
  const rotatedWidth = rawWidth * cos + rawHeight * sin;
  const rotatedHeight = rawWidth * sin + rawHeight * cos;

  // Calculate translation needed to keep content in a positive bounding box if rotated around top-left
  const translateX = (rotation === 1) ? rawHeight : (rotation === 2 ? rawWidth : (rotation === 3 ? 0 : 0));
  const translateY = (rotation === 1) ? 0 : (rotation === 2 ? rawHeight : (rotation === 3 ? rawWidth : 0));

  return (
    <div 
      style={{ 
        width: `${rotatedWidth}px`, 
        height: `${rotatedHeight}px`, 
        position: 'relative'
      }}
    >
      <div style={{ 
        transform: `translate(${translateX}px, ${translateY}px) rotate(${rotationDegrees}deg)`, 
        transformOrigin: '0 0',
        width: `${rawWidth}px`,
        height: `${rawHeight}px`,
        position: 'absolute',
        top: 0,
        left: 0
      }}>
        {renderContent()}
      </div>
    </div>
  );
}

export default App
