import { 
  LabelElement, 
  LabelTemplate, 
  BarcodeElement, 
  QRCodeElement, 
  TextElement, 
  LineElement, 
  RectangleElement, 
  COORDS_PER_MM,
  LabelDriver
} from '../types';

type Typography = {
  fontFamily: string;
  fontSizePt: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
};

const TPCL_FONT_PRESETS: Record<string, Typography> = {
  A: { fontFamily: 'times', fontSizePt: 8, fontWeight: 'normal', fontStyle: 'normal' },
  B: { fontFamily: 'times', fontSizePt: 10, fontWeight: 'normal', fontStyle: 'normal' },
  C: { fontFamily: 'times', fontSizePt: 10, fontWeight: 'bold', fontStyle: 'normal' },
  D: { fontFamily: 'times', fontSizePt: 12, fontWeight: 'bold', fontStyle: 'normal' },
  E: { fontFamily: 'times', fontSizePt: 14, fontWeight: 'bold', fontStyle: 'normal' },
  F: { fontFamily: 'times', fontSizePt: 12, fontWeight: 'normal', fontStyle: 'italic' },
  G: { fontFamily: 'helvetica', fontSizePt: 6, fontWeight: 'normal', fontStyle: 'normal' },
  H: { fontFamily: 'helvetica', fontSizePt: 10, fontWeight: 'normal', fontStyle: 'normal' },
  I: { fontFamily: 'helvetica', fontSizePt: 12, fontWeight: 'normal', fontStyle: 'normal' },
  J: { fontFamily: 'helvetica', fontSizePt: 12, fontWeight: 'bold', fontStyle: 'normal' },
  K: { fontFamily: 'helvetica', fontSizePt: 14, fontWeight: 'bold', fontStyle: 'normal' },
  L: { fontFamily: 'helvetica', fontSizePt: 12, fontWeight: 'normal', fontStyle: 'italic' },
  M: { fontFamily: 'presentation', fontSizePt: 18, fontWeight: 'bold', fontStyle: 'normal' },
  N: { fontFamily: 'letter-gothic', fontSizePt: 9.5, fontWeight: 'normal', fontStyle: 'normal' },
  O: { fontFamily: 'prestige-elite', fontSizePt: 7, fontWeight: 'normal', fontStyle: 'normal' },
  P: { fontFamily: 'prestige-elite', fontSizePt: 10, fontWeight: 'normal', fontStyle: 'normal' },
  Q: { fontFamily: 'courier', fontSizePt: 10, fontWeight: 'normal', fontStyle: 'normal' },
  R: { fontFamily: 'courier', fontSizePt: 12, fontWeight: 'bold', fontStyle: 'normal' },
  S: { fontFamily: 'ocr-a', fontSizePt: 12, fontWeight: 'normal', fontStyle: 'normal' },
  T: { fontFamily: 'ocr-b', fontSizePt: 12, fontWeight: 'normal', fontStyle: 'normal' }
};

function normalizeTypography(el: TextElement): Typography {
  const fontWeight = (el.fontWeight === 'bold' ? 'bold' : 'normal') as Typography['fontWeight'];
  const fontStyle = (el.fontStyle === 'italic' ? 'italic' : 'normal') as Typography['fontStyle'];
  const fontFamily = typeof el.fontFamily === 'string' && el.fontFamily.length > 0 ? el.fontFamily : 'helvetica';
  const fontSizePt = typeof el.fontSizePt === 'number' && Number.isFinite(el.fontSizePt) && el.fontSizePt > 0 ? el.fontSizePt : 10;
  return { fontFamily, fontSizePt, fontWeight, fontStyle };
}

function getTpclFontId(el: TextElement): string {
  const typography = normalizeTypography(el);
  const match = Object.entries(TPCL_FONT_PRESETS).find(([, preset]) => (
    preset.fontFamily === typography.fontFamily &&
    preset.fontSizePt === typography.fontSizePt &&
    preset.fontWeight === typography.fontWeight &&
    preset.fontStyle === typography.fontStyle
  ));
  return match?.[0] ?? 'G';
}

const BARCODE_MAP: Record<string, string> = {
  'code128': '9',
  'ean13': '2',
  'ean8': '1',
  'upca': '3',
  'upce': '4',
  'code39': '5'
};

const REVERSE_BARCODE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(BARCODE_MAP).map(([k, v]) => [v, k])
);

export class TPCLDriver implements LabelDriver {
  supportedExtensions = ['.tpcl', '.txt'];

  generate(label: LabelTemplate): string {
    const lines: string[] = [];
    const normalizeMag = (value: unknown) => {
      if (typeof value !== 'number' || !Number.isFinite(value)) return 10;
      if (value <= 0) return 10;
      const normalized = value < 10 ? Math.round(value * 10) : Math.round(value);
      return Math.max(0, Math.min(99, normalized));
    };
    const isPrefixedId = (id: unknown, prefix: string) => typeof id === 'string' && new RegExp(`^${prefix}\\d+$`).test(id);

    // Start with common header
    lines.push('{C|}');
    
    // Label size: D, Length, Width, Effective Length
    const length = Math.round(label.height * COORDS_PER_MM).toString().padStart(4, '0');
    const width = Math.round(label.width * COORDS_PER_MM).toString().padStart(4, '0');
    const effectiveLength = Math.round((label.height - 3) * COORDS_PER_MM).toString().padStart(4, '0');
    lines.push(`{D${length},${width},${effectiveLength}|}`);
    
    lines.push('{AX;+000,+000,+00|}');
    lines.push('{AY;+10,0|}');

    const pcCommands: string[] = [];
    const xbCommands: string[] = [];
    const rcCommands: string[] = [];
    const graphicCommands: string[] = [];

    label.elements.forEach((el, index) => {
      const x = el.x.toString().padStart(4, '0');
      const y = el.y.toString().padStart(4, '0');
      
      const rotationStr = (el.rotation || 0).toString().padStart(2, '0');

      switch (el.type) {
        case 'text': {
          const textEl = el as TextElement;
          const h = normalizeMag(textEl.height).toString().padStart(2, '0');
          const w = normalizeMag(textEl.width).toString().padStart(2, '0');
          const font = getTpclFontId(textEl);
          const pcId = isPrefixedId(textEl.id, 'PC') ? textEl.id : `PC${index.toString().padStart(3, '0')}`;
          const rcId = pcId.replace(/^PC/, 'RC');
          pcCommands.push(`{${pcId};${x},${y},${h},${w},${font},${rotationStr},B|}`);
          if (Object.prototype.hasOwnProperty.call(textEl, 'content')) {
            rcCommands.push(`{${rcId};${textEl.content ?? ''}|}`);
          }
          break;
        }

        case 'barcode': {
          const barEl = el as BarcodeElement;
          const barHeight = barEl.height.toString().padStart(4, '0');
          const narrowBar = barEl.width.toString().padStart(2, '0');
          const rotationVal = Math.max(0, Math.min(3, Math.round(barEl.rotation || 0))).toString();
          const barcodeType = BARCODE_MAP[barEl.barcodeType] || '9';
          
          const xbId = isPrefixedId(barEl.id, 'XB') ? barEl.id : `XB${index.toString().padStart(2, '0')}`;
          const rbId = xbId.replace(/^XB/, 'RB');
          // TPCL specific defaults
          xbCommands.push(`{${xbId};${x},${y},${barcodeType},3,${narrowBar},${rotationVal},${barHeight},+0000000000,000,0,00|}`);
          xbCommands.push(`{${rbId};${barEl.content ?? ''}|}`);
          break;
        }

        case 'qrcode': {
          const qrEl = el as QRCodeElement;
          const qrSize = Math.max(1, Math.min(20, Math.round(qrEl.size))).toString().padStart(2, '0');
          const qrRotation = Math.max(0, Math.min(3, Math.round(qrEl.rotation || 0))).toString();
          const errorCorrection = qrEl.errorCorrection || 'H';

          const qxId = isPrefixedId(qrEl.id, 'XB') ? qrEl.id : `XB${index.toString().padStart(2, '0')}`;
          const qbId = qxId.replace(/^XB/, 'RB');
          xbCommands.push(`{${qxId};${x},${y},T,${errorCorrection},${qrSize},A,${qrRotation}|}`);
          xbCommands.push(`{${qbId};${qrEl.content ?? ''}|}`);
          break;
        }

        case 'line': {
          const lineEl = el as LineElement;
          const x2 = lineEl.x2.toString().padStart(4, '0');
          const y2 = lineEl.y2.toString().padStart(4, '0');
          graphicCommands.push(`{LC;${x},${y},${x2},${y2},0,${lineEl.thickness}|}`);
          break;
        }

        case 'rectangle': {
          const rectEl = el as RectangleElement;
          const rx2 = (rectEl.x + rectEl.width).toString().padStart(4, '0');
          const ry2 = (rectEl.y + rectEl.height).toString().padStart(4, '0');
          graphicCommands.push(`{XR;${x},${y},${rx2},${ry2},B|}`);
          break;
        }
      }
    });

    lines.push(...pcCommands);
    lines.push(...xbCommands);
    lines.push(...rcCommands);
    lines.push(...graphicCommands);

    const ps = label.printSettings;
    if (ps) {
      const quantity = ps.quantity.toString().padStart(4, '0');
      // Format: {XS;issueMode,quantity,sets(hardcoded 0002 for now),speed,sensor,rotation(0),status|}
      lines.push(`{XS;I,${quantity},0002C52200|}`);
    } else {
      lines.push('{XS;I,0001,0002C52200|}');
    }

    return lines.join('\r\n') + '\r\n';
  }

  parse(tpcl: string): LabelTemplate {
    const elements: LabelElement[] = [];
    let width = 100;
    let height = 150;

    const commands = tpcl.match(/\{[^}]+\|?\}/g) || [];

    const textDefs = new Map<string, any>();
    const barcodeDefs = new Map<string, any>();

    commands.forEach(cmd => {
      const cleanCmd = cmd.replace(/^\{/, '').replace(/\|?\}$/, '');
      const parts = cleanCmd.split(';');
      const commandType = parts[0];

      if (cleanCmd.startsWith('D') && parts.length === 1) {
        const params = cleanCmd.substring(1).split(',');
        if (params.length >= 2) {
          height = parseInt(params[0]) / COORDS_PER_MM;
          width = parseInt(params[1]) / COORDS_PER_MM;
        }
      } else if (commandType === 'D' && parts.length > 1) {
        const params = parts[1].split(',');
        if (params.length >= 2) {
          height = parseInt(params[0]) / COORDS_PER_MM;
          width = parseInt(params[1]) / COORDS_PER_MM;
        }
      } else if (commandType === 'LC') {
        const params = parts[1].split(',');
        if (params.length >= 6) {
          elements.push({
            id: Math.random().toString(36).substring(2, 11),
            type: 'line',
            x: parseInt(params[0]),
            y: parseInt(params[1]),
            rotation: 0,
            x2: parseInt(params[2]),
            y2: parseInt(params[3]),
            thickness: parseInt(params[5])
          });
        }
      } else if (commandType === 'XR') {
        const params = parts[1].split(',');
        if (params.length >= 5) {
          const x1 = parseInt(params[0]);
          const y1 = parseInt(params[1]);
          const x2 = parseInt(params[2]);
          const y2 = parseInt(params[3]);
          elements.push({
            id: Math.random().toString(36).substring(2, 11),
            type: 'rectangle',
            x: x1,
            y: y1,
            rotation: 0,
            width: x2 - x1,
            height: y2 - y1,
            thickness: 3
          });
        }
      } else if (commandType.startsWith('PC')) {
        const params = parts[1].split(',');
        textDefs.set(commandType, {
          x: parseInt(params[0]),
          y: parseInt(params[1]),
          height: parseInt(params[2]),
          width: parseInt(params[3]),
          font: params[4],
          rotation: parseInt(params[5]),
          id: commandType
        });
      } else if (commandType.startsWith('RC')) {
        const pcId = commandType.replace('RC', 'PC');
        const def = textDefs.get(pcId);
        if (def) {
          const content = cleanCmd.substring(commandType.length + 1);
          const typography = TPCL_FONT_PRESETS[def.font] ?? TPCL_FONT_PRESETS.G;
          elements.push({
            id: def.id,
            type: 'text',
            x: def.x,
            y: def.y,
            rotation: def.rotation,
            fontFamily: typography.fontFamily,
            fontSizePt: typography.fontSizePt,
            fontWeight: typography.fontWeight,
            fontStyle: typography.fontStyle,
            width: def.width,
            height: def.height,
            content: content
          });
        }
      } else if (commandType.startsWith('XB')) {
        const params = parts[1].split(',');
        barcodeDefs.set(commandType, {
          params,
          id: commandType
        });
      } else if (commandType.startsWith('RB')) {
        const xbId = commandType.replace('RB', 'XB');
        const def = barcodeDefs.get(xbId);
        if (def) {
          const params = def.params;
          const content = cleanCmd.substring(commandType.length + 1);
          if (params.length === 7 && params[2] === 'T') {
             elements.push({
               id: def.id,
               type: 'qrcode',
               x: parseInt(params[0]),
               y: parseInt(params[1]),
               rotation: parseInt(params[6]),
               size: parseInt(params[4]),
               content: content,
               errorCorrection: params[3] as any
             });
          } else {
             elements.push({
               id: def.id,
               type: 'barcode',
               x: parseInt(params[0]),
               y: parseInt(params[1]),
               rotation: parseInt(params[5]),
               barcodeType: REVERSE_BARCODE_MAP[params[2]] || 'code128',
               width: parseInt(params[4]),
               height: parseInt(params[6]),
               content: content
             });
          }
        }
      }
    });

    return {
      name: 'Imported Label',
      width,
      height,
      elements
    };
  }
}
