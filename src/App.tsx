import { useState, useRef, useEffect } from 'react'
import { Plus, Save, FileDown, Type, Barcode as BarcodeIcon, Square, Minus, Trash2, Move, Settings, ChevronDown, ChevronUp, QrCode, Upload } from 'lucide-react'
import Draggable from 'react-draggable'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import Barcode from 'react-barcode'
import { QRCodeSVG } from 'qrcode.react'
import { LabelElement, ElementType, TextElement, BarcodeElement, QRCodeElement, LineElement, RectangleElement, LabelTemplate, DOTS_PER_MM, COORDS_PER_MM, PrintSettings } from './types'
import { generateTPCL, parseTPCL } from './tpcl'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const FONT_MAP: Record<string, { family: string, pt: number, weight?: number | string, style?: string }> = {
  'A': { family: '"Times New Roman", Times, serif', pt: 8 },
  'B': { family: '"Times New Roman", Times, serif', pt: 10 },
  'C': { family: '"Times New Roman", Times, serif', pt: 10, weight: 'bold' },
  'D': { family: '"Times New Roman", Times, serif', pt: 12, weight: 'bold' },
  'E': { family: '"Times New Roman", Times, serif', pt: 14, weight: 'bold' },
  'F': { family: '"Times New Roman", Times, serif', pt: 12, style: 'italic' },
  'G': { family: 'Helvetica, Arial, sans-serif', pt: 6 },
  'H': { family: 'Helvetica, Arial, sans-serif', pt: 10 },
  'I': { family: 'Helvetica, Arial, sans-serif', pt: 12 },
  'J': { family: 'Helvetica, Arial, sans-serif', pt: 12, weight: 'bold' },
  'K': { family: 'Helvetica, Arial, sans-serif', pt: 14, weight: 'bold' },
  'L': { family: 'Helvetica, Arial, sans-serif', pt: 12, style: 'italic' },
  'M': { family: 'Helvetica, Arial, sans-serif', pt: 18, weight: 'bold' },
  'N': { family: '"Courier New", Courier, monospace', pt: 9.5 },
  'O': { family: '"Courier New", Courier, monospace', pt: 7 },
  'P': { family: '"Courier New", Courier, monospace', pt: 10 },
  'Q': { family: '"Courier New", Courier, monospace', pt: 10 },
  'R': { family: '"Courier New", Courier, monospace', pt: 12, weight: 'bold' },
  'S': { family: 'monospace', pt: 12 },
  'T': { family: 'monospace', pt: 12 },
};

const normalizeTextScale = (val: number) => (val >= 10 ? val / 10 : (val <= 0 ? 1 : val));

const MM_PER_PT = 25.4 / 72;
const TEXT_FONT_SIZE_SCALE = 1.4;
const textMetricsCache = new Map<string, { ascent: number; descent: number }>();

function getTextFontStyle(textEl: TextElement, zoom: number) {
  const fontConfig = FONT_MAP[textEl.font] || FONT_MAP['G'];
  const fontWeight = fontConfig.weight || 'normal';
  const fontStyle = fontConfig.style || 'normal';
  const fontSizePx = fontConfig.pt * MM_PER_PT * zoom * TEXT_FONT_SIZE_SCALE;
  const fontFamily = fontConfig.family;
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

function getLineBoundingBoxPx(lineEl: LineElement, zoom: number) {
  const dx = (lineEl.x2 - lineEl.x) / COORDS_PER_MM * zoom;
  const dy = (lineEl.y2 - lineEl.y) / COORDS_PER_MM * zoom;
  const thicknessPx = Math.max(0.5, (lineEl.thickness / DOTS_PER_MM) * zoom);
  const minX = Math.min(0, dx);
  const minY = Math.min(0, dy);
  const maxX = Math.max(0, dx);
  const maxY = Math.max(0, dy);
  const width = (maxX - minX) + thicknessPx;
  const height = (maxY - minY) + thicknessPx;
  return { dx, dy, thicknessPx, minX, minY, width, height };
}

function getElementSize(element: LabelElement, zoom: number) {
  const dotsToPx = (dots: number) => (dots / DOTS_PER_MM) * zoom;
  const coordsToPx = (coords: number) => (coords / COORDS_PER_MM) * zoom;
  
  if (element.type === 'text') {
    const textEl = element as TextElement;
    const font = getTextFontStyle(textEl, zoom);
    const scaleX = normalizeTextScale(textEl.width || 10);
    const scaleY = normalizeTextScale(textEl.height || 10);
    
    const lines = (element.content || '').split('\n');
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
    const targetModuleWidthPx = dotsToPx(element.width);
    const barHeightPx = Math.max(1, coordsToPx(element.height));
    const modules = (element.content?.length ?? 0) * 11 + 35;
    return { width: modules * targetModuleWidthPx, height: barHeightPx };
  }
  if (element.type === 'qrcode') {
    const qrEl = element as QRCodeElement;
    const moduleSizePx = dotsToPx(qrEl.size);
    const modules = 21;
    const sizePx = modules * moduleSizePx;
    return { width: sizePx, height: sizePx };
  }
  if (element.type === 'line') {
    const { width, height } = getLineBoundingBoxPx(element as LineElement, zoom);
    return { width, height };
  }
  if (element.type === 'rectangle') {
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
  const [labelSize, setLabelSize] = useState({ width: 104, height: 63 });
  const [labelName, setLabelName] = useState('Untitled');
  const [zoom, setZoom] = useState(4); // 1mm = 4px
  const [printSettings, setPrintSettings] = useState<PrintSettings>({
    issueMode: 'I',
    quantity: 1,
    speed: 'C',
    sensor: '5',
    statusResponse: '200'
  });

  const effectiveHeightMm = Math.max(1, labelSize.height - 3);
  
  const selectedElement = elements.find(el => el.id === selectedId);

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
        newElement = { ...base, type: 'text', content: 'New Text', font: 'G', width: 10, height: 10 } as TextElement;
        break;
      case 'barcode':
        newElement = { ...base, type: 'barcode', content: '12345678', barcodeType: '9', height: 100, width: 3, ratio: '3' } as BarcodeElement;
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
    // Convert px to 0.1mm units (COORDS_PER_MM)
    const x = Math.round(data.x / zoom * COORDS_PER_MM);
    const y = Math.round(data.y / zoom * COORDS_PER_MM);
    updateElement(id, { x, y });
  };

  const exportTPCL = () => {
    const template: LabelTemplate = {
      name: labelName,
      width: labelSize.width,
      height: labelSize.height,
      elements,
      printSettings
    };
    const tpcl = generateTPCL(template);
    
    // Convert string to Windows-1252 bytes for TPCL printer compatibility
    // Most TPCL printers expect 8-bit encoding (like Windows-1252 or ISO-8859-1)
    const bytes = new Uint8Array(tpcl.length);
    for (let i = 0; i < tpcl.length; i++) {
      const charCode = tpcl.charCodeAt(i);
      // Basic mapping for Windows-1252 / ISO-8859-1 characters (0-255)
      // For characters > 255, we'd need a full mapping table, but 0-255 covers most accented chars
      bytes[i] = charCode <= 255 ? charCode : 63; // 63 is '?'
    }
    
    const blob = new Blob([bytes], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${labelName}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveTemplate = () => {
    const template: LabelTemplate = {
      name: labelName,
      width: labelSize.width,
      height: labelSize.height,
      elements,
      printSettings
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

        // Try UTF-8 first
        try {
          const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
          content = utf8Decoder.decode(buffer);
          try {
            template = JSON.parse(content) as LabelTemplate;
            if (!template.elements || !Array.isArray(template.elements)) {
              template = null;
            }
          } catch (e) {
            template = null;
          }
        } catch (e) {
          // Not valid UTF-8, will try windows-1252
        }

        // If UTF-8/JSON failed, try windows-1252 and TPCL
        if (!template) {
          const win1252Decoder = new TextDecoder('windows-1252');
          content = win1252Decoder.decode(buffer);
          try {
            template = parseTPCL(content);
          } catch (tpclErr) {
            console.error('TPCL parse failed:', tpclErr);
          }
        }

        if (template && template.elements && Array.isArray(template.elements)) {
          const normalizedElements = template.elements.map((el) => {
            if (el.type === 'text') {
              const width = el.width < 10 ? Math.round(el.width * 10) : el.width;
              const height = el.height < 10 ? Math.round(el.height * 10) : el.height;
              return { ...el, width, height } as LabelElement;
            }
            if (el.type === 'qrcode') {
              if (el.size > 20) {
                const sizeMm = el.size / DOTS_PER_MM;
                const tpclSize = Math.max(1, Math.min(20, Math.round(sizeMm / 3.5)));
                return { ...el, size: tpclSize } as LabelElement;
              }
              return el as LabelElement;
            }
            return el as LabelElement;
          });

          setElements(normalizedElements);
          setLabelSize({ width: template.width, height: template.height });
          setLabelName(template.name || 'Untitled');
          if (template.printSettings) {
            setPrintSettings(template.printSettings);
          }
          setSelectedId(null);
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
          <button onClick={() => setElements([])} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 transition-colors">
            <Plus size={16} />
            New
          </button>
          <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer">
            <Upload size={16} />
            Load
            <input type="file" accept=".json,.txt,.tpcl" className="hidden" onChange={loadTemplate} />
          </label>
          <button onClick={saveTemplate} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 transition-colors">
            <Save size={16} />
            Save
          </button>
          <button onClick={exportTPCL} className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm transition-all active:scale-95 ml-2">
            <FileDown size={16} />
            Export TPCL
          </button>
        </div>
      </header>

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
                type="range" min="1" max="10" step="0.5" 
                value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-24 accent-blue-600"
              />
              <span className="text-xs font-mono w-8">{Math.round(zoom * 25)}%</span>
            </div>
            <div className="w-px h-4 bg-slate-200" />
            <div className="text-[10px] font-bold text-slate-400 uppercase">
              {labelSize.width} x {effectiveHeightMm} mm
            </div>
          </div>

          <div 
            className="bg-white shadow-2xl border border-slate-300 relative transition-all duration-300" 
            style={{ 
              width: `${labelSize.width * zoom}px`, 
              height: `${effectiveHeightMm * zoom}px`,
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
                isSelected={selectedId === el.id}
                onSelect={() => setSelectedId(el.id)}
                onDrag={(data) => handleDrag(el.id, data)}
              />
            ))}
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
                        value={selectedElement.font}
                        onChange={(e) => updateElement(selectedElement.id, { font: e.target.value })}
                      >
                        <optgroup label="Times Roman">
                          <option value="A">A (8pt Medium)</option>
                          <option value="B">B (10pt Medium)</option>
                          <option value="C">C (10pt Bold)</option>
                          <option value="D">D (12pt Bold)</option>
                          <option value="E">E (14pt Bold)</option>
                          <option value="F">F (12pt Italic)</option>
                        </optgroup>
                        <optgroup label="Helvetica">
                          <option value="G">G (6pt Medium)</option>
                          <option value="H">H (10pt Medium)</option>
                          <option value="I">I (12pt Medium)</option>
                          <option value="J">J (12pt Bold)</option>
                          <option value="K">K (14pt Bold)</option>
                          <option value="L">L (12pt Italic)</option>
                        </optgroup>
                        <optgroup label="Others">
                          <option value="M">M (Presentation Bold 18pt)</option>
                          <option value="N">N (Letter Gothic 9.5pt)</option>
                          <option value="O">O (Prestige Elite 7pt)</option>
                          <option value="P">P (Prestige Elite 10pt)</option>
                          <option value="Q">Q (Courier 10pt)</option>
                          <option value="R">R (Courier Bold 12pt)</option>
                          <option value="S">S (OCR-A 12pt)</option>
                          <option value="T">T (OCR-B 12pt)</option>
                        </optgroup>
                      </select>
                    </div>
                    <PropertyGrid>
                      <PropertyInput 
                        label="Width Scale" 
                        value={selectedElement.width} 
                        onChange={(val) => updateElement(selectedElement.id, { width: parseInt(val) })}
                        type="number"
                        step={1}
                      />
                      <PropertyInput 
                        label="Height Scale" 
                        value={selectedElement.height} 
                        onChange={(val) => updateElement(selectedElement.id, { height: parseInt(val) })}
                        type="number"
                        step={1}
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
                        <option value="9">CODE 128</option>
                        <option value="5">CODE 39</option>
                        <option value="3">EAN-13</option>
                        <option value="2">EAN-8</option>
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
                value={labelSize.width} 
                onChange={(val) => setLabelSize({ ...labelSize, width: parseInt(val) })}
                type="number"
                step={1}
              />
              <PropertyInput 
                label="Height (mm)" 
                value={labelSize.height} 
                onChange={(val) => setLabelSize({ ...labelSize, height: parseInt(val) })}
                type="number"
                step={1}
              />
            </PropertyGrid>

            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-6 mb-4">Print Settings (XS)</h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Issue Mode</label>
                <select 
                  className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                  value={printSettings.issueMode}
                  onChange={(e) => setPrintSettings({ ...printSettings, issueMode: e.target.value })}
                >
                  <option value="I">I (Batch)</option>
                  <option value="C">C (Cut)</option>
                  <option value="D">D (Strip)</option>
                </select>
              </div>
              <PropertyInput 
                label="Quantity" 
                value={printSettings.quantity} 
                onChange={(val) => setPrintSettings({ ...printSettings, quantity: parseInt(val) || 1 })}
                type="number"
                step={1}
              />
              <PropertyGrid>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Speed</label>
                  <select 
                    className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                    value={printSettings.speed}
                    onChange={(e) => setPrintSettings({ ...printSettings, speed: e.target.value })}
                  >
                    <option value="A">A (Slowest)</option>
                    <option value="B">B</option>
                    <option value="C">C (Normal)</option>
                    <option value="D">D</option>
                    <option value="E">E (Fastest)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Sensor</label>
                  <select 
                    className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                    value={printSettings.sensor}
                    onChange={(e) => setPrintSettings({ ...printSettings, sensor: e.target.value })}
                  >
                    <option value="0">None</option>
                    <option value="1">Reflective</option>
                    <option value="2">Transmissive</option>
                    <option value="5">Auto</option>
                  </select>
                </div>
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
  step = 1
}: { 
  label: string, 
  value: string | number, 
  onChange: (val: string) => void,
  type?: 'text' | 'number',
  step?: number
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

function DraggableElement({ element, zoom, isSelected, onSelect, onDrag }: { 
  element: LabelElement, 
  zoom: number,
  isSelected: boolean,
  onSelect: () => void, 
  onDrag: (data: { x: number, y: number }) => void,
}) {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  
  const rotation = ((element.rotation || 0) % 4 + 4) % 4;
  const size = getElementSize(element, zoom);
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

  const x = (element.x / COORDS_PER_MM) * zoom;
  const y = (element.y / COORDS_PER_MM) * zoom;

  const baselineOffsetPx = (() => {
    if (element.type !== 'text') return 0;
    const textEl = element as TextElement;
    const font = getTextFontStyle(textEl, zoom);
    const { ascent } = getFontMetricsPx(font);
    const scaleY = normalizeTextScale(textEl.height || 10);
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
        <ElementRenderer element={element} zoom={zoom} />
        
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

function ElementRenderer({ element, zoom }: { element: LabelElement, zoom: number }) {
  const rotation = ((element.rotation || 0) % 4 + 4) % 4;
  const rotationDegrees = rotation * 90;

  const dotsToPx = (dots: number) => (dots / DOTS_PER_MM) * zoom;

  const renderContent = () => {
    switch (element.type) {
      case 'text': {
        const textEl = element as TextElement;
        const font = getTextFontStyle(textEl, zoom);
        const scaleX = normalizeTextScale(textEl.width || 10);
        const scaleY = normalizeTextScale(textEl.height || 10);

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
            {textEl.content}
          </div>
        );
      }
      case 'barcode': {
        const barEl = element as BarcodeElement;
        const targetModuleWidthPx = dotsToPx(barEl.width);
        const barHeightPx = Math.max(1, (barEl.height / COORDS_PER_MM) * zoom);
        
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
        const moduleSizePx = dotsToPx(qrEl.size);
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
        const { dx, dy, thicknessPx, minX, minY, width, height } = getLineBoundingBoxPx(lineEl, zoom);
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
        const w = (rectEl.width / COORDS_PER_MM) * zoom;
        const h = (rectEl.height / COORDS_PER_MM) * zoom;
        const t = Math.max(0.5, dotsToPx(rectEl.thickness));
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

  const { width: rawWidth, height: rawHeight } = getElementSize(element, zoom);
  
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
