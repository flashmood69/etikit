import { useState, useRef, useEffect } from 'react'
import { Plus, Save, FileDown, Type, Barcode as BarcodeIcon, Square, Minus, Trash2, Move, Settings, ChevronDown, ChevronUp, QrCode, Upload, Undo2, Redo2, AlignLeft, AlignCenter, AlignRight, AlignStartVertical, AlignCenterVertical, AlignEndVertical, LayoutGrid, AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter, MousePointer2 } from 'lucide-react'
import Draggable from 'react-draggable'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import Barcode from 'react-barcode'
import { QRCodeSVG } from 'qrcode.react'
import { LabelElement, ElementType, TextElement, BarcodeElement, QRCodeElement, LineElement, RectangleElement, LabelTemplate, PrintSettings, Protocol, FontMetadata, DEFAULT_DPI, EditorState } from './types'
import { drivers } from './drivers'
import * as LabelService from './services/label-service'
import { useHistory } from './hooks/useHistory'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function App() {
  const { state, pushState, undo, redo, canUndo, canRedo, resetState, replaceState } = useHistory({
    elements: [],
    selectedIds: [],
    labelSize: { width: 102, height: 76 },
    name: 'Untitled',
    protocol: 'tpcl',
    printSettings: LabelService.createDefaultPrintSettings(),
    gridSettings: LabelService.createDefaultGridSettings(),
  });

  const { elements, selectedIds, labelSize, name: labelName, protocol, printSettings, gridSettings } = state;

  const [zoom, setZoom] = useState(4); // 1mm = 4px
  const [isAutoZoom, setIsAutoZoom] = useState(false);
  const [isNewConfirmOpen, setIsNewConfirmOpen] = useState(false);
  const [newLabelPresetId, setNewLabelPresetId] = useState(LabelService.DEFAULT_LABEL_SIZE_PRESET_ID);
  const [newProtocol, setNewProtocol] = useState<Protocol>('tpcl');
  const [newDpi, setNewDpi] = useState<number>(DEFAULT_DPI);
  const editorViewportRef = useRef<HTMLDivElement | null>(null);

  // Helper setters that push to history
  const setElements = (newElements: LabelElement[] | ((prev: LabelElement[]) => LabelElement[])) => {
    const nextElements = typeof newElements === 'function' ? newElements(elements) : newElements;
    pushState({ ...state, elements: nextElements });
  };

  const setSelectedIds = (ids: string[]) => {
    // Selection changes should not typically create a new history entry
    replaceState({ ...state, selectedIds: ids });
  };

  const setLabelSize = (size: { width: number; height: number }) => {
    pushState({ ...state, labelSize: size });
  };

  const setLabelName = (name: string) => {
    pushState({ ...state, name });
  };

  const setProtocol = (p: Protocol) => {
    pushState({ ...state, protocol: p });
  };

  const setPrintSettings = (settings: PrintSettings) => {
    pushState({ ...state, printSettings: settings });
  };

  const setGridSettings = (settings: Partial<typeof gridSettings>) => {
    pushState({ ...state, gridSettings: { ...gridSettings, ...settings } });
  };
  
  const selectedElements = elements.filter(el => selectedIds.includes(el.id));
  const selectedElement = selectedElements.length === 1 ? selectedElements[0] : null;
  const currentDriver = drivers[protocol];

  const addElement = (type: ElementType) => {
    try {
      const newElement = LabelService.createDefaultElement(
        type, 
        protocol, 
        printSettings, 
        currentDriver.supportedFonts, 
        currentDriver.supportedBarcodes
      );
      pushState({
        ...state,
        elements: [...elements, newElement],
        selectedIds: [newElement.id]
      });
    } catch (err) {
      console.error(err);
    }
  };

  const updateElement = (id: string, updates: Partial<LabelElement>) => {
    const nextElements = elements.map(el => {
      if (el.id !== id) return el;
      return LabelService.applyElementUpdates(el, updates);
    });
    pushState({ ...state, elements: nextElements });
  };

  const deleteElement = (id: string) => {
    const nextElements = elements.filter(el => el.id !== id);
    const nextSelectedIds = selectedIds.filter(selectedId => selectedId !== id);
    pushState({
      ...state,
      elements: nextElements,
      selectedIds: nextSelectedIds
    });
  };

  const handleDrag = (id: string, data: { x: number, y: number }) => {
    let x = LabelService.pxToUnits(data.x, zoom, protocol, printSettings)
    let y = LabelService.pxToUnits(data.y, zoom, protocol, printSettings)

    if (gridSettings.enabled) {
      const gridSizeUnits = LabelService.mmToUnits(gridSettings.size, protocol, printSettings);
      x = Math.round(x / gridSizeUnits) * gridSizeUnits;
      y = Math.round(y / gridSizeUnits) * gridSizeUnits;
    }

    updateElement(id, { x, y });
  };

  const alignElements = (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (selectedIds.length === 0) return;

    const labelWidthUnits = LabelService.mmToUnits(labelSize.width, protocol, printSettings);
    const labelHeightUnits = LabelService.mmToUnits(labelSize.height, protocol, printSettings);

    const nextElements = elements.map(el => {
      if (!selectedIds.includes(el.id)) return el;

      const metadata = LabelService.getElementVisualMetadata(
        el, 
        zoom, 
        currentDriver.supportedFonts, 
        protocol, 
        printSettings
      );
      
      const rotatedWidthUnits = LabelService.pxToUnits(metadata.rotatedWidth, zoom, protocol, printSettings);
      const rotatedHeightUnits = LabelService.pxToUnits(metadata.rotatedHeight, zoom, protocol, printSettings);
      const translateXUnits = LabelService.pxToUnits(metadata.translateX, zoom, protocol, printSettings);
      const translateYUnits = LabelService.pxToUnits(metadata.translateY, zoom, protocol, printSettings);
      const baselineOffsetUnits = LabelService.pxToUnits(metadata.baselineOffsetPx, zoom, protocol, printSettings);

      let updates: Partial<LabelElement> = {};

      switch (type) {
        case 'left': 
          updates.x = Math.round(translateXUnits); 
          break;
        case 'center': 
          updates.x = Math.round((labelWidthUnits - rotatedWidthUnits) / 2 + translateXUnits); 
          break;
        case 'right': 
          updates.x = Math.round(labelWidthUnits - rotatedWidthUnits + translateXUnits); 
          break;
        case 'top': 
          updates.y = Math.round(translateYUnits + baselineOffsetUnits); 
          break;
        case 'middle': 
          updates.y = Math.round((labelHeightUnits - rotatedHeightUnits) / 2 + translateYUnits + baselineOffsetUnits); 
          break;
        case 'bottom': 
          updates.y = Math.round(labelHeightUnits - rotatedHeightUnits + translateYUnits + baselineOffsetUnits); 
          break;
      }

      return LabelService.applyElementUpdates(el, updates);
    });

    pushState({ ...state, elements: nextElements });
  };

  const distributeElements = (direction: 'horizontal' | 'vertical') => {
    if (selectedIds.length < 3) return;

    const selectedEls = elements.filter(el => selectedIds.includes(el.id));
    
    // Map elements to their visual metadata for accurate distribution
    const mappedEls = selectedEls.map(el => {
      const metadata = LabelService.getElementVisualMetadata(el, zoom, currentDriver.supportedFonts, protocol, printSettings);
      const rotatedWidthUnits = LabelService.pxToUnits(metadata.rotatedWidth, zoom, protocol, printSettings);
      const rotatedHeightUnits = LabelService.pxToUnits(metadata.rotatedHeight, zoom, protocol, printSettings);
      const translateXUnits = LabelService.pxToUnits(metadata.translateX, zoom, protocol, printSettings);
      const translateYUnits = LabelService.pxToUnits(metadata.translateY, zoom, protocol, printSettings);
      const baselineOffsetUnits = LabelService.pxToUnits(metadata.baselineOffsetPx, zoom, protocol, printSettings);
      
      const visualX = el.x - translateXUnits;
      const visualY = el.y - translateYUnits - baselineOffsetUnits;
      
      return {
        el,
        visualX,
        visualY,
        visualCenterX: visualX + rotatedWidthUnits / 2,
        visualCenterY: visualY + rotatedHeightUnits / 2,
        translateXUnits,
        translateYUnits,
        baselineOffsetUnits
      };
    });

    const sortedEls = [...mappedEls].sort((a, b) => 
      direction === 'horizontal' ? a.visualCenterX - b.visualCenterX : a.visualCenterY - b.visualCenterY
    );

    const first = sortedEls[0];
    const last = sortedEls[sortedEls.length - 1];

    if (direction === 'horizontal') {
      const totalSpan = last.visualCenterX - first.visualCenterX;
      const step = totalSpan / (sortedEls.length - 1);
      
      const nextElements = elements.map(el => {
        const item = sortedEls.find(s => s.el.id === el.id);
        if (!item) return el;
        
        const index = sortedEls.indexOf(item);
        const targetVisualCenterX = first.visualCenterX + index * step;
        const targetVisualX = targetVisualCenterX - (item.visualCenterX - item.visualX);
        const newX = targetVisualX + item.translateXUnits;
        
        return LabelService.applyElementUpdates(el, { x: Math.round(newX) });
      });
      pushState({ ...state, elements: nextElements });
    } else {
      const totalSpan = last.visualCenterY - first.visualCenterY;
      const step = totalSpan / (sortedEls.length - 1);
      
      const nextElements = elements.map(el => {
        const item = sortedEls.find(s => s.el.id === el.id);
        if (!item) return el;
        
        const index = sortedEls.indexOf(item);
        const targetVisualCenterY = first.visualCenterY + index * step;
        const targetVisualY = targetVisualCenterY - (item.visualCenterY - item.visualY);
        const newY = targetVisualY + item.translateYUnits + item.baselineOffsetUnits;
        
        return LabelService.applyElementUpdates(el, { y: Math.round(newY) });
      });
      pushState({ ...state, elements: nextElements });
    }
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
    LabelService.exportLabel(template);
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
    LabelService.saveTemplate(template);
  };

  const loadTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await LabelService.loadTemplate(file);
      if (result) {
        resetState({
          elements: result.elements,
          labelSize: { width: result.width, height: result.height },
          name: result.labelName,
          printSettings: result.printSettings,
          protocol: result.protocol,
          selectedIds: [],
          gridSettings: LabelService.createDefaultGridSettings(),
        });
      } else {
        alert('Could not parse file');
      }
    } catch (err) {
      console.error('Failed to parse template:', err);
      alert('Invalid template file');
    } finally {
      e.target.value = '';
    }
  };

  const resetToNew = (size?: { width: number; height: number }, newProtocol?: Protocol, dpi?: number) => {
    const nextSize = size ?? { width: 102, height: 76 }
    resetState({
      elements: [],
      selectedIds: [],
      name: 'Untitled',
      labelSize: nextSize,
      protocol: newProtocol ?? protocol,
      printSettings: LabelService.createDefaultPrintSettings(dpi),
      gridSettings: LabelService.createDefaultGridSettings(),
    });
  };

  const setDpiPreservingZplTextSizes = (nextDpiRaw: number) => {
    const nextDpi = LabelService.normalizeDpiToPreset(nextDpiRaw)
    const prevDpi = LabelService.getDpi(printSettings)

    const nextPrintSettings = { ...printSettings, dpi: nextDpi };
    let nextElements = elements;

    if (protocol === 'zpl') {
      nextElements = LabelService.rescaleElementsForDpi(elements, prevDpi, nextDpi);
    }

    pushState({
      ...state,
      printSettings: nextPrintSettings,
      elements: nextElements
    });
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        } else if (e.key === 'y') {
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return (
    <div className="flex h-screen w-full flex-col bg-slate-50 text-slate-900 overflow-hidden font-sans">
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-white px-6 py-3 shadow-sm shrink-0 min-h-[64px]">
        <div className="flex items-center gap-3 w-64 flex-none">
          <div className="bg-blue-600 p-2 rounded-lg shadow-blue-200 shadow-lg">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M7 7h10M7 12h10M7 17h10" />
            </svg>
          </div>
          <div className="hidden sm:block">
            <h1 className="text-lg font-bold tracking-tight leading-none">Etikit</h1>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Label Designer</span>
          </div>
        </div>

        <div className="flex-1" />
        
        <div className="flex items-center justify-end gap-2 flex-none">
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setNewLabelPresetId(LabelService.DEFAULT_LABEL_SIZE_PRESET_ID);
                setNewProtocol(protocol);
                setNewDpi(LabelService.normalizeDpiToPreset(LabelService.getDpi(printSettings)));
                setIsNewConfirmOpen(true);
              }}
              title="New Label"
              className="p-2 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Plus size={18} />
            </button>
            <label title="Load Template" className="p-2 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer">
              <Upload size={18} />
              <input type="file" accept=".json,.etec,.ezpl" className="hidden" onChange={loadTemplate} />
            </label>
            <button onClick={saveTemplate} title="Save Template" className="p-2 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors">
              <Save size={18} />
            </button>
          </div>
          
          <div className="h-6 w-[1px] bg-slate-200 mx-1" />
          
          <div className="flex items-center gap-1">
            <button
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <Undo2 size={18} />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y)"
              className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <Redo2 size={18} />
            </button>
          </div>

          <div className="h-6 w-[1px] bg-slate-200 mx-1" />

          <div className="flex items-center gap-1">
            <button
              onClick={() => setGridSettings({ enabled: !gridSettings.enabled, visible: !gridSettings.enabled })}
              title={gridSettings.enabled ? "Disable Snap to Grid" : "Enable Snap to Grid"}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                gridSettings.enabled 
                  ? "bg-blue-50 text-blue-600 hover:bg-blue-100" 
                  : "text-slate-500 hover:bg-slate-100"
              )}
            >
              <div className="relative">
                <LayoutGrid size={18} />
                {gridSettings.enabled && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-600 rounded-full border-2 border-blue-50" />
                )}
              </div>
            </button>
          </div>

          <div className="h-6 w-[1px] bg-slate-200 mx-1" />

          {/* Alignment Tools */}
          <div className={cn(
            "flex items-center gap-0.5 px-1.5 py-1 rounded-xl bg-slate-100 border border-slate-200 shadow-sm transition-opacity duration-200",
            selectedIds.length === 0 && "opacity-40 pointer-events-none"
          )}>
            <button onClick={() => alignElements('left')} className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm text-slate-600 transition-all active:scale-90" title="Align Left"><AlignLeft size={16} /></button>
            <button onClick={() => alignElements('center')} className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm text-slate-600 transition-all active:scale-90" title="Align Center"><AlignCenter size={16} /></button>
            <button onClick={() => alignElements('right')} className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm text-slate-600 transition-all active:scale-90" title="Align Right"><AlignRight size={16} /></button>
            <div className="w-px h-4 bg-slate-300 mx-1" />
            <button onClick={() => alignElements('top')} className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm text-slate-600 transition-all active:scale-90" title="Align Top"><AlignStartVertical size={16} /></button>
            <button onClick={() => alignElements('middle')} className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm text-slate-600 transition-all active:scale-90" title="Align Middle"><AlignCenterVertical size={16} /></button>
            <button onClick={() => alignElements('bottom')} className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm text-slate-600 transition-all active:scale-90" title="Align Bottom"><AlignEndVertical size={16} /></button>
            {selectedIds.length >= 3 && (
              <>
                <div className="w-px h-4 bg-slate-300 mx-1" />
                <button onClick={() => distributeElements('horizontal')} className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm text-slate-600 transition-all active:scale-90" title="Distribute Horizontally"><AlignHorizontalDistributeCenter size={16} /></button>
                <button onClick={() => distributeElements('vertical')} className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm text-slate-600 transition-all active:scale-90" title="Distribute Vertically"><AlignVerticalDistributeCenter size={16} /></button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 ml-1">
            <button onClick={exportLabel} className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm transition-all active:scale-95 group">
              <FileDown size={16} />
              <span className="hidden lg:inline">Export</span>
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
                  value={String(LabelService.normalizeDpiToPreset(newDpi))}
                  onChange={(e) => setNewDpi(LabelService.normalizeDpiToPreset(parseInt(e.target.value, 10)))}
                >
                  {LabelService.COMMON_DPI_PRESETS.map((dpi) => (
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
                  {LabelService.LABEL_SIZE_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {LabelService.formatLabelSizePreset(preset)}
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
                    LabelService.LABEL_SIZE_PRESETS.find((p) => p.id === newLabelPresetId) ??
                    LabelService.LABEL_SIZE_PRESETS.find((p) => p.id === LabelService.DEFAULT_LABEL_SIZE_PRESET_ID) ??
                    LabelService.LABEL_SIZE_PRESETS[0];
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
              {LabelService.formatMm(labelSize.width)} x {LabelService.formatMm(labelSize.height)} mm
            </div>
          </div>

          <div ref={editorViewportRef} className="w-full flex-1 min-h-0 flex items-start justify-center">
            <div 
              className="bg-white shadow-2xl border border-slate-300 relative transition-all duration-300 shrink-0" 
              style={{ 
                width: `${labelSize.width * zoom}px`, 
                height: `${labelSize.height * zoom}px`,
              }}
              onClick={() => setSelectedIds([])}
            >
              {/* Grid Pattern */}
              {gridSettings.visible && (
                <div className="absolute inset-0 opacity-[0.05] pointer-events-none" 
                  style={{ 
                    backgroundImage: `linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)`,
                    backgroundSize: `${gridSettings.size * zoom}px ${gridSettings.size * zoom}px`
                  }} 
                />
              )}

              {elements.map((el) => (
                <DraggableElement 
                  key={el.id} 
                  element={el} 
                  zoom={zoom} 
                  protocol={protocol}
                  printSettings={printSettings}
                  supportedFonts={currentDriver.supportedFonts}
                  isSelected={selectedIds.includes(el.id)}
                  onSelect={(e) => {
                    if (e?.shiftKey) {
                      if (selectedIds.includes(el.id)) {
                        setSelectedIds(selectedIds.filter(id => id !== el.id));
                      } else {
                        setSelectedIds([...selectedIds, el.id]);
                      }
                    } else {
                      setSelectedIds([el.id]);
                    }
                  }}
                  onDrag={(data) => handleDrag(el.id, data)}
                />
              ))}
            </div>
          </div>
        </main>

        {/* Properties Sidebar */}
        <aside className="w-80 border-l bg-white flex flex-col shadow-sm shrink-0">
          <div className="p-4 border-b flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Settings size={14} className="text-slate-400" />
              <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Properties</h2>
            </div>
            {selectedIds.length > 0 && (
              <button 
                onClick={() => {
                  const nextElements = elements.filter(el => !selectedIds.includes(el.id));
                  pushState({ ...state, elements: nextElements, selectedIds: [] });
                }}
                className="text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-colors"
                title="Delete selected"
              >
                <Trash2 size={14} />
              </button>
            )}
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
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{selectedElement.type}</span>
                  </div>
                </header>

                {/* Primary Content Field (First) */}
                {selectedElement.type === 'text' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Content</label>
                    <textarea 
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-h-[80px]"
                      value={(selectedElement as TextElement).content}
                      onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                    />
                  </div>
                )}

                {(selectedElement.type === 'barcode' || selectedElement.type === 'qrcode') && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">
                      {selectedElement.type === 'barcode' ? 'Data' : 'Data'}
                    </label>
                    <input 
                      type="text"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      value={(selectedElement as BarcodeElement | QRCodeElement).content}
                      onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })}
                    />
                  </div>
                )}

                {/* Position & Rotation */}
                <PropertyGrid>
                  <PropertyInput 
                    label="X (mm)" 
                    value={LabelService.unitsToMm(selectedElement.x, protocol, printSettings).toFixed(1)} 
                    onChange={(val) => updateElement(selectedElement.id, { x: LabelService.mmToUnits(parseFloat(val), protocol, printSettings) })}
                    type="number"
                    step={0.1}
                  />
                  <PropertyInput 
                    label="Y (mm)" 
                    value={LabelService.unitsToMm(selectedElement.y, protocol, printSettings).toFixed(1)} 
                    onChange={(val) => updateElement(selectedElement.id, { y: LabelService.mmToUnits(parseFloat(val), protocol, printSettings) })}
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

                {/* Secondary Properties */}
                {selectedElement.type === 'text' && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Font</label>
                      <select 
                        className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                        value={LabelService.getFontPresetKey(selectedElement as TextElement, currentDriver.supportedFonts)}
                        onChange={(e) => updateElement(selectedElement.id, { fontCode: e.target.value } as any)}
                      >
                        {currentDriver.supportedFonts.map(p => (
                          <option key={p.key} value={p.key}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                    <PropertyGrid>
                      <PropertyInput 
                        label={protocol === 'zpl' ? 'Font Width (dots)' : 'Width Scale'} 
                        value={(selectedElement as TextElement).width} 
                        onChange={(val) => updateElement(selectedElement.id, { width: parseFloat(val) })}
                        type="number"
                        step={protocol === 'zpl' ? 1 : 0.1}
                      />
                      <PropertyInput 
                        label={protocol === 'zpl' ? 'Font Height (dots)' : 'Height Scale'} 
                        value={(selectedElement as TextElement).height} 
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
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Type</label>
                      <select 
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                        value={(selectedElement as BarcodeElement).barcodeType}
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
                        value={(selectedElement as BarcodeElement).height} 
                        onChange={(val) => updateElement(selectedElement.id, { height: parseInt(val) })}
                        type="number"
                        step={1}
                      />
                      <PropertyInput 
                        label="Narrow Bar" 
                        value={(selectedElement as BarcodeElement).width} 
                        onChange={(val) => updateElement(selectedElement.id, { width: parseInt(val) })}
                        type="number"
                        step={1}
                      />
                    </PropertyGrid>
                  </>
                )}

                {selectedElement.type === 'qrcode' && (
                  <PropertyInput 
                    label="Size" 
                    value={(selectedElement as QRCodeElement).size} 
                    onChange={(val) => updateElement(selectedElement.id, { size: parseInt(val) })}
                    type="number"
                    step={1}
                  />
                )}

                {selectedElement.type === 'line' && (
                  <div className="space-y-4">
                    <PropertyGrid>
                      <PropertyInput 
                        label="X2 (mm)" 
                        value={LabelService.unitsToMm((selectedElement as LineElement).x2, protocol, printSettings).toFixed(1)} 
                        onChange={(val) => updateElement(selectedElement.id, { x2: LabelService.mmToUnits(parseFloat(val), protocol, printSettings) })}
                        type="number"
                        step={0.1}
                      />
                      <PropertyInput 
                        label="Y2 (mm)" 
                        value={LabelService.unitsToMm((selectedElement as LineElement).y2, protocol, printSettings).toFixed(1)} 
                        onChange={(val) => updateElement(selectedElement.id, { y2: LabelService.mmToUnits(parseFloat(val), protocol, printSettings) })}
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
                      value={LabelService.unitsToMm((selectedElement as RectangleElement).width, protocol, printSettings).toFixed(1)} 
                      onChange={(val) => updateElement(selectedElement.id, { width: LabelService.mmToUnits(parseFloat(val), protocol, printSettings) })}
                      type="number"
                      step={0.1}
                    />
                    <PropertyInput 
                      label="Height (mm)" 
                      value={LabelService.unitsToMm((selectedElement as RectangleElement).height, protocol, printSettings).toFixed(1)} 
                      onChange={(val) => updateElement(selectedElement.id, { height: LabelService.mmToUnits(parseFloat(val), protocol, printSettings) })}
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
                value={LabelService.formatMm(labelSize.width)} 
                onChange={(val) => setLabelSize({ ...labelSize, width: parseFloat(val) })}
                type="number"
                step={0.1}
              />
              <PropertyInput 
                label="Height (mm)" 
                value={LabelService.formatMm(labelSize.height)} 
                onChange={(val) => setLabelSize({ ...labelSize, height: parseFloat(val) })}
                type="number"
                step={0.1}
              />
            </PropertyGrid>

            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-6 mb-4">Grid & Snapping</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-700 flex items-center gap-2">
                  <LayoutGrid size={14} className="text-slate-400" />
                  Show Grid
                </label>
                <button
                  onClick={() => setGridSettings({ visible: !gridSettings.visible })}
                  className={cn(
                    "w-8 h-4 rounded-full transition-colors relative",
                    gridSettings.visible ? "bg-blue-600" : "bg-slate-200"
                  )}
                >
                  <div className={cn(
                    "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all",
                    gridSettings.visible ? "left-[18px]" : "left-[2px]"
                  )} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-700 flex items-center gap-2">
                  <Move size={14} className="text-slate-400" />
                  Snap to Grid
                </label>
                <button
                  onClick={() => setGridSettings({ enabled: !gridSettings.enabled })}
                  className={cn(
                    "w-8 h-4 rounded-full transition-colors relative",
                    gridSettings.enabled ? "bg-blue-600" : "bg-slate-200"
                  )}
                >
                  <div className={cn(
                    "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all",
                    gridSettings.enabled ? "left-[18px]" : "left-[2px]"
                  )} />
                </button>
              </div>
              <PropertyInput 
                label="Grid Size (mm)" 
                value={gridSettings.size} 
                onChange={(val) => setGridSettings({ size: parseFloat(val) || 1 })}
                type="number"
                step={0.1}
              />
            </div>

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
                  value={String(LabelService.normalizeDpiToPreset(printSettings.dpi ?? DEFAULT_DPI))}
                  onChange={(e) => setDpiPreservingZplTextSizes(parseInt(e.target.value, 10))}
                >
                  {LabelService.COMMON_DPI_PRESETS.map((dpi) => (
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
        <div className="flex gap-6 items-center">
          <span className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Ready
          </span>
          <div className="w-px h-3 bg-slate-200" />
          <span className="flex items-center gap-1.5">
            Protocol: <span className="text-blue-600 font-mono tracking-normal">{protocol}</span>
          </span>
          <div className="w-px h-3 bg-slate-200" />
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
  onSelect: (e?: React.MouseEvent | React.TouchEvent) => void, 
  onDrag: (data: { x: number, y: number }) => void,
}) {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  
  const {
    translateX,
    translateY,
    baselineOffsetPx
  } = LabelService.getElementVisualMetadata(element, zoom, supportedFonts, protocol, printSettings);

  const x = LabelService.unitsToPx(element.x, zoom, protocol, printSettings)
  const y = LabelService.unitsToPx(element.y, zoom, protocol, printSettings)

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
        onSelect(e as unknown as React.MouseEvent);
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
          onSelect(e);
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
  const { 
    rotation, 
    rawWidth, 
    rawHeight, 
    rotatedWidth, 
    rotatedHeight, 
    translateX, 
    translateY 
  } = LabelService.getElementVisualMetadata(element, zoom, supportedFonts, protocol, printSettings);
  
  const rotationDegrees = rotation * 90;

  const renderContent = () => {
    switch (element.type) {
      case 'text': {
        const textEl = element as TextElement;
        const font = LabelService.getTextFontStyle(textEl, zoom, supportedFonts, protocol, printSettings);
        const { scaleX, scaleY } = LabelService.getTextScales(textEl, protocol);

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
        const { scaleX, baseModuleWidth, barHeightPx } = LabelService.getBarcodeVisualMetadata(barEl, zoom, protocol, printSettings);

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
        const { sizePx } = LabelService.getQRCodeVisualMetadata(qrEl, zoom, protocol, printSettings);
        
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
        const { dx, dy, thicknessPx, minX, minY, width, height } = LabelService.getLineBoundingBoxPx(lineEl, zoom, protocol, printSettings);
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
        const w = LabelService.unitsToPx(rectEl.width, zoom, protocol, printSettings)
        const h = LabelService.unitsToPx(rectEl.height, zoom, protocol, printSettings)
        const t = LabelService.getThicknessPx(rectEl.thickness, zoom, protocol, printSettings)
        
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
