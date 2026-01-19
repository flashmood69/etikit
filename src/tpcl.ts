import { LabelElement, LabelTemplate, BarcodeElement, QRCodeElement, TextElement, LineElement, RectangleElement, DOTS_PER_MM, COORDS_PER_MM } from './types';

export function generateTPCL(label: LabelTemplate): string {
  const lines: string[] = [];
  const normalizeTextMag = (value: unknown) => {
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
    
    // Default rotation for text is 00, for barcodes it's 0, 1, 2, 3
    const rotationStr = (el.rotation || 0).toString().padStart(2, '0');

    switch (el.type) {
      case 'text': {
        const textEl = el as TextElement;
        // {PC000;x,y,h,w,f,rotation,b|}
        const h = normalizeTextMag(textEl.height).toString().padStart(2, '0');
        const w = normalizeTextMag(textEl.width).toString().padStart(2, '0');
        const pcId = isPrefixedId(textEl.id, 'PC') ? textEl.id : `PC${index.toString().padStart(3, '0')}`;
        const rcId = pcId.replace(/^PC/, 'RC');
        pcCommands.push(`{${pcId};${x},${y},${h},${w},${textEl.font || 'G'},${rotationStr},B|}`);
        if (Object.prototype.hasOwnProperty.call(textEl, 'content')) {
          rcCommands.push(`{${rcId};${textEl.content ?? ''}|}`);
        }
        break;
      }

      case 'barcode': {
        const barEl = el as BarcodeElement;
        // {XB00;x,y,t,c,w,r,h,v,rrr,s,ss|}
        const barHeight = barEl.height.toString().padStart(4, '0');
        const narrowBar = barEl.width.toString().padStart(2, '0');
        const rotationVal = Math.max(0, Math.min(3, Math.round(barEl.rotation || 0))).toString();
        
        const checkDigitControl = barEl.checkDigitControl || '3';
        const sequentialValue = barEl.sequentialValue || '+0000000000';
        const degreeRotation = barEl.degreeRotation || '000';
        const selectionOfCheckDigit = barEl.selectionOfCheckDigit || '0';
        const selectionOfFont = barEl.selectionOfFont || '00';

        const xbId = isPrefixedId(barEl.id, 'XB') ? barEl.id : `XB${index.toString().padStart(2, '0')}`;
        const rbId = xbId.replace(/^XB/, 'RB');
        xbCommands.push(`{${xbId};${x},${y},${barEl.barcodeType},${checkDigitControl},${narrowBar},${rotationVal},${barHeight},${sequentialValue},${degreeRotation},${selectionOfCheckDigit},${selectionOfFont}|}`);
        xbCommands.push(`{${rbId};${barEl.content ?? ''}|}`);
        break;
      }

      case 'qrcode': {
        const qrEl = el as QRCodeElement;
        // {XB01;x,y,T,H,size,A,rotation|}
        const qrSize = Math.max(1, Math.min(20, Math.round(qrEl.size))).toString().padStart(2, '0');
        const qrRotation = Math.max(0, Math.min(3, Math.round(qrEl.rotation || 0))).toString();
        
        const qrType = qrEl.qrType || 'T';
        const errorCorrection = qrEl.errorCorrection || 'H';
        const mode = qrEl.mode || 'A';

        const qxId = isPrefixedId(qrEl.id, 'XB') ? qrEl.id : `XB${index.toString().padStart(2, '0')}`;
        const qbId = qxId.replace(/^XB/, 'RB');
        xbCommands.push(`{${qxId};${x},${y},${qrType},${errorCorrection},${qrSize},${mode},${qrRotation}|}`);
        xbCommands.push(`{${qbId};${qrEl.content ?? ''}|}`);
        break;
      }

      case 'line': {
        const lineEl = el as LineElement;
        // {LC;x1,y1,x2,y2,t,w|}
        const x2 = lineEl.x2.toString().padStart(4, '0');
        const y2 = lineEl.y2.toString().padStart(4, '0');
        graphicCommands.push(`{LC;${x},${y},${x2},${y2},0,${lineEl.thickness}|}`);
        break;
      }

      case 'rectangle': {
        const rectEl = el as RectangleElement;
        // {XR;x1,y1,x2,y2,b|}
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

  // Print command
  const ps = label.printSettings;
  if (ps) {
    const issueMode = ps.issueMode || 'I';
    const quantity = ps.quantity.toString().padStart(4, '0');
    const speed = ps.speed || 'C';
    const sensor = ps.sensor || '5';
    const status = ps.statusResponse || '200';
    // Format: {XS;issueMode,quantity,sets(hardcoded 0002 for now),speed,sensor,rotation(0),status|}
    // Following the pattern from the example: {XS;I,0001,0002C5200|}
    lines.push(`{XS;${issueMode},${quantity},0002${speed}${sensor}2${status}|}`);
  } else {
    lines.push('{XS;I,0001,0002C5200|}');
  }

  return lines.join('\n');
}

export function parseTPCL(tpcl: string): LabelTemplate {
  const elements: LabelElement[] = [];
  let width = 100;
  let height = 150;

  // Normalize line endings and find commands
  const commands = tpcl.match(/\{[^}]+\|?\}/g) || [];

  const textDefs = new Map<string, any>();
  const barcodeDefs = new Map<string, any>();

  commands.forEach(cmd => {
    // Remove { and |}
    const cleanCmd = cmd.replace(/^\{/, '').replace(/\|?\}$/, '');
    const parts = cleanCmd.split(';');
    const commandType = parts[0]; // e.g., D, LC, PC000, XB00

    if (cleanCmd.startsWith('D') && parts.length === 1) {
      // D command usually has no semicolon: D0630,1040,0600
      const params = cleanCmd.substring(1).split(',');
      if (params.length >= 2) {
        height = parseInt(params[0]) / COORDS_PER_MM;
        width = parseInt(params[1]) / COORDS_PER_MM;
      }
    } else if (commandType === 'D' && parts.length > 1) {
      // Handle case where D might have semicolon
      const params = parts[1].split(',');
      if (params.length >= 2) {
        height = parseInt(params[0]) / COORDS_PER_MM;
        width = parseInt(params[1]) / COORDS_PER_MM;
      }
    } else if (commandType === 'LC') {
      // LC;x1,y1,x2,y2,t,w
      const params = parts[1].split(',');
      if (params.length >= 6) {
        elements.push({
          id: Math.random().toString(36).substr(2, 9),
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
      // XR;x1,y1,x2,y2,b
      const params = parts[1].split(',');
      if (params.length >= 5) {
        const x1 = parseInt(params[0]);
        const y1 = parseInt(params[1]);
        const x2 = parseInt(params[2]);
        const y2 = parseInt(params[3]);
        elements.push({
          id: Math.random().toString(36).substr(2, 9),
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
      // Text Definition
      // PC000;x,y,h,w,f,rot,b
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
      // Text Content
      // RC000;content
      const pcId = commandType.replace('RC', 'PC');
      const def = textDefs.get(pcId);
      if (def) {
        elements.push({
          id: def.id,
          type: 'text',
          x: def.x,
          y: def.y,
          rotation: def.rotation,
          font: def.font,
          width: def.width,
          height: def.height,
          content: parts[1]
        });
      }
    } else if (commandType.startsWith('XB')) {
      // Barcode/QR Definition
      const params = parts[1].split(',');
      barcodeDefs.set(commandType, {
        params,
        id: commandType
      });
    } else if (commandType.startsWith('RB')) {
      // Barcode/QR Content
      const xbId = commandType.replace('RB', 'XB');
      const def = barcodeDefs.get(xbId);
      if (def) {
        const params = def.params;
        // Distinguish QR vs Barcode
        // QR usually has 'T' as 3rd param (index 2)
        if (params.length === 7 && params[2] === 'T') {
           // QR
           elements.push({
             id: def.id,
             type: 'qrcode',
             x: parseInt(params[0]),
             y: parseInt(params[1]),
             rotation: parseInt(params[6]),
             size: parseInt(params[4]),
             content: parts[1],
             qrType: params[2],
             errorCorrection: params[3],
             mode: params[5]
           });
        } else {
           // Barcode
           elements.push({
             id: def.id,
             type: 'barcode',
             x: parseInt(params[0]),
             y: parseInt(params[1]),
             rotation: parseInt(params[5]),
             barcodeType: params[2],
             width: parseInt(params[4]),
             height: parseInt(params[6]),
             ratio: '3',
             content: parts[1]
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
