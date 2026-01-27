import {
  BarcodeElement,
  DEFAULT_DPI,
  LabelDriver,
  LabelElement,
  LabelTemplate,
  LineElement,
  QRCodeElement,
  RectangleElement,
  TextElement,
  Protocol,
  FontMetadata,
  BarcodeMetadata
} from '../types'

const ZPL_FONT_METADATA: FontMetadata[] = [
  { key: '0', label: 'Scalable Triumvirate Bold Condensed', fontFamily: 'helvetica', fontSizePt: 10, fontWeight: 'bold', fontStyle: 'normal' },
  { key: 'A', label: 'Standard', fontFamily: 'courier', fontSizePt: 5, fontWeight: 'normal', fontStyle: 'normal' },
  { key: 'B', label: 'Bold', fontFamily: 'courier', fontSizePt: 7, fontWeight: 'bold', fontStyle: 'normal' },
  { key: 'C', label: 'OCR-B', fontFamily: 'ocr-b', fontSizePt: 12, fontWeight: 'normal', fontStyle: 'normal' },
  { key: 'D', label: 'OCR-A', fontFamily: 'ocr-a', fontSizePt: 10, fontWeight: 'normal', fontStyle: 'normal' },
  { key: 'E', label: 'Sans Serif Medium', fontFamily: 'helvetica', fontSizePt: 12, fontWeight: 'normal', fontStyle: 'normal' },
  { key: 'F', label: 'Sans Serif Bold', fontFamily: 'helvetica', fontSizePt: 14, fontWeight: 'bold', fontStyle: 'normal' },
  { key: 'G', label: 'Sans Serif Extra Bold', fontFamily: 'helvetica', fontSizePt: 18, fontWeight: 'bold', fontStyle: 'normal' },
  { key: 'H', label: 'Sans Serif Ultra Bold', fontFamily: 'helvetica', fontSizePt: 12, fontWeight: 'bold', fontStyle: 'normal' },
  { key: 'P', label: 'Proportional', fontFamily: 'times-roman', fontSizePt: 10, fontWeight: 'normal', fontStyle: 'normal' },
  { key: 'Q', label: 'Proportional Bold', fontFamily: 'times-roman', fontSizePt: 10, fontWeight: 'bold', fontStyle: 'normal' },
  { key: 'R', label: 'Serif', fontFamily: 'times-roman', fontSizePt: 10, fontWeight: 'normal', fontStyle: 'normal' },
  { key: 'S', label: 'Serif Bold', fontFamily: 'times-roman', fontSizePt: 10, fontWeight: 'bold', fontStyle: 'normal' },
  { key: 'T', label: 'Typewriter / Monospace', fontFamily: 'courier', fontSizePt: 10, fontWeight: 'normal', fontStyle: 'normal' },
  { key: 'U', label: 'Ultra-thin', fontFamily: 'helvetica', fontSizePt: 10, fontWeight: 'normal', fontStyle: 'normal' },
  { key: 'V', label: 'Very Large', fontFamily: 'helvetica', fontSizePt: 24, fontWeight: 'normal', fontStyle: 'normal' },
];

const ZPL_BARCODE_METADATA: BarcodeMetadata[] = [
  { type: 'code128', label: 'CODE 128' },
  { type: 'code39', label: 'CODE 39' },
  { type: 'ean13', label: 'EAN-13' },
  { type: 'ean8', label: 'EAN-8' },
  { type: 'upca', label: 'UPC-A' },
  { type: 'upce', label: 'UPC-E' },
];

function getZplFontCode(el: TextElement): string {
  if (typeof el.fontCode === 'string' && el.fontCode.length > 0) return el.fontCode
  return ZPL_FONT_METADATA[0]?.key ?? '0'
}

export class ZPLDriver implements LabelDriver {
  protocol: Protocol = 'zpl';
  supportedExtensions = ['.ezpl'];
  supportedFonts = ZPL_FONT_METADATA;
  supportedBarcodes = ZPL_BARCODE_METADATA;

  generate(label: LabelTemplate): string {
    const TEXT_FONT_SIZE_SCALE = 1.4
    const dpi =
      typeof label.printSettings?.dpi === 'number' && Number.isFinite(label.printSettings.dpi) && label.printSettings.dpi > 0
        ? label.printSettings.dpi
        : DEFAULT_DPI
    const targetDotsPerMm = dpi / 25.4

    const mmToDots = (mm: number) => Math.max(0, Math.round(mm * targetDotsPerMm))

    const ptToDots = (pt: number) => {
      const mm = ((pt * 25.4) / 72) * TEXT_FONT_SIZE_SCALE
      return Math.max(1, Math.round(mm * targetDotsPerMm))
    }

    const estimateAscentDots = (fontHeightDots: number) => Math.round(fontHeightDots * 0.8)

    const rotationToZpl = (rotation: number) => {
      const r = ((rotation || 0) % 4 + 4) % 4
      if (r === 1) return 'R'
      if (r === 2) return 'I'
      if (r === 3) return 'B'
      return 'N'
    }

    const safeFieldData = (value: string) => value.replaceAll('^', ' ').replaceAll('~', ' ')

    const lines: string[] = []
    lines.push('^XA')

    lines.push(`^PW${mmToDots(label.width)}`)
    lines.push(`^LL${mmToDots(label.height)}`)

    const ps = label.printSettings
    if (ps?.darkness !== undefined) lines.push(`^MD${Math.round(ps.darkness)}`)
    if (ps?.speed !== undefined) lines.push(`^PR${Math.round(ps.speed)}`)

    label.elements.forEach((el) => {
      if (el.type === 'text') {
        const textEl = el as TextElement
        const fontCode = getZplFontCode(textEl)
        const fontMeta = ZPL_FONT_METADATA.find((p) => p.key === fontCode) ?? ZPL_FONT_METADATA[0]
        const fontHeightDots = Math.max(
          1,
          Math.round(
            (typeof textEl.height === 'number' && Number.isFinite(textEl.height) && textEl.height > 0)
              ? textEl.height
              : ptToDots(fontMeta?.fontSizePt ?? 10)
          )
        )
        const fontWidthDots = Math.max(
          1,
          Math.round(
            (typeof textEl.width === 'number' && Number.isFinite(textEl.width) && textEl.width > 0)
              ? textEl.width
              : fontHeightDots
          )
        )
        const xDots = Math.max(0, Math.round(textEl.x || 0))
        const yBaselineDots = Math.round(textEl.y || 0)
        const yTopDots = Math.max(0, yBaselineDots - estimateAscentDots(fontHeightDots))
        lines.push(`^FO${xDots},${yTopDots}`)
        lines.push(`^A${fontCode}${rotationToZpl(textEl.rotation)},${fontHeightDots},${fontWidthDots}`)
        lines.push(`^FD${safeFieldData(textEl.content ?? '')}^FS`)
        return
      }

      if (el.type === 'barcode') {
        const barEl = el as BarcodeElement
        const orientation = rotationToZpl(barEl.rotation)
        const xDots = Math.max(0, Math.round(barEl.x || 0))
        const yDots = Math.max(0, Math.round(barEl.y || 0))
        const heightDots = Math.max(1, Math.round(barEl.height || 0))
        const narrowDots = Math.max(1, Math.round(barEl.width || 0))
        const ratio = Math.max(1, Math.round(barEl.ratio ?? 2))
        const showText = barEl.showText === true ? 'Y' : 'N'
        lines.push(`^FO${xDots},${yDots}`)
        lines.push(`^BY${narrowDots},${ratio},${heightDots}`)
        const data = safeFieldData(barEl.content ?? '')
        if (barEl.barcodeType === 'code39') {
          lines.push(`^B3${orientation},N,${heightDots},${showText},N`)
          lines.push(`^FD${data}^FS`)
          return
        }
        if (barEl.barcodeType === 'ean13') {
          lines.push(`^BE${orientation},${heightDots},${showText},N,0`)
          lines.push(`^FD${data}^FS`)
          return
        }
        if (barEl.barcodeType === 'ean8') {
          lines.push(`^B8${orientation},${heightDots},${showText},N`)
          lines.push(`^FD${data}^FS`)
          return
        }
        if (barEl.barcodeType === 'upca') {
          lines.push(`^BU${orientation},${heightDots},${showText},N,N`)
          lines.push(`^FD${data}^FS`)
          return
        }
        if (barEl.barcodeType === 'upce') {
          lines.push(`^B9${orientation},${heightDots},${showText},N,N`)
          lines.push(`^FD${data}^FS`)
          return
        }
        lines.push(`^BC${orientation},${heightDots},${showText},N,N`)
        lines.push(`^FD${data}^FS`)
        return
      }

      if (el.type === 'qrcode') {
        const qrEl = el as QRCodeElement
        const orientation = rotationToZpl(qrEl.rotation)
        const xDots = Math.max(0, Math.round(qrEl.x || 0))
        const yDots = Math.max(0, Math.round(qrEl.y || 0))
        const magnification = Math.max(1, Math.min(20, Math.round(qrEl.size || 0)))
        const ec = (qrEl.errorCorrection || 'H') as string
        lines.push(`^FO${xDots},${yDots}`)
        lines.push(`^BQ${orientation},2,${magnification},${ec},7`)
        lines.push(`^FDLA,${safeFieldData(qrEl.content ?? '')}^FS`)
        return
      }

      if (el.type === 'rectangle') {
        const rectEl = el as RectangleElement
        const xDots = Math.max(0, Math.round(rectEl.x || 0))
        const yDots = Math.max(0, Math.round(rectEl.y || 0))
        const wDots = Math.max(1, Math.round(rectEl.width || 0))
        const hDots = Math.max(1, Math.round(rectEl.height || 0))
        const tDots = Math.max(1, Math.round(rectEl.thickness || 0))
        lines.push(`^FO${xDots},${yDots}`)
        lines.push(`^GB${wDots},${hDots},${tDots},B,0^FS`)
        return
      }

      if (el.type === 'line') {
        const lineEl = el as LineElement
        const dx = lineEl.x2 - lineEl.x
        const dy = lineEl.y2 - lineEl.y
        const tDots = Math.max(1, Math.round(lineEl.thickness || 0))

        const xMin = Math.min(lineEl.x, lineEl.x2)
        const yMin = Math.min(lineEl.y, lineEl.y2)
        const wDots = Math.max(1, Math.round(Math.abs(dx)))
        const hDots = Math.max(1, Math.round(Math.abs(dy)))

        lines.push(`^FO${Math.max(0, Math.round(xMin))},${Math.max(0, Math.round(yMin))}`)
        if (dx === 0 || dy === 0) {
          const boxW = dx === 0 ? tDots : wDots
          const boxH = dy === 0 ? tDots : hDots
          lines.push(`^GB${boxW},${boxH},${tDots},B,0^FS`)
          return
        }
        const orientation = (dx >= 0) === (dy >= 0) ? 'R' : 'L'
        lines.push(`^GD${wDots},${hDots},${tDots},B,${orientation}^FS`)
        return
      }
    })

    if (ps?.quantity !== undefined) lines.push(`^PQ${Math.max(1, Math.round(ps.quantity))}`)
    lines.push('^XZ')
    return lines.join('\n') + '\n'
  }

  parse(content: string): LabelTemplate {
    const ASCENT_RATIO = 0.8

    const zplToRotation = (o?: string) => {
      const c = (o || 'N').toUpperCase()
      if (c === 'R') return 1
      if (c === 'I') return 2
      if (c === 'B') return 3
      return 0
    }

    const estimateAscentDots = (fontHeightDots: number) => Math.round(fontHeightDots * ASCENT_RATIO)

    const start = content.indexOf('^XA')
    const end = content.lastIndexOf('^XZ')
    const zpl = (start >= 0 && end > start) ? content.slice(start, end + 3) : content

    type FieldRecord =
      | { kind: 'text'; foX: number; foY: number; fontCode: string; o: string; hDots: number; wDots: number; data: string }
      | { kind: 'barcode'; foX: number; foY: number; type: BarcodeElement['barcodeType']; o: string; hDots: number; showText: boolean; narrowDots: number; ratio: number; data: string }
      | { kind: 'qrcode'; foX: number; foY: number; o: string; mag: number; ec?: string; data: string }
      | { kind: 'gb'; foX: number; foY: number; wDots: number; hDots: number; tDots: number }
      | { kind: 'gd'; foX: number; foY: number; wDots: number; hDots: number; tDots: number; o?: string }

    const fields: FieldRecord[] = []
    let widthMm = 0
    let heightMm = 0
    let printSettings: LabelTemplate['printSettings'] | undefined
    let hasPW = false
    let hasLL = false
    let pwDots: number | null = null
    let llDots: number | null = null
    let maxXDots = 0
    let maxYDots = 0

    const updateMax = (xDots: number, yDots: number, wDots: number, hDots: number) => {
      const x2 = Math.max(0, xDots) + Math.max(0, wDots)
      const y2 = Math.max(0, yDots) + Math.max(0, hDots)
      maxXDots = Math.max(maxXDots, x2)
      maxYDots = Math.max(maxYDots, y2)
    }

    let currentFO: { xDots: number; yDots: number } | null = null
    let currentBy: { w: number; r: number; h: number } | null = null
    let pending:
      | { kind: 'text'; fontCode: string; o: string; hDots: number; wDots: number }
      | { kind: 'barcode'; type: BarcodeElement['barcodeType']; o: string; hDots: number; showText: boolean }
      | { kind: 'qrcode'; o: string; mag: number; ec?: string }
      | { kind: 'gb'; wDots: number; hDots: number; tDots: number }
      | { kind: 'gd'; wDots: number; hDots: number; tDots: number; o?: string }
      | null = null
    let pendingData: string | null = null

    const commands = zpl.split('^').filter(Boolean)
    for (const raw of commands) {
      const cmd = raw.slice(0, 2)
      const rest = raw.slice(2)

      if (cmd === 'PW') {
        const dots = parseInt(rest, 10)
        if (Number.isFinite(dots)) {
          pwDots = dots
          hasPW = true
        }
        continue
      }
      if (cmd === 'LL') {
        const dots = parseInt(rest, 10)
        if (Number.isFinite(dots)) {
          llDots = dots
          hasLL = true
        }
        continue
      }
      if (cmd === 'MD') {
        const d = parseInt(rest, 10)
        if (Number.isFinite(d)) printSettings = { ...(printSettings || { quantity: 1 }), darkness: d }
        continue
      }
      if (cmd === 'PR') {
        const s = parseInt(rest, 10)
        if (Number.isFinite(s)) printSettings = { ...(printSettings || { quantity: 1 }), speed: s }
        continue
      }
      if (cmd === 'PQ') {
        const q = parseInt(rest, 10)
        if (Number.isFinite(q)) printSettings = { ...(printSettings || { quantity: 1 }), quantity: q }
        continue
      }

      if (cmd === 'FO') {
        const [x, y] = rest.split(',').map(v => parseInt(v, 10))
        currentFO = { xDots: Number.isFinite(x) ? x : 0, yDots: Number.isFinite(y) ? y : 0 }
        continue
      }

      if (cmd === 'BY') {
        const [w, r, h] = rest.split(',').map(v => parseInt(v, 10))
        currentBy = { w: Number.isFinite(w) ? w : 2, r: Number.isFinite(r) ? r : 2, h: Number.isFinite(h) ? h : 10 }
        continue
      }

      if (cmd.startsWith('A')) {
        const fontCode = cmd.slice(1, 2)
        const [o, hStr, wStr] = rest.split(',')
        const hDots = parseInt(hStr, 10)
        const wDots = parseInt(wStr, 10)
        pending = { kind: 'text', fontCode, o: o || 'N', hDots: Number.isFinite(hDots) ? hDots : 20, wDots: Number.isFinite(wDots) ? wDots : 20 }
        continue
      }

      if (cmd === 'BC') {
        const [o, hStr, showText] = rest.split(',')
        const hDots = parseInt(hStr, 10)
        pending = { kind: 'barcode', type: 'code128', o: o || 'N', hDots: Number.isFinite(hDots) ? hDots : (currentBy?.h || 10), showText: (showText || 'N').toUpperCase() === 'Y' }
        continue
      }
      if (cmd === 'B3') {
        const [o, _e, hStr, showText] = rest.split(',')
        const hDots = parseInt(hStr, 10)
        pending = { kind: 'barcode', type: 'code39', o: o || 'N', hDots: Number.isFinite(hDots) ? hDots : (currentBy?.h || 10), showText: (showText || 'N').toUpperCase() === 'Y' }
        continue
      }
      if (cmd === 'BE') {
        const [o, hStr, showText] = rest.split(',')
        const hDots = parseInt(hStr, 10)
        pending = { kind: 'barcode', type: 'ean13', o: o || 'N', hDots: Number.isFinite(hDots) ? hDots : (currentBy?.h || 10), showText: (showText || 'N').toUpperCase() === 'Y' }
        continue
      }
      if (cmd === 'B8') {
        const [o, hStr, showText] = rest.split(',')
        const hDots = parseInt(hStr, 10)
        pending = { kind: 'barcode', type: 'ean8', o: o || 'N', hDots: Number.isFinite(hDots) ? hDots : (currentBy?.h || 10), showText: (showText || 'N').toUpperCase() === 'Y' }
        continue
      }
      if (cmd === 'BU') {
        const [o, hStr, showText] = rest.split(',')
        const hDots = parseInt(hStr, 10)
        pending = { kind: 'barcode', type: 'upca', o: o || 'N', hDots: Number.isFinite(hDots) ? hDots : (currentBy?.h || 10), showText: (showText || 'N').toUpperCase() === 'Y' }
        continue
      }
      if (cmd === 'B9') {
        const [o, hStr, showText] = rest.split(',')
        const hDots = parseInt(hStr, 10)
        pending = { kind: 'barcode', type: 'upce', o: o || 'N', hDots: Number.isFinite(hDots) ? hDots : (currentBy?.h || 10), showText: (showText || 'N').toUpperCase() === 'Y' }
        continue
      }

      if (cmd === 'BQ') {
        const [o, _model, magStr, ec] = rest.split(',')
        const mag = parseInt(magStr, 10)
        pending = { kind: 'qrcode', o: o || 'N', mag: Number.isFinite(mag) ? mag : 4, ec }
        continue
      }

      if (cmd === 'GB') {
        const [wStr, hStr, tStr] = rest.split(',')
        const wDots = parseInt(wStr, 10)
        const hDots = parseInt(hStr, 10)
        const tDots = parseInt(tStr, 10)
        pending = { kind: 'gb', wDots: Number.isFinite(wDots) ? wDots : 1, hDots: Number.isFinite(hDots) ? hDots : 1, tDots: Number.isFinite(tDots) ? tDots : 1 }
        continue
      }

      if (cmd === 'GD') {
        const [wStr, hStr, tStr, _c, o] = rest.split(',')
        const wDots = parseInt(wStr, 10)
        const hDots = parseInt(hStr, 10)
        const tDots = parseInt(tStr, 10)
        pending = { kind: 'gd', wDots: Number.isFinite(wDots) ? wDots : 1, hDots: Number.isFinite(hDots) ? hDots : 1, tDots: Number.isFinite(tDots) ? tDots : 1, o }
        continue
      }

      if (cmd === 'FD') {
        pendingData = rest
        continue
      }

      if (cmd === 'FS') {
        if (!currentFO || !pending) {
          pending = null
          pendingData = null
          continue
        }

        if (pending.kind === 'text') {
          const contentStr = pendingData ?? ''
          const approxWidthDots = Math.max(1, Math.round((contentStr.length || 1) * pending.wDots * 0.6))
          updateMax(currentFO.xDots, currentFO.yDots, approxWidthDots, Math.max(1, pending.hDots))
          fields.push({
            kind: 'text',
            foX: currentFO.xDots,
            foY: currentFO.yDots,
            fontCode: pending.fontCode,
            o: pending.o,
            hDots: pending.hDots,
            wDots: pending.wDots,
            data: contentStr
          })
        } else if (pending.kind === 'barcode') {
          const data = pendingData ?? ''
          const narrow = Math.max(1, currentBy?.w ?? 2)
          const ratio = Math.max(1, currentBy?.r ?? 2)
          const moduleCount = (() => {
            if (pending.type === 'code39') return (data.length || 1) * 13 + 35
            if (pending.type === 'ean13') return 95
            if (pending.type === 'ean8') return 67
            if (pending.type === 'upca') return 95
            if (pending.type === 'upce') return 51
            return (data.length || 1) * 11 + 35
          })()
          updateMax(currentFO.xDots, currentFO.yDots, moduleCount * narrow, Math.max(1, pending.hDots))
          fields.push({
            kind: 'barcode',
            foX: currentFO.xDots,
            foY: currentFO.yDots,
            type: pending.type,
            o: pending.o,
            hDots: pending.hDots,
            showText: pending.showText,
            narrowDots: narrow,
            ratio,
            data
          })
        } else if (pending.kind === 'qrcode') {
          const payload = (pendingData ?? '').replace(/^LA,/, '')
          const approxSizeDots = Math.max(1, Math.round(25 * Math.max(1, pending.mag)))
          updateMax(currentFO.xDots, currentFO.yDots, approxSizeDots, approxSizeDots)
          fields.push({
            kind: 'qrcode',
            foX: currentFO.xDots,
            foY: currentFO.yDots,
            o: pending.o,
            mag: pending.mag,
            ec: pending.ec,
            data: payload
          })
        } else if (pending.kind === 'gb') {
          updateMax(currentFO.xDots, currentFO.yDots, Math.max(1, pending.wDots), Math.max(1, pending.hDots))
          fields.push({
            kind: 'gb',
            foX: currentFO.xDots,
            foY: currentFO.yDots,
            wDots: pending.wDots,
            hDots: pending.hDots,
            tDots: pending.tDots
          })
        } else if (pending.kind === 'gd') {
          updateMax(currentFO.xDots, currentFO.yDots, Math.max(1, pending.wDots), Math.max(1, pending.hDots))
          fields.push({
            kind: 'gd',
            foX: currentFO.xDots,
            foY: currentFO.yDots,
            wDots: pending.wDots,
            hDots: pending.hDots,
            tDots: pending.tDots,
            o: pending.o
          })
        }

        pending = null
        pendingData = null
        continue
      }
    }

    const inferDotsPerMm = (wDots: number, hDots: number, textHeightsDots: number[]) => {
      const candidatesDpi = [DEFAULT_DPI, 300, 600]
      let best = DEFAULT_DPI / 25.4
      let bestScore = Number.NEGATIVE_INFINITY

      const median = (arr: number[]) => {
        if (arr.length === 0) return null
        const sorted = [...arr].sort((a, b) => a - b)
        return sorted[Math.floor(sorted.length / 2)]
      }

      const typicalTextHeightDots = median(textHeightsDots)

      for (const dpi of candidatesDpi) {
        const cand = dpi / 25.4
        const widthMmCand = wDots / cand
        const heightMmCand = hDots / cand
        let score = 0

        if (widthMmCand >= 20 && widthMmCand <= 160) score += 3
        else if (widthMmCand >= 160 && widthMmCand <= 260) score += 1
        else score -= 3

        if (heightMmCand >= 20 && heightMmCand <= 260) score += 2
        else if (heightMmCand >= 260 && heightMmCand <= 400) score += 0
        else score -= 2

        if (widthMmCand > 600 || heightMmCand > 600) score -= 10

        if (typicalTextHeightDots !== null) {
          const textPt = ((typicalTextHeightDots / cand) * 72) / 25.4
          if (textPt >= 4 && textPt <= 72) score += 1
          else if (textPt > 150) score -= 2
        }

        if (score > bestScore) {
          bestScore = score
          best = cand
        }
      }

      return best
    }

    const widthDotsForInference = (pwDots ?? Math.max(1, maxXDots))
    const heightDotsForInference = (llDots ?? Math.max(1, maxYDots))
    const textHeightsDots = fields.filter((f) => f.kind === 'text').map((f) => (f as any).hDots as number)
    const sourceDotsPerMm = inferDotsPerMm(widthDotsForInference, heightDotsForInference, textHeightsDots)

    const dotsToMm = (dots: number) => dots / sourceDotsPerMm

    const marginDots = Math.round(10 * sourceDotsPerMm)
    if (hasPW && pwDots !== null) widthMm = dotsToMm(pwDots)
    if (hasLL && llDots !== null) heightMm = dotsToMm(llDots)

    if (!hasPW) widthMm = dotsToMm(Math.max(1, maxXDots + marginDots))
    if (!hasLL) heightMm = dotsToMm(Math.max(1, maxYDots + marginDots))

    if (!Number.isFinite(widthMm) || widthMm <= 0) widthMm = 100
    if (!Number.isFinite(heightMm) || heightMm <= 0) heightMm = 150

    const roundTo = (value: number, step: number) => {
      if (!Number.isFinite(value)) return value
      if (step <= 0) return value
      return Math.round(value / step) * step
    }
    widthMm = roundTo(widthMm, 0.1)
    heightMm = roundTo(heightMm, 0.1)

    const elements: LabelElement[] = []
    for (const field of fields) {
      const id = Math.random().toString(36).substring(2, 11)
      const xDots = Math.max(0, Math.round(field.foX))
      const yDotsTop = Math.max(0, Math.round(field.foY))

      if (field.kind === 'text') {
        const yBaselineDots = field.foY + estimateAscentDots(field.hDots)
        const fontCode = field.fontCode || '0'

        const textEl: TextElement = {
          id,
          type: 'text',
          x: xDots,
          y: Math.max(0, Math.round(yBaselineDots)),
          rotation: zplToRotation(field.o),
          content: field.data,
          fontCode,
          width: Math.max(1, Math.round(field.wDots)),
          height: Math.max(1, Math.round(field.hDots))
        }
        elements.push(textEl)
        continue
      }

      if (field.kind === 'barcode') {
        const barEl: BarcodeElement = {
          id,
          type: 'barcode',
          x: xDots,
          y: yDotsTop,
          rotation: zplToRotation(field.o),
          content: field.data,
          barcodeType: field.type,
          width: Math.max(1, Math.round(field.narrowDots)),
          height: Math.max(1, Math.round(field.hDots)),
          ratio: Math.max(1, Math.round(field.ratio)),
          showText: field.showText,
        }
        elements.push(barEl)
        continue
      }

      if (field.kind === 'qrcode') {
        const qrEl: QRCodeElement = {
          id,
          type: 'qrcode',
          x: xDots,
          y: yDotsTop,
          rotation: zplToRotation(field.o),
          content: field.data,
          size: Math.max(1, Math.min(20, Math.round(field.mag))),
          errorCorrection: (field.ec as any) || 'H'
        }
        elements.push(qrEl)
        continue
      }

      if (field.kind === 'gb') {
        const wDots = Math.max(1, Math.round(field.wDots))
        const hDots = Math.max(1, Math.round(field.hDots))
        const tDots = Math.max(1, Math.round(field.tDots))

        if (field.wDots <= field.tDots || field.hDots <= field.tDots) {
          const isVertical = field.wDots <= field.tDots
          const lineEl: LineElement = {
            id,
            type: 'line',
            x: xDots,
            y: yDotsTop,
            rotation: 0,
            x2: xDots + (isVertical ? 0 : wDots),
            y2: yDotsTop + (isVertical ? hDots : 0),
            thickness: tDots
          }
          elements.push(lineEl)
          continue
        }

        const rectEl: RectangleElement = {
          id,
          type: 'rectangle',
          x: xDots,
          y: yDotsTop,
          rotation: 0,
          width: wDots,
          height: hDots,
          thickness: tDots
        }
        elements.push(rectEl)
        continue
      }

      if (field.kind === 'gd') {
        const wDots = Math.max(1, Math.round(field.wDots))
        const hDots = Math.max(1, Math.round(field.hDots))
        const orient = (field.o || 'R').toUpperCase()

        const lineEl: LineElement = {
          id,
          type: 'line',
          x: xDots,
          y: yDotsTop,
          rotation: 0,
          x2: xDots + wDots,
          y2: yDotsTop + (orient === 'L' ? 0 : hDots),
          thickness: Math.max(1, Math.round(field.tDots))
        }
        elements.push(lineEl)
      }
    }

    if (!printSettings) printSettings = { quantity: 1 }
    if (printSettings.quantity === undefined) printSettings.quantity = 1
    printSettings.dpi = Math.round(sourceDotsPerMm * 25.4)

    return {
      name: 'Imported ZPL',
      width: widthMm,
      height: heightMm,
      elements,
      printSettings,
      protocol: 'zpl'
    }
  }
}
