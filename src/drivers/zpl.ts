import {
  BarcodeElement,
  COORDS_PER_MM,
  DOTS_PER_MM,
  LabelDriver,
  LabelElement,
  LabelTemplate,
  LineElement,
  QRCodeElement,
  RectangleElement,
  TextElement
} from '../types'

export class ZPLDriver implements LabelDriver {
  supportedExtensions = ['.ezpl'];

  generate(label: LabelTemplate): string {
    const TEXT_FONT_SIZE_SCALE = 1.4
    const targetDotsPerMm = label.printSettings?.zplDotsPerMm ?? DOTS_PER_MM

    const coordsToDots = (coords: number) => Math.max(0, Math.round((coords * targetDotsPerMm) / COORDS_PER_MM))
    const mmToDots = (mm: number) => Math.max(0, Math.round(mm * targetDotsPerMm))

    const ptToDots = (pt: number) => {
      const mm = ((pt * 25.4) / 72) * TEXT_FONT_SIZE_SCALE
      return Math.max(1, Math.round(mm * targetDotsPerMm))
    }

    const normalizeTextScale = (val: number) => (val >= 10 ? val / 10 : (val <= 0 ? 1 : val))
    const estimateAscentDots = (fontHeightDots: number) => Math.round(fontHeightDots * 0.8)
    const estimateAscentCoords = (fontHeightDots: number) => Math.round((estimateAscentDots(fontHeightDots) * COORDS_PER_MM) / targetDotsPerMm)

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
        const fontBaseDots = ptToDots(textEl.fontSizePt || 10)
        const scaleX = normalizeTextScale(textEl.width || 10)
        const scaleY = normalizeTextScale(textEl.height || 10)
        const fontHeightDots = Math.max(1, Math.round(fontBaseDots * scaleY))
        const fontWidthDots = Math.max(1, Math.round(fontBaseDots * scaleX))
        const yTop = Math.max(0, (textEl.y || 0) - estimateAscentCoords(fontHeightDots))
        lines.push(`^FO${coordsToDots(textEl.x)},${coordsToDots(yTop)}`)
        lines.push(`^A0${rotationToZpl(textEl.rotation)},${fontHeightDots},${fontWidthDots}`)
        lines.push(`^FD${safeFieldData(textEl.content ?? '')}^FS`)
        return
      }

      if (el.type === 'barcode') {
        const barEl = el as BarcodeElement
        const orientation = rotationToZpl(barEl.rotation)
        const heightDots = coordsToDots(barEl.height)
        const narrowDots = Math.max(1, Math.round((barEl.width * targetDotsPerMm) / DOTS_PER_MM))
        const showText = barEl.showText === true ? 'Y' : 'N'
        lines.push(`^FO${coordsToDots(barEl.x)},${coordsToDots(barEl.y)}`)
        lines.push(`^BY${narrowDots},2,${heightDots}`)
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
        const magnification = Math.max(1, Math.min(20, Math.round((qrEl.size * targetDotsPerMm) / DOTS_PER_MM)))
        const ec = (qrEl.errorCorrection || 'H') as string
        lines.push(`^FO${coordsToDots(qrEl.x)},${coordsToDots(qrEl.y)}`)
        lines.push(`^BQ${orientation},2,${magnification},${ec},7`)
        lines.push(`^FDLA,${safeFieldData(qrEl.content ?? '')}^FS`)
        return
      }

      if (el.type === 'rectangle') {
        const rectEl = el as RectangleElement
        const wDots = coordsToDots(rectEl.width)
        const hDots = coordsToDots(rectEl.height)
        const tDots = Math.max(1, Math.round((rectEl.thickness * targetDotsPerMm) / DOTS_PER_MM))
        lines.push(`^FO${coordsToDots(rectEl.x)},${coordsToDots(rectEl.y)}`)
        lines.push(`^GB${wDots},${hDots},${tDots},B,0^FS`)
        return
      }

      if (el.type === 'line') {
        const lineEl = el as LineElement
        const dx = lineEl.x2 - lineEl.x
        const dy = lineEl.y2 - lineEl.y
        const tDots = Math.max(1, Math.round((lineEl.thickness * targetDotsPerMm) / DOTS_PER_MM))

        const xMin = Math.min(lineEl.x, lineEl.x2)
        const yMin = Math.min(lineEl.y, lineEl.y2)
        const wDots = Math.max(1, coordsToDots(Math.abs(dx)))
        const hDots = Math.max(1, coordsToDots(Math.abs(dy)))

        lines.push(`^FO${coordsToDots(xMin)},${coordsToDots(yMin)}`)
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
    const MM_PER_PT = 25.4 / 72
    const TEXT_FONT_SIZE_SCALE = 1.4
    const ASCENT_RATIO = 0.8

    const zplToRotation = (o?: string) => {
      const c = (o || 'N').toUpperCase()
      if (c === 'R') return 1
      if (c === 'I') return 2
      if (c === 'B') return 3
      return 0
    }

    const normalizeTextScale = (val: number) => (val >= 10 ? val / 10 : (val <= 0 ? 1 : val))
    const estimateAscentDots = (fontHeightDots: number) => Math.round(fontHeightDots * ASCENT_RATIO)

    const start = content.indexOf('^XA')
    const end = content.lastIndexOf('^XZ')
    const zpl = (start >= 0 && end > start) ? content.slice(start, end + 3) : content

    type FieldRecord =
      | { kind: 'text'; foX: number; foY: number; o: string; hDots: number; wDots: number; data: string }
      | { kind: 'barcode'; foX: number; foY: number; type: BarcodeElement['barcodeType']; o: string; hDots: number; showText: boolean; narrowDots: number; data: string }
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
      | { kind: 'text'; o: string; hDots: number; wDots: number }
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

      if (cmd === 'A0') {
        const [o, hStr, wStr] = rest.split(',')
        const hDots = parseInt(hStr, 10)
        const wDots = parseInt(wStr, 10)
        pending = { kind: 'text', o: o || 'N', hDots: Number.isFinite(hDots) ? hDots : 20, wDots: Number.isFinite(wDots) ? wDots : 20 }
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
            o: pending.o,
            hDots: pending.hDots,
            wDots: pending.wDots,
            data: contentStr
          })
        } else if (pending.kind === 'barcode') {
          const data = pendingData ?? ''
          const narrow = Math.max(1, currentBy?.w ?? 2)
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
      const candidates = [DOTS_PER_MM, 11.811, 23.622]
      let best = DOTS_PER_MM
      let bestScore = Number.NEGATIVE_INFINITY

      const median = (arr: number[]) => {
        if (arr.length === 0) return null
        const sorted = [...arr].sort((a, b) => a - b)
        return sorted[Math.floor(sorted.length / 2)]
      }

      const typicalTextHeightDots = median(textHeightsDots)

      for (const cand of candidates) {
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
    const dotsToCoords = (dots: number) => Math.round(dotsToMm(dots) * COORDS_PER_MM)
    const dotsToPt = (dots: number) => (dotsToMm(dots) / MM_PER_PT)
    const dotsToBaseDots = (dots: number) => Math.max(1, Math.round((dots * DOTS_PER_MM) / sourceDotsPerMm))

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
      const xCoords = dotsToCoords(field.foX)
      const yCoordsTop = dotsToCoords(field.foY)

      if (field.kind === 'text') {
        const scaleX = field.hDots > 0 ? (field.wDots / field.hDots) : 1
        const baseDots = field.hDots
        const yBaselineDots = field.foY + estimateAscentDots(field.hDots)
        const yBaseline = dotsToCoords(yBaselineDots)
        const fontSizePt = dotsToPt(baseDots) / TEXT_FONT_SIZE_SCALE

        const textEl: TextElement = {
          id,
          type: 'text',
          x: xCoords,
          y: yBaseline,
          rotation: zplToRotation(field.o),
          content: field.data,
          fontFamily: 'helvetica',
          fontSizePt,
          fontWeight: 'normal',
          fontStyle: 'normal',
          width: scaleX,
          height: 1
        }
        elements.push(textEl)
        continue
      }

      if (field.kind === 'barcode') {
        const barEl: BarcodeElement = {
          id,
          type: 'barcode',
          x: xCoords,
          y: yCoordsTop,
          rotation: zplToRotation(field.o),
          content: field.data,
          barcodeType: field.type,
          width: dotsToBaseDots(field.narrowDots),
          height: dotsToCoords(field.hDots),
          showText: field.showText
        }
        elements.push(barEl)
        continue
      }

      if (field.kind === 'qrcode') {
        const qrEl: QRCodeElement = {
          id,
          type: 'qrcode',
          x: xCoords,
          y: yCoordsTop,
          rotation: zplToRotation(field.o),
          content: field.data,
          size: Math.max(1, Math.min(20, dotsToBaseDots(field.mag))),
          errorCorrection: (field.ec as any) || 'H'
        }
        elements.push(qrEl)
        continue
      }

      if (field.kind === 'gb') {
        const wCoords = dotsToCoords(field.wDots)
        const hCoords = dotsToCoords(field.hDots)
        const t = dotsToBaseDots(field.tDots)

        if (field.wDots <= field.tDots || field.hDots <= field.tDots) {
          const isVertical = field.wDots <= field.tDots
          const lineEl: LineElement = {
            id,
            type: 'line',
            x: xCoords,
            y: yCoordsTop,
            rotation: 0,
            x2: xCoords + (isVertical ? 0 : wCoords),
            y2: yCoordsTop + (isVertical ? hCoords : 0),
            thickness: t
          }
          elements.push(lineEl)
          continue
        }

        const rectEl: RectangleElement = {
          id,
          type: 'rectangle',
          x: xCoords,
          y: yCoordsTop,
          rotation: 0,
          width: wCoords,
          height: hCoords,
          thickness: t
        }
        elements.push(rectEl)
        continue
      }

      if (field.kind === 'gd') {
        const wCoords = dotsToCoords(field.wDots)
        const hCoords = dotsToCoords(field.hDots)
        const orient = (field.o || 'R').toUpperCase()

        const lineEl: LineElement = {
          id,
          type: 'line',
          x: xCoords,
          y: yCoordsTop,
          rotation: 0,
          x2: xCoords + wCoords,
          y2: yCoordsTop + (orient === 'L' ? 0 : hCoords),
          thickness: dotsToBaseDots(field.tDots)
        }
        elements.push(lineEl)
      }
    }

    if (!printSettings) printSettings = { quantity: 1 }
    if (printSettings.quantity === undefined) printSettings.quantity = 1
    printSettings.zplDotsPerMm = sourceDotsPerMm

    return {
      name: 'Imported ZPL',
      width: widthMm,
      height: heightMm,
      elements,
      printSettings
    }
  }
}
