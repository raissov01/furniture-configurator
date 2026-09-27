/**
 * Фасадтың фрезеровкасы — беттегі ӨРНЕК.
 *
 * ЕҢ БАСТЫСЫ: фрезеровка панельдің ӨЛШЕМІН ӨЗГЕРТПЕЙДІ. Ол — дайын фасадтың
 * бетіне түсетін ойық, сондықтан деталировка да, раскрой да бұрынғыдай қалады.
 * Егер бір күні өрнек детальдің габаритіне әсер ететін болса (мыс. царгалы
 * рамка), ол БАСҚА нәрсе: онда фасад бірнеше детальға бөлінеді де, оны осы
 * модуль емес, `generateCabinet` жасайды.
 *
 * КООРДИНАТА. Жолдар фасадтың ӨЗ жазықтығында беріледі:
 *   x — фасадтың ЕНІ бойымен, сол жақтан
 *   y — фасадтың БИІКТІГІ бойымен, астынан
 * Панельге жазылғанда бұл `drilling` сияқты РЕЗ кеңістігіне ауысады — станок
 * кромкасыз детальді көреді (types.ts-тегі `Drill` түсініктемесін қара).
 *
 * ТЕРЕҢДІК. Әдепкі 3 мм — көрнекі өрнекке жететін, 16 мм плитаны әлсіретпейтін
 * шама. Бірақ ол фреза мен материалға байланысты, сондықтан баптауда тұр әрі
 * панельдің қалыңдығынан асып кетпейтіні тексеріледі.
 */

import { z } from 'zod'
import { ConfigValidationError } from './errors'

export type MillingPoint = { x: number; y: number }

/** Бір тұйық не ашық сызық. Фреза осы жолмен жүреді. */
export type MillingPath = {
  points: MillingPoint[]
  closed: boolean
}

export type MillingPatternId =
  | 'plain'
  | 'frame'
  | 'frameDouble'
  | 'stripesV'
  | 'stripesH'
  | 'louver'
  | 'wave'
  | 'diamond'
  | 'arch'
  | 'grid'
  | 'profileEdge'
  | 'custom'

export type MillingPattern = {
  id: MillingPatternId
  name: string
  /** Жиектен шегініс қолданыла ма (өрнектің көбі иә). */
  usesInset: boolean
  /** Қайталану саны бар ма (жолақ, жалюзи, тор). */
  usesCount: boolean
}

export const MILLING_PATTERNS: MillingPattern[] = [
  { id: 'plain', name: 'Гладкий', usesInset: false, usesCount: false },
  { id: 'frame', name: 'Рамка', usesInset: true, usesCount: false },
  { id: 'frameDouble', name: 'Двойная рамка', usesInset: true, usesCount: false },
  { id: 'stripesV', name: 'Вертикальные полосы', usesInset: true, usesCount: true },
  { id: 'stripesH', name: 'Горизонтальные полосы', usesInset: true, usesCount: true },
  { id: 'louver', name: 'Жалюзи', usesInset: true, usesCount: true },
  { id: 'wave', name: 'Волна', usesInset: true, usesCount: true },
  { id: 'diamond', name: 'Ромб', usesInset: true, usesCount: false },
  { id: 'arch', name: 'Арка', usesInset: true, usesCount: false },
  { id: 'grid', name: 'Сетка', usesInset: true, usesCount: true },
  { id: 'profileEdge', name: 'Профиль по периметру', usesInset: true, usesCount: false },
  { id: 'custom', name: 'Свой рисунок (SVG)', usesInset: true, usesCount: false },
]

export function millingPattern(id: MillingPatternId): MillingPattern {
  const found = MILLING_PATTERNS.find((p) => p.id === id)
  if (!found) throw new ConfigValidationError('milling.patternId', `өрнек табылмады: "${id}"`)
  return found
}

export type MillingSpec = {
  patternId: MillingPatternId
  /** Ойықтың тереңдігі, мм. */
  depth: number
  /** Жиектен шегініс, мм. */
  inset: number
  /** Жолақ / жалюзи / тор үшін қайталану саны. */
  count: number
  /** `patternId === 'custom'` кезінде: SVG мәтіні. */
  svg?: string | undefined
}

/** Ойықтың әдепкі тереңдігі, мм — 16 мм плитаны әлсіретпейді. */
export const MILLING_DEPTH_DEFAULT = 3
/** Әдепкі шегініс, мм. */
export const MILLING_INSET_DEFAULT = 60

export function defaultMillingSpec(patternId: MillingPatternId = 'frame'): MillingSpec {
  return {
    patternId,
    depth: MILLING_DEPTH_DEFAULT,
    inset: MILLING_INSET_DEFAULT,
    count: 5,
  }
}

// ── Өрнектер ─────────────────────────────────────────────────────────────────

const rect = (x0: number, y0: number, x1: number, y1: number): MillingPath => ({
  points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }],
  closed: true,
})

const round1 = (v: number): number => Math.round(v * 10) / 10

/**
 * Өрнектің жолдары. `width` — фасадтың ені, `height` — биіктігі (ГОТОВЫЙ).
 *
 * Шегініс фасадтан үлкен болса өрнек ЖОҚ болып қайтады — бұл қате емес:
 * тар фасадта рамка сыймайды, ал оны күштеп салсақ, сызықтар қиылысып,
 * станок детальді кесіп жіберер еді.
 */
export function millingPaths(spec: MillingSpec, width: number, height: number): MillingPath[] {
  const inset = Math.max(0, spec.inset)
  const x0 = inset
  const y0 = inset
  const x1 = width - inset
  const y1 = height - inset
  const w = x1 - x0
  const h = y1 - y0

  // Сыймайтын өрнек — бос нәтиже. Ең кіші мағыналы алаң: 20 × 20 мм.
  const fits = w >= 20 && h >= 20

  switch (spec.patternId) {
    case 'plain':
      return []

    case 'frame':
      return fits ? [rect(x0, y0, x1, y1)] : []

    case 'frameDouble': {
      if (!fits) return []
      const g = Math.min(20, w / 4, h / 4)
      return [rect(x0, y0, x1, y1), rect(x0 + g, y0 + g, x1 - g, y1 - g)]
    }

    case 'stripesV': {
      if (!fits) return []
      const n = clampCount(spec.count)
      // n жолақ = n сызық, шеттерінен емес, аралыққа тең таралады.
      return Array.from({ length: n }, (_, i) => {
        const x = round1(x0 + (w * (i + 1)) / (n + 1))
        return { points: [{ x, y: y0 }, { x, y: y1 }], closed: false }
      })
    }

    case 'stripesH': {
      if (!fits) return []
      const n = clampCount(spec.count)
      return Array.from({ length: n }, (_, i) => {
        const y = round1(y0 + (h * (i + 1)) / (n + 1))
        return { points: [{ x: x0, y }, { x: x1, y }], closed: false }
      })
    }

    case 'louver': {
      if (!fits) return []
      // Жалюзи — көлбеу қатарлар. Көлбеулігі фасадтың еніне қарай тұрақты:
      // тар фасадта да, кеңде де бірдей көрінеді.
      const n = clampCount(spec.count)
      const rise = Math.min(h / (n + 1), 40)
      return Array.from({ length: n }, (_, i) => {
        const y = round1(y0 + (h * (i + 1)) / (n + 1))
        return {
          points: [{ x: x0, y: round1(y - rise / 2) }, { x: x1, y: round1(y + rise / 2) }],
          closed: false,
        }
      })
    }

    case 'wave': {
      if (!fits) return []
      const n = clampCount(spec.count)
      // Әр толқын — синус. 24 сегментпен жуықтаймыз: фреза доғаны онсыз да
      // сызықпен жүреді, ал 24 сегмент көзге тегіс көрінеді.
      const steps = 24
      const amp = Math.min(h / (n + 1) / 2, 30)
      return Array.from({ length: n }, (_, i) => {
        const base = y0 + (h * (i + 1)) / (n + 1)
        const points = Array.from({ length: steps + 1 }, (_, k) => {
          const t = k / steps
          return { x: round1(x0 + w * t), y: round1(base + amp * Math.sin(t * Math.PI * 2)) }
        })
        return { points, closed: false }
      })
    }

    case 'diamond': {
      if (!fits) return []
      const cx = round1((x0 + x1) / 2)
      const cy = round1((y0 + y1) / 2)
      return [{
        points: [{ x: cx, y: y0 }, { x: x1, y: cy }, { x: cx, y: y1 }, { x: x0, y: cy }],
        closed: true,
      }]
    }

    case 'arch': {
      if (!fits) return []
      // Арканың радиусы фасадтың жартысы; биіктігі жетпесе — жалпақ доға.
      const steps = 24
      const r = w / 2
      const springLine = round1(Math.max(y0, y1 - r))
      const cx = round1((x0 + x1) / 2)
      const arc = Array.from({ length: steps + 1 }, (_, k) => {
        const a = Math.PI * (k / steps)
        return { x: round1(cx - r * Math.cos(a)), y: round1(springLine + (y1 - springLine) * Math.sin(a)) }
      })
      return [{
        points: [{ x: x0, y: y0 }, { x: x0, y: springLine }, ...arc, { x: x1, y: y0 }],
        closed: true,
      }]
    }

    case 'grid': {
      if (!fits) return []
      const n = clampCount(spec.count)
      const out: MillingPath[] = [rect(x0, y0, x1, y1)]
      for (let i = 1; i <= n; i += 1) {
        const x = round1(x0 + (w * i) / (n + 1))
        out.push({ points: [{ x, y: y0 }, { x, y: y1 }], closed: false })
        const y = round1(y0 + (h * i) / (n + 1))
        out.push({ points: [{ x: x0, y }, { x: x1, y }], closed: false })
      }
      return out
    }

    case 'profileEdge': {
      // Периметр бойымен — шегініс кішкентай болса да мағыналы.
      const p = Math.max(0, Math.min(spec.inset, width / 2 - 1, height / 2 - 1))
      if (width - 2 * p < 10 || height - 2 * p < 10) return []
      return [rect(p, p, width - p, height - p)]
    }

    case 'custom': {
      if (!spec.svg) return []
      return fitPaths(parseSvgPaths(spec.svg), x0, y0, w, h)
    }
  }
}

function clampCount(n: number): number {
  if (!Number.isFinite(n)) return 1
  return Math.max(1, Math.min(24, Math.round(n)))
}

/**
 * Фрезеровканы тексеру. Тереңдік панельдің қалыңдығынан асса, фреза детальді
 * ТЕСІП ӨТЕДІ — оны экранда байқау мүмкін емес, тек цехта шығады.
 */
export function validateMilling(
  spec: MillingSpec, panelThickness: number, panelWidth?: number, panelHeight?: number,
): void {
  if (spec.depth <= 0) {
    throw new ConfigValidationError('milling.depth', String(spec.depth), '0-ден үлкен')
  }
  if (spec.depth >= panelThickness) {
    throw new ConfigValidationError(
      'milling.depth', String(spec.depth),
      `панельдің қалыңдығынан (${panelThickness} мм) кем болуы керек — әйтпесе фреза детальді тесіп өтеді`,
    )
  }
  if (spec.patternId === 'custom' && !spec.svg) {
    throw new ConfigValidationError('milling.svg', 'бос', 'SVG файлы таңдалуы керек')
  }
  if (panelWidth !== undefined && panelHeight !== undefined &&
    spec.patternId !== 'plain' && spec.patternId !== 'custom' &&
    millingPaths(spec, panelWidth, panelHeight).length === 0) {
    throw new ConfigValidationError('milling.inset', `${spec.inset} мм: өрнек фасадқа сыймайды`,
      `ені ${panelWidth} мм, биіктігі ${panelHeight} мм фасадта өрнек шығуы керек`)
  }
}

// ── SVG ──────────────────────────────────────────────────────────────────────

/**
 * SVG-дің ішінен сызықтарды алу.
 *
 * ӘДЕЙІ ТОЛЫҚ ЕМЕС: `path` (M/L/H/V/C/Q/Z), `line`, `rect`, `polyline`,
 * `polygon`, `circle` қолдау табады. Доғалар (A) мен `transform` ЖОҚ —
 * оларды үнсіз қате салғаннан гөрі, мүлде салмаған жөн. Фасадтың өрнегі
 * әдетте осы жиынтықпен шектеледі.
 *
 * Координаталар SVG-дегі күйінде қайтады (Y ТӨМЕН қарайды); аудару
 * `fitPaths` ішінде жүреді.
 */
export function parseSvgPaths(svg: string): MillingPath[] {
  const out: MillingPath[] = []

  // ҚҰЖАТТАҒЫ РЕТІМЕН жүреміз. Пішіндерді түрі бойынша топтап оқысақ,
  // пайдаланушының суреті басқа ретпен қайта құрылар еді — ал фрезаның
  // жүру реті сол ретпен шығады.
  for (const m of svg.matchAll(/<(line|rect|circle|polyline|polygon|path)\b[^>]*>/g)) {
    const tag = m[1]!
    const a = attrs(m[0])

    if (tag === 'line') {
      out.push({
        points: [
          { x: num(a['x1']), y: num(a['y1']) },
          { x: num(a['x2']), y: num(a['y2']) },
        ],
        closed: false,
      })
      continue
    }

    if (tag === 'rect') {
      const x = num(a['x']); const y = num(a['y'])
      const w = num(a['width']); const h = num(a['height'])
      if (w <= 0 || h <= 0) continue
      out.push({
        points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }],
        closed: true,
      })
      continue
    }

    if (tag === 'circle') {
      const cx = num(a['cx']); const cy = num(a['cy']); const r = num(a['r'])
      if (r <= 0) continue
      const steps = 32
      out.push({
        points: Array.from({ length: steps }, (_, k) => {
          const t = (k / steps) * Math.PI * 2
          return { x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) }
        }),
        closed: true,
      })
      continue
    }

    if (tag === 'polyline' || tag === 'polygon') {
      const pts = numbers(a['points'] ?? '')
      const points: MillingPoint[] = []
      for (let i = 0; i + 1 < pts.length; i += 2) points.push({ x: pts[i]!, y: pts[i + 1]! })
      if (points.length >= 2) out.push({ points, closed: tag === 'polygon' })
      continue
    }

    out.push(...parsePathData(a['d'] ?? ''))
  }

  return out.filter((p) => p.points.length >= 2)
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of tag.matchAll(/([a-zA-Z-]+)\s*=\s*"([^"]*)"/g)) out[m[1]!] = m[2]!
  return out
}

const num = (v: string | undefined): number => {
  const n = Number.parseFloat(v ?? '0')
  return Number.isFinite(n) ? n : 0
}

const numbers = (s: string): number[] =>
  (s.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number).filter(Number.isFinite)

/** Безье қисығын неше кесіндімен жуықтаймыз. */
const CURVE_STEPS = 12

function parsePathData(d: string): MillingPath[] {
  const out: MillingPath[] = []
  let points: MillingPoint[] = []
  let cx = 0
  let cy = 0
  let startX = 0
  let startY = 0
  let closed = false

  const flush = () => {
    if (points.length >= 2) out.push({ points, closed })
    points = []
    closed = false
  }

  const tokens = d.match(/[A-Za-z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? []
  const unsupported = tokens.find((token) => /^[A-Za-z]$/.test(token) && !/^[MmLlHhVvCcQqZz]$/.test(token))
  if (unsupported) {
    throw new ConfigValidationError('milling.svg', `SVG ${unsupported} командасы қолдау таппайды`, 'M/L/H/V/C/Q/Z')
  }
  let i = 0
  let cmd = ''

  const next = (): number => {
    const v = Number(tokens[i])
    i += 1
    return Number.isFinite(v) ? v : 0
  }

  while (i < tokens.length) {
    const tok = tokens[i]!
    if (/^[MmLlHhVvCcQqZz]$/.test(tok)) {
      cmd = tok
      i += 1
    }
    const rel = cmd === cmd.toLowerCase()

    switch (cmd.toUpperCase()) {
      case 'M': {
        flush()
        const x = next(); const y = next()
        cx = rel ? cx + x : x
        cy = rel ? cy + y : y
        startX = cx; startY = cy
        points.push({ x: cx, y: cy })
        // M-тен кейінгі қосымша жұптар — L (SVG ережесі).
        cmd = rel ? 'l' : 'L'
        break
      }
      case 'L': {
        const x = next(); const y = next()
        cx = rel ? cx + x : x
        cy = rel ? cy + y : y
        points.push({ x: cx, y: cy })
        break
      }
      case 'H': {
        const x = next()
        cx = rel ? cx + x : x
        points.push({ x: cx, y: cy })
        break
      }
      case 'V': {
        const y = next()
        cy = rel ? cy + y : y
        points.push({ x: cx, y: cy })
        break
      }
      case 'C': {
        const p1x = next(); const p1y = next()
        const p2x = next(); const p2y = next()
        const ex = next(); const ey = next()
        const c1 = { x: rel ? cx + p1x : p1x, y: rel ? cy + p1y : p1y }
        const c2 = { x: rel ? cx + p2x : p2x, y: rel ? cy + p2y : p2y }
        const end = { x: rel ? cx + ex : ex, y: rel ? cy + ey : ey }
        for (let k = 1; k <= CURVE_STEPS; k += 1) {
          points.push(cubic({ x: cx, y: cy }, c1, c2, end, k / CURVE_STEPS))
        }
        cx = end.x; cy = end.y
        break
      }
      case 'Q': {
        const p1x = next(); const p1y = next()
        const ex = next(); const ey = next()
        const c = { x: rel ? cx + p1x : p1x, y: rel ? cy + p1y : p1y }
        const end = { x: rel ? cx + ex : ex, y: rel ? cy + ey : ey }
        for (let k = 1; k <= CURVE_STEPS; k += 1) {
          points.push(quad({ x: cx, y: cy }, c, end, k / CURVE_STEPS))
        }
        cx = end.x; cy = end.y
        break
      }
      case 'Z': {
        closed = true
        cx = startX; cy = startY
        flush()
        break
      }
      default:
        // Танылмаған команда (мыс. A): одан әрі оқу мағынасыз — тоқтаймыз.
        i = tokens.length
    }
  }
  flush()
  return out
}

function cubic(p0: MillingPoint, c1: MillingPoint, c2: MillingPoint, p1: MillingPoint, t: number): MillingPoint {
  const u = 1 - t
  return {
    x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x,
    y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y,
  }
}

function quad(p0: MillingPoint, c: MillingPoint, p1: MillingPoint, t: number): MillingPoint {
  const u = 1 - t
  return {
    x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
    y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y,
  }
}

/**
 * Суретті фасадтың алаңына сыйдыру: пропорция САҚТАЛАДЫ (әйтпесе шеңбер
 * эллипске айналады), сурет ортаға тураланады, SVG-дің Y-і аударылады.
 */
export function fitPaths(
  paths: MillingPath[],
  x0: number, y0: number, w: number, h: number,
): MillingPath[] {
  if (paths.length === 0 || w <= 0 || h <= 0) return []

  let minX = Infinity; let minY = Infinity
  let maxX = -Infinity; let maxY = -Infinity
  for (const p of paths) {
    for (const pt of p.points) {
      minX = Math.min(minX, pt.x); maxX = Math.max(maxX, pt.x)
      minY = Math.min(minY, pt.y); maxY = Math.max(maxY, pt.y)
    }
  }
  const srcW = maxX - minX
  const srcH = maxY - minY
  if (!(srcW > 0) && !(srcH > 0)) return []

  const scale = Math.min(srcW > 0 ? w / srcW : Infinity, srcH > 0 ? h / srcH : Infinity)
  const padX = (w - srcW * scale) / 2
  const padY = (h - srcH * scale) / 2

  return paths.map((p) => ({
    closed: p.closed,
    points: p.points.map((pt) => ({
      x: round1(x0 + padX + (pt.x - minX) * scale),
      // SVG-де Y төмен қарайды, фасадта жоғары — сондықтан аударамыз.
      y: round1(y0 + padY + (maxY - pt.y) * scale),
    })),
  }))
}

// ── Zod ──────────────────────────────────────────────────────────────────────

export const MillingSpecSchema = z.object({
  patternId: z.enum([
    'plain', 'frame', 'frameDouble', 'stripesV', 'stripesH', 'louver',
    'wave', 'diamond', 'arch', 'grid', 'profileEdge', 'custom',
  ]),
  depth: z.number().positive(),
  inset: z.number().nonnegative(),
  count: z.number().int().min(1).max(24),
  svg: z.string().optional(),
})
