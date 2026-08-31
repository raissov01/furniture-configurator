/**
 * Фасадтың фрезеровкасы.
 *
 * Екі басты талап:
 *   1. Өрнек детальдің ӨЛШЕМІН ӨЗГЕРТПЕЙДІ — деталировка мен раскрой сол күйі.
 *   2. Ойық панельдің ІШІНДЕ қалады әрі оны ТЕСІП ӨТПЕЙДІ. Екеуін де көзбен
 *      тексеру мүмкін емес: біріншісі кестеде, екіншісі станокта шығады.
 */
import { describe, expect, it } from 'vitest'
import {
  MILLING_PATTERNS,
  catalogOf,
  defaultMillingSpec,
  defaultShopProfile,
  fitPaths,
  findTemplate,
  formatCutList,
  generateCabinet,
  millingPaths,
  parseSvgPaths,
  templateToCabinet,
  validateMilling,
} from '../src/core/index'
import type { CabinetConfig, MillingSpec, Panel } from '../src/core/index'

const shop = defaultShopProfile()
const catalog = catalogOf(shop)
const base = templateToCabinet(findTemplate('wardrobe-penal-600')!, catalog)

const spec = (patch: Partial<MillingSpec> = {}): MillingSpec => ({ ...defaultMillingSpec(), ...patch })

function withMilling(milling: MillingSpec | null): CabinetConfig {
  return {
    ...base,
    sections: base.sections.map((s) => ({ ...s, fronts: s.fronts ? { ...s.fronts, milling } : s.fronts })),
  }
}

const fronts = (panels: Panel[]) => panels.filter((p) => p.role === 'front')

// ── Өрнектің геометриясы ─────────────────────────────────────────────────────

describe('өрнектер', () => {
  it('«Гладкий» ештеңе салмайды', () => {
    expect(millingPaths(spec({ patternId: 'plain' }), 400, 1000)).toHaveLength(0)
  })

  it('рамка — шегініспен салынған бір тұйық тіктөртбұрыш', () => {
    const [path, ...rest] = millingPaths(spec({ patternId: 'frame', inset: 50 }), 400, 1000)
    expect(rest).toHaveLength(0)
    expect(path!.closed).toBe(true)
    expect(path!.points).toEqual([
      { x: 50, y: 50 }, { x: 350, y: 50 }, { x: 350, y: 950 }, { x: 50, y: 950 },
    ])
  })

  it('жолақтың саны сұралғандай', () => {
    for (const n of [1, 3, 7]) {
      expect(millingPaths(spec({ patternId: 'stripesV', count: n }), 600, 1000)).toHaveLength(n)
      expect(millingPaths(spec({ patternId: 'stripesH', count: n }), 600, 1000)).toHaveLength(n)
    }
  })

  it('тор: рамка + n тік + n көлденең сызық', () => {
    const paths = millingPaths(spec({ patternId: 'grid', count: 3 }), 600, 1000)
    expect(paths).toHaveLength(1 + 3 + 3)
  })

  it('шегініс фасадтан үлкен болса өрнек САЛЫНБАЙДЫ', () => {
    // Күштеп салсақ, сызықтар қиылысып, фреза детальді кесіп өтер еді.
    for (const p of MILLING_PATTERNS) {
      if (p.id === 'plain' || p.id === 'custom') continue
      const paths = millingPaths(spec({ patternId: p.id, inset: 300 }), 400, 500)
      expect(paths, p.name).toHaveLength(0)
    }
  })

  it('әр өрнектің нүктелері фасадтың ІШІНДЕ қалады', () => {
    const w = 500
    const h = 1200
    for (const p of MILLING_PATTERNS) {
      if (p.id === 'custom') continue
      for (const path of millingPaths(spec({ patternId: p.id, inset: 60, count: 5 }), w, h)) {
        for (const pt of path.points) {
          expect(pt.x, `${p.name} x`).toBeGreaterThanOrEqual(0)
          expect(pt.x, `${p.name} x`).toBeLessThanOrEqual(w)
          expect(pt.y, `${p.name} y`).toBeGreaterThanOrEqual(0)
          expect(pt.y, `${p.name} y`).toBeLessThanOrEqual(h)
        }
      }
    }
  })

  it('толқын мен арка сызықпен жуықталады, бірақ нүктелері жеткілікті', () => {
    const wave = millingPaths(spec({ patternId: 'wave', count: 2 }), 600, 1000)
    for (const p of wave) expect(p.points.length).toBeGreaterThan(10)
    const arch = millingPaths(spec({ patternId: 'arch' }), 600, 1000)
    expect(arch[0]!.points.length).toBeGreaterThan(10)
  })
})

// ── Тексеру ──────────────────────────────────────────────────────────────────

describe('қауіпсіздік тексерулері', () => {
  it('тереңдік панельдің қалыңдығынан асса — ҚАТЕ', () => {
    expect(() => validateMilling(spec({ depth: 16 }), 16)).toThrow(/тесіп өтеді/)
    expect(() => validateMilling(spec({ depth: 20 }), 16)).toThrow(/тесіп өтеді/)
    expect(() => validateMilling(spec({ depth: 3 }), 16)).not.toThrow()
  })

  it('нөл не теріс тереңдік — ҚАТЕ', () => {
    expect(() => validateMilling(spec({ depth: 0 }), 16)).toThrow()
    expect(() => validateMilling(spec({ depth: -2 }), 16)).toThrow()
  })

  it('SVG таңдалмаған «свой рисунок» — ҚАТЕ', () => {
    expect(() => validateMilling(spec({ patternId: 'custom' }), 16)).toThrow(/SVG/)
  })

  it('тым терең өрнек генерацияда да ұсталады', () => {
    expect(() => generateCabinet(withMilling(spec({ depth: 40 })), catalog)).toThrow(/тесіп өтеді/)
  })
})

// ── Панельмен байланысы ──────────────────────────────────────────────────────

describe('фрезеровка мен деталировка', () => {
  it('өрнек детальдің ӨЛШЕМІН ӨЗГЕРТПЕЙДІ', () => {
    const plain = generateCabinet(withMilling(null), catalog)
    const carved = generateCabinet(withMilling(spec({ patternId: 'grid', count: 4 })), catalog)

    expect(carved).toHaveLength(plain.length)
    const size = (p: Panel) => `${p.label} ${p.cutLength}×${p.cutWidth}`
    expect(carved.map(size)).toEqual(plain.map(size))
    // Кесте де бірдей — цех айырманы көрмеуі керек.
    expect(formatCutList(carved, catalog).length).toBe(formatCutList(plain, catalog).length)
  })

  it('өрнек тек ФАСАДҚА түседі', () => {
    const panels = generateCabinet(withMilling(spec({ patternId: 'frame' })), catalog)
    for (const p of panels) {
      if (p.role === 'front') expect(p.milling.length, p.label).toBeGreaterThan(0)
      else expect(p.milling.length, p.label).toBe(0)
    }
  })

  it('milling жоқ болса панельде де бос', () => {
    for (const p of generateCabinet(withMilling(null), catalog)) expect(p.milling).toHaveLength(0)
  })

  it('панельдегі координаталар РЕЗ кеңістігінде — кромка шегерілген', () => {
    const panels = generateCabinet(withMilling(spec({ patternId: 'frame', inset: 50 })), catalog)
    const front = fronts(panels)[0]!
    const pts = front.milling[0]!.points
    // Фасадтың төрт жиегінде де 2 мм кромка бар, сондықтан РЕЗ координатасы
    // готовыйдан W1/L1 қалыңдығына жылжиды: 50 → 48.
    const minX = Math.min(...pts.map((p) => p.x))
    const minY = Math.min(...pts.map((p) => p.y))
    expect(minX).toBe(48)
    expect(minY).toBe(48)
  })

  it('өрнек РЕЗ детальдің ішінен шықпайды', () => {
    const panels = generateCabinet(withMilling(spec({ patternId: 'grid', count: 6, inset: 40 })), catalog)
    for (const p of fronts(panels)) {
      for (const path of p.milling) {
        for (const pt of path.points) {
          expect(pt.x).toBeGreaterThanOrEqual(0)
          expect(pt.x).toBeLessThanOrEqual(p.cutLength)
          expect(pt.y).toBeGreaterThanOrEqual(0)
          expect(pt.y).toBeLessThanOrEqual(p.cutWidth)
        }
      }
    }
  })
})

// ── SVG ──────────────────────────────────────────────────────────────────────

describe('SVG оқу', () => {
  it('қарапайым пішіндер танылады', () => {
    const svg = `<svg>
      <line x1="0" y1="0" x2="10" y2="10"/>
      <rect x="1" y="2" width="8" height="6"/>
      <polyline points="0,0 5,5 10,0"/>
      <polygon points="0,0 10,0 5,8"/>
      <circle cx="5" cy="5" r="4"/>
    </svg>`
    const paths = parseSvgPaths(svg)
    expect(paths).toHaveLength(5)
    // Рет — ҚҰЖАТТАҒЫДАЙ: line, rect, polyline, polygon, circle.
    expect(paths[0]!.closed).toBe(false)
    expect(paths[1]!.points).toHaveLength(4)
    expect(paths[2]!.closed).toBe(false)
    expect(paths[3]!.closed).toBe(true)
    expect(paths[4]!.points.length).toBeGreaterThan(16)
  })

  it('пішіндердің реті құжаттағыдай сақталады', () => {
    // Фреза осы ретпен жүреді, сондықтан рет — нәтиженің бөлігі.
    const paths = parseSvgPaths(
      '<svg><circle cx="1" cy="1" r="1"/><line x1="0" y1="0" x2="1" y2="1"/></svg>',
    )
    expect(paths[0]!.points.length).toBeGreaterThan(16)
    expect(paths[1]!.points).toHaveLength(2)
  })

  it('path: M/L/H/V/Z және салыстырмалы командалар', () => {
    const paths = parseSvgPaths('<path d="M 0 0 L 10 0 V 10 H 0 Z"/>')
    expect(paths).toHaveLength(1)
    expect(paths[0]!.closed).toBe(true)
    expect(paths[0]!.points).toEqual([
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
    ])

    const rel = parseSvgPaths('<path d="m 5 5 l 10 0 l 0 10 z"/>')
    expect(rel[0]!.points).toEqual([{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 15, y: 15 }])
  })

  it('қисықтар кесіндіге жіктеледі', () => {
    const paths = parseSvgPaths('<path d="M 0 0 C 0 10 10 10 10 0"/>')
    expect(paths[0]!.points.length).toBeGreaterThan(5)
    // Соңғы нүкте — қисықтың ұшы.
    const last = paths[0]!.points.at(-1)!
    expect(last.x).toBeCloseTo(10, 5)
    expect(last.y).toBeCloseTo(0, 5)
  })

  it('бірнеше M бөлек жол береді', () => {
    const paths = parseSvgPaths('<path d="M 0 0 L 5 0 M 0 5 L 5 5"/>')
    expect(paths).toHaveLength(2)
  })

  it('бір нүктелі жол лақтырылады', () => {
    expect(parseSvgPaths('<path d="M 3 3"/>')).toHaveLength(0)
  })
})

describe('суретті фасадқа сыйдыру', () => {
  const square = parseSvgPaths('<rect x="0" y="0" width="10" height="10"/>')

  it('пропорция сақталады, сурет ортаға тураланады', () => {
    const fitted = fitPaths(square, 0, 0, 400, 800)
    const xs = fitted[0]!.points.map((p) => p.x)
    const ys = fitted[0]!.points.map((p) => p.y)
    const w = Math.max(...xs) - Math.min(...xs)
    const h = Math.max(...ys) - Math.min(...ys)
    // Шаршы шаршы болып қалады.
    expect(w).toBeCloseTo(h, 1)
    // Биіктігі бойынша ортада: жоғары-төмен қалдық тең.
    expect(Math.min(...ys)).toBeCloseTo(800 - Math.max(...ys), 1)
  })

  it('SVG-дің Y-і АУДАРЫЛАДЫ', () => {
    // SVG-де жоғарыда тұрған нүкте (y кіші) фасадта ЖОҒАРЫ болуы керек.
    const tri = parseSvgPaths('<polygon points="0,0 10,10 0,10"/>')
    const fitted = fitPaths(tri, 0, 0, 100, 100)
    // Бастапқы (0,0) — SVG-дің төбесі → фасадта ең үлкен y.
    expect(fitted[0]!.points[0]!.y).toBeCloseTo(100, 1)
  })

  it('бос кіріс — бос нәтиже', () => {
    expect(fitPaths([], 0, 0, 100, 100)).toHaveLength(0)
    expect(fitPaths(square, 0, 0, 0, 100)).toHaveLength(0)
  })

  it('свой рисунок фасадта ІШКЕ сыяды', () => {
    const panels = generateCabinet(
      withMilling(spec({ patternId: 'custom', svg: '<circle cx="5" cy="5" r="5"/>', inset: 40 })),
      catalog,
    )
    const front = fronts(panels)[0]!
    expect(front.milling.length).toBeGreaterThan(0)
    for (const pt of front.milling[0]!.points) {
      expect(pt.x).toBeGreaterThanOrEqual(0)
      expect(pt.x).toBeLessThanOrEqual(front.cutLength)
      expect(pt.y).toBeGreaterThanOrEqual(0)
      expect(pt.y).toBeLessThanOrEqual(front.cutWidth)
    }
  })
})
