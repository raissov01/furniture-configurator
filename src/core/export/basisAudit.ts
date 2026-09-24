/**
 * Базистен қайтқан AUDIT файлын талдау (біз жақта).
 *
 * Бізде Базис жоқ. Базисі бар тестер `*.js` скриптті бір рет іске қосады да,
 * скрипт жазған `<жоба>-bazis-audit.json` файлын қайтарады. Бұл модуль сол
 * файлдағы ШИКІ деректерді (Базис не құрғанын) скрипттің ішіне салынған
 * КҮТІЛГЕН деректермен (`expected` = `BasisScriptData`) ҚАЙТА салыстырады —
 * скрипттің өз салыстыруына сенбейді, тек оны айқастырып тексереді — және
 * қазақша есеп шығарады: мәселе түрі бойынша топталған, ықтимал себебімен.
 *
 * Таза TS (§3): файл оқу/жазу `src/cli/bazisAudit.ts`-те.
 */
import { z } from 'zod'
import type { BasisAxis, BasisFastenerRecord, BasisPanelRecord, BasisScriptData, BasisVec } from './basisScript'

// ── Файлдың пішіні (тек бізге керек өрістер; қалғаны сақталады) ─────────────

const vec3 = z.tuple([z.number().nullable(), z.number().nullable(), z.number().nullable()])

const ButtSchema = z.object({
  elem: z.number().nullable(),
  side: z.string().nullable(),
  material: z.string().optional(),
  thickness: z.number().nullable(),
  clip: z.boolean(),
}).loose()

const PanelReadSchema = z.object({
  index: z.number(),
  created: z.boolean(),
  actual: z.object({
    material: z.string().optional(),
    thickness: z.number().nullable().optional(),
    contourWidth: z.number().nullable().optional(),
    contourHeight: z.number().nullable().optional(),
    gabMin: vec3.nullable().optional(),
    gabMax: vec3.nullable().optional(),
    axisZ: vec3.nullable().optional(),
    butts: z.array(ButtSchema).optional(),
    expectedLocal: z.array(z.object({ fastener: z.number(), drill: z.number(), local: vec3.nullable() })).optional(),
  }).loose().optional(),
}).loose()

const FastenerReadSchema = z.object({
  index: z.number(),
  kind: z.string(),
  mounted: z.boolean(),
  chosen: z.boolean(),
  actual: z.object({
    name: z.string().optional(),
    gabMin: vec3.nullable().optional(),
    gabMax: vec3.nullable().optional(),
    fastened: z.array(z.number()).optional(),
  }).loose().optional(),
}).loose()

const HoleReadSchema = z.object({
  diameter: z.number().nullable(),
  depth: z.number().nullable(),
  fastenerName: z.string().nullable().optional(),
  props: z.record(z.string(), z.unknown()).optional(),
}).loose()

export const BasisAuditFileSchema = z.object({
  format: z.literal('furniture-configurator.basis-audit'),
  version: z.literal(1),
  project: z.string(),
  runAt: z.string().optional(),
  tolerance: z.number(),
  environment: z.record(z.string(), z.unknown()).optional(),
  mapping: z.object({
    kinds: z.array(z.object({ kind: z.string(), chosen: z.boolean(), sampleName: z.string().nullable().optional() }).loose()),
    bands: z.array(z.object({ bandId: z.string(), chosen: z.boolean(), thickness: z.number().nullable().optional() }).loose()),
  }).loose().optional(),
  panels: z.array(PanelReadSchema),
  fasteners: z.array(FastenerReadSchema),
  holes: z.object({
    available: z.boolean(),
    error: z.string().optional(),
    perPanel: z.array(z.object({ panel: z.number(), holes: z.array(HoleReadSchema) })).optional(),
  }).loose().nullable(),
  comparison: z.object({ summary: z.record(z.string(), z.number()) }).loose().nullable().optional(),
  errors: z.array(z.object({ step: z.string(), error: z.string() })),
  expected: z.object({
    format: z.literal('furniture-configurator.basis-script'),
    panels: z.array(z.unknown()),
    fasteners: z.array(z.unknown()),
  }).loose(),
}).loose()

export type BasisAuditFile = z.infer<typeof BasisAuditFileSchema>

export function parseBasisAudit(raw: unknown): BasisAuditFile {
  return BasisAuditFileSchema.parse(raw)
}

// ── Нәтиже ───────────────────────────────────────────────────────────────────

export type AuditCategory =
  | 'environment' | 'mapping'
  | 'panel-missing' | 'panel-size' | 'panel-thickness' | 'panel-position' | 'panel-normal' | 'panel-material'
  | 'edge-missing' | 'edge-thickness' | 'edge-clip'
  | 'fastener-missing' | 'fastener-point' | 'fastener-panels'
  | 'hole-missing' | 'hole-extra' | 'hole-diameter' | 'hole-depth' | 'hole-position'

export type AuditProblem = {
  category: AuditCategory
  where: string
  expected?: unknown
  actual?: unknown
  /** мм, екеуі де сан болғанда */
  delta?: number | undefined
  /** Нақты осы жағдайға тән себеп (жалпысы — `CATEGORY_HINTS`) */
  hint?: string | undefined
}

export type BasisAuditReport = {
  project: string
  runAt: string | null
  tolerance: number
  counts: { ok: number; mismatch: number; missing: number; extra: number; notSent: number; skipped: number }
  problems: AuditProblem[]
  /** Тесіктің орны қай кеңістікте табылды: 'world:Position' → саны */
  holeFrames: Record<string, number>
  holesAvailable: boolean
  /** Скрипттің өз есебі (айқастыру үшін) */
  scriptSummary: Record<string, number> | null
  environment: Record<string, unknown>
  mapping: { kind: string; chosen: boolean; sampleName: string | null }[]
}

/** Мәселе түрінің жалпы ықтимал себебі (қазақша). */
export const CATEGORY_HINTS: Record<AuditCategory, string> = {
  'environment': 'Базистің нұсқасы/API-і күткеннен басқа: скрипттің қай қадамы құлағанын `errors`-тан қараңыз.',
  'mapping': 'Тестер бұл түрге Базис крепежін таңдамаған — тесіктер әдейі жіберілмеген (болжамаймыз).',
  'panel-missing': 'Панель құрылмады: Add*Panel не материал (ActiveMaterial.Make) қате берді — `errors` тізімін қараңыз.',
  'panel-size': 'Өлшем: Базис ГОТОВЫЙ емес, РЕЗ өлшемін салды ма, не кромка екі рет шегерілді ме (ClipPanel)? Айырма кромка қалыңдығына тең болса — сол.',
  'panel-thickness': 'Қалыңдық: ActiveMaterial.Make(атау, қалыңдық) басқа материал берді не материал базасында қалыңдық басқа.',
  'panel-position': 'Орын: осьтер келісімі (Базисте Z алға қарай деген болжам) не қалыңдықтың өсу бағыты (A1 адаптері) қате болуы мүмкін.',
  'panel-normal': 'Нормаль: AddVert/Horiz/FrontPanel қай осьті нормаль етеді — A1 адаптерінің болжамы бұзылған.',
  'panel-material': 'Материал атауы Базис базасында басқаша форматталған (атау + артикул) — өндіріске әсері жоқ болуы мүмкін.',
  'edge-missing': 'Кромка жоқ: контур элементі табылмады (A3) не тестер кромканы таңдамаған.',
  'edge-thickness': 'Кромка қалыңдығы: тестер басқа кромка материалын таңдаған.',
  'edge-clip': 'ClipPanel: Базис біз қойған мәнді сақтамады (A4) — рез өлшемі біздікінен өзгеше болады.',
  'fastener-missing': 'Крепеж қойылмады: Mount/Mount1 қате берді не бос қайтарды — `errors`-ты қараңыз.',
  'fastener-point': 'Крепеж біз берген нүктеде емес: Mount нүктесінің мағынасы (A5) басқаша, не Базис крепежді буынның басқа жеріне «тартты».',
  'fastener-panels': 'Крепеж басқа панельдерді біріктірді: Mount(panel1, panel2) реті (A5) не буын табылмады.',
  'hole-missing': 'Күтілген тесік жоқ: Базистің крепеж моделі бұл тесікті бұрғыламайды не басқа панельге салды.',
  'hole-extra': 'Артық тесік: Базистің крепеж моделінде біздің модельде жоқ тесік бар (мыс. шкант, екінші бұранда).',
  'hole-diameter': 'Диаметр: Базистің крепеж моделі басқа тесік береді (мыс. конфирмат Ø7 ↔ біздің Ø8) — модельдің айырмасы, координата емес.',
  'hole-depth': 'Тереңдік: крепеж моделінің бұрғылау тереңдігі біздің константадан өзгеше.',
  'hole-position': 'Орын: тесік бар, бірақ біз күткен нүктеде емес — бет/ось келісімі не крепеж нүктесінің мағынасы.',
}

// ── Салыстыру ────────────────────────────────────────────────────────────────

const AXES: BasisAxis[] = ['x', 'y', 'z']

function dominant(v: (number | null)[] | null | undefined): BasisAxis | null {
  if (!v || v.some((n) => n === null)) return null
  const a = (v as number[]).map(Math.abs)
  return AXES[a.indexOf(Math.max(...a))]!
}

const dist = (a: number[], b: number[]): number => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!)

function isVec(v: unknown): v is [number, number, number] {
  return Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number')
}

export function analyzeBasisAudit(audit: BasisAuditFile): BasisAuditReport {
  const expected = audit.expected as unknown as BasisScriptData
  const tol = audit.tolerance
  const near = (a: number | null | undefined, b: number): boolean => typeof a === 'number' && Math.abs(a - b) <= tol
  const problems: AuditProblem[] = []
  const counts = { ok: 0, mismatch: 0, missing: 0, extra: 0, notSent: 0, skipped: 0 }
  const push = (p: AuditProblem) => problems.push(p)

  // Орта
  for (const e of audit.errors) push({ category: 'environment', where: e.step, actual: e.error })
  if (!audit.holes?.available) {
    push({
      category: 'environment', where: 'holes',
      actual: audit.holes?.error ?? 'нет данных',
      hint: 'Тесіктерді қайта оқу мүмкін болмады: тек панель мен крепеждің орны тексерілді.',
    })
  }

  // Панельдер
  expected.panels.forEach((p: BasisPanelRecord, i) => {
    const r = audit.panels[i]
    const where = `panel#${i} ${p.name}`
    if (p.skip !== null) { counts.skipped += 1; return }
    if (!r || !r.created || !r.actual) {
      counts.missing += 1
      push({ category: 'panel-missing', where })
      return
    }
    const a = r.actual
    const before = problems.length
    if (!near(a.thickness, p.thickness)) {
      push({ category: 'panel-thickness', where, expected: p.thickness, actual: a.thickness, delta: diff(a.thickness, p.thickness) })
    }
    const eSize = [p.finishedLength, p.finishedWidth].sort((x, y) => x - y)
    const aSize = [a.contourWidth ?? null, a.contourHeight ?? null].sort((x, y) => (x ?? 0) - (y ?? 0))
    if (!near(aSize[0], eSize[0]!) || !near(aSize[1], eSize[1]!)) {
      const bands = p.edges.reduce((s, e) => s + e.thickness, 0)
      const shrunk = [0, 1].some((k) => typeof aSize[k] === 'number' && eSize[k]! - (aSize[k] as number) > tol)
      push({
        category: 'panel-size', where,
        expected: eSize.join(' × '), actual: aSize.join(' × '),
        hint: shrunk && bands > 0 ? `Базис кіші салды; панельдің кромкалары барлығы ${bands} мм — рез өлшемі не екі рет шегеру.` : undefined,
      })
    }
    if (a.gabMin && a.gabMax) {
      const off = AXES.map((_, k) => ({ min: diff(a.gabMin![k], p.min[k]!), max: diff(a.gabMax![k], p.max[k]!) }))
      const bad = off.map((o, k) => ({ o, k })).filter(({ o }) => Math.abs(o.min ?? Infinity) > tol || Math.abs(o.max ?? Infinity) > tol)
      if (bad.length > 0) {
        push({
          category: 'panel-position', where,
          expected: { min: p.min, max: p.max }, actual: { min: a.gabMin, max: a.gabMax },
          hint: positionHint(p, a.gabMin, a.gabMax, expected.zShift, tol),
        })
      }
    }
    const n = dominant(a.axisZ)
    if (n !== null && n !== p.normal) push({ category: 'panel-normal', where, expected: p.normal, actual: n })
    if (typeof a.material === 'string' && a.material !== p.material) {
      push({ category: 'panel-material', where, expected: p.material, actual: a.material })
    }
    const bySide = new Map((a.butts ?? []).filter((b) => b.side).map((b) => [b.side!, b]))
    for (const edge of p.edges) {
      const got = bySide.get(edge.side)
      if (!got) { push({ category: 'edge-missing', where: `${where} ${edge.side}`, expected: edge.thickness }); continue }
      if (!near(got.thickness, edge.thickness)) {
        push({ category: 'edge-thickness', where: `${where} ${edge.side}`, expected: edge.thickness, actual: got.thickness })
      }
      if (got.clip !== edge.clip) push({ category: 'edge-clip', where: `${where} ${edge.side}`, expected: edge.clip, actual: got.clip })
    }
    if (problems.length === before) counts.ok += 1
    else counts.mismatch += 1
  })

  // Крепеж
  const chosenKinds = new Map((audit.mapping?.kinds ?? []).map((k) => [k.kind, k.chosen]))
  const notSentByKind = new Map<string, number>()
  expected.fasteners.forEach((f: BasisFastenerRecord, j) => {
    const r = audit.fasteners[j]
    const where = `fastener#${j} ${f.kind} @ ${f.point.join(', ')}`
    if (f.skip !== null) { counts.skipped += 1; return }
    if (!(r?.chosen ?? chosenKinds.get(f.kind) ?? false)) {
      counts.notSent += 1
      notSentByKind.set(f.kind, (notSentByKind.get(f.kind) ?? 0) + 1)
      return
    }
    if (!r || !r.mounted || !r.actual) {
      counts.missing += 1
      push({ category: 'fastener-missing', where })
      return
    }
    const before = problems.length
    const { gabMin, gabMax, fastened } = r.actual
    if (gabMin && gabMax) {
      const outside = AXES.filter((_, k) => {
        const lo = gabMin[k]
        const hi = gabMax[k]
        return typeof lo === 'number' && typeof hi === 'number' && (f.point[k]! < lo - tol || f.point[k]! > hi + tol)
      })
      if (outside.length > 0) {
        push({ category: 'fastener-point', where, expected: f.point, actual: { min: gabMin, max: gabMax }, hint: `нүкте қорабынан тыс: ${outside.join(', ')} осі` })
      }
    }
    if (fastened) {
      const lost = f.panels.filter((pi) => !fastened.includes(pi))
      if (lost.length > 0) push({ category: 'fastener-panels', where, expected: f.panels, actual: fastened })
    }
    if (problems.length === before) counts.ok += 1
    else counts.mismatch += 1
  })

  for (const [kind, n] of notSentByKind) push({ category: 'mapping', where: kind, actual: `${n} крепеж жіберілмеді` })

  // Тесіктер
  const holeFrames: Record<string, number> = {}
  if (audit.holes?.available) {
    const actualBy = new Map((audit.holes.perPanel ?? []).map((e) => [e.panel, e.holes]))
    expected.panels.forEach((p, pi) => {
      const read = audit.panels[pi]
      if (p.skip !== null || !read?.created) return
      const locals = new Map((read.actual?.expectedLocal ?? []).map((l) => [`${l.fastener}:${l.drill}`, l.local]))
      const actual = actualBy.get(pi) ?? []
      const used = new Set<number>()
      const wanted = expected.fasteners.flatMap((f, fi) => f.holes
        .filter((eh) => eh.panel === pi && f.skip === null && (audit.fasteners[fi]?.chosen ?? false))
        .map((eh) => ({ f, fi, eh })))
      // Екі өту: алдымен ОРНЫ сәйкес келген тесіктер жұпталады, содан кейін
      // ғана қалғаны диаметр бойынша — әйтпесе жылжыған тесік көршісінің
      // жұбын «ұрлап», бір айырма бірнеше жалған айырма болып шығады.
      const matches = new Map<number, ReturnType<typeof matchHole>>()
      for (const pass of ['position', 'fallback'] as const) {
        wanted.forEach(({ fi, eh }, w) => {
          if (matches.has(w)) return
          const m = matchHole(eh, locals.get(`${fi}:${eh.drill}`) ?? null, actual, used, tol, pass === 'position')
          if (m.index < 0) return
          used.add(m.index)
          matches.set(w, m)
        })
      }
      wanted.forEach(({ f, eh }, w) => {
        const where = `panel#${pi} ${p.name}: ${f.kind} Ø${eh.diameter}×${eh.depth} @ ${eh.point.join(', ')}`
        const m = matches.get(w)
        if (!m) { counts.missing += 1; push({ category: 'hole-missing', where }); return }
        const got = actual[m.index]!
        const before = problems.length
        if (m.frame) holeFrames[m.frame] = (holeFrames[m.frame] ?? 0) + 1
        if (!near(got.diameter, eh.diameter)) {
          push({ category: 'hole-diameter', where, expected: eh.diameter, actual: got.diameter, delta: diff(got.diameter, eh.diameter), hint: got.fastenerName ? `Базис крепежі: ${got.fastenerName}` : undefined })
        }
        if (!near(got.depth, eh.depth)) {
          push({ category: 'hole-depth', where, expected: eh.depth, actual: got.depth, delta: diff(got.depth, eh.depth) })
        }
        if (m.frame === null && m.hasVectors) {
          push({ category: 'hole-position', where, expected: eh.point, actual: m.nearest, delta: m.nearestDistance ?? undefined })
        }
        if (problems.length === before) counts.ok += 1
        else counts.mismatch += 1
      })
      actual.forEach((h, k) => {
        if (used.has(k)) return
        counts.extra += 1
        push({ category: 'hole-extra', where: `panel#${pi} ${p.name}`, actual: { diameter: h.diameter, depth: h.depth, fastener: h.fastenerName ?? null } })
      })
    })
  }

  return {
    project: audit.project,
    runAt: audit.runAt ?? null,
    tolerance: tol,
    counts,
    problems,
    holeFrames,
    holesAvailable: audit.holes?.available ?? false,
    scriptSummary: audit.comparison?.summary ?? null,
    environment: audit.environment ?? {},
    mapping: (audit.mapping?.kinds ?? []).map((k) => ({ kind: k.kind, chosen: k.chosen, sampleName: k.sampleName ?? null })),
  }
}

function diff(a: number | null | undefined, b: number): number | undefined {
  return typeof a === 'number' ? Math.round((a - b) * 1000) / 1000 : undefined
}

/** Орынның айырмасынан себепті табуға тырысу: Z айнасы, қалыңдыққа ығысу. */
function positionHint(
  p: BasisPanelRecord,
  min: (number | null)[],
  max: (number | null)[],
  zShift: number,
  tol: number,
): string | undefined {
  if (min.some((n) => n === null) || max.some((n) => n === null)) return undefined
  const lo = min as number[]
  const hi = max as number[]
  // Z айнасы: Базисте Z артқа қарай болса, біздің Z_б = zShift − z болжамы кері шығады.
  const mirroredZ = Math.abs(lo[2]! - (zShift - p.max[2]!)) <= tol && Math.abs(hi[2]! - (zShift - p.min[2]!)) <= tol
  if (mirroredZ && Math.abs(lo[2]! - p.min[2]!) > tol) {
    return 'Z осі айнадай: Базисте Z артқа қарай сияқты — `toBasis` (Z_б = zShift − z) болжамы қате.'
  }
  const k = AXES.indexOf(p.normal)
  const shift = lo[k]! - p.min[k]!
  if (Math.abs(Math.abs(shift) - p.thickness) <= tol && Math.abs(hi[k]! - p.max[k]! - shift) <= tol) {
    return `Панель нормаль бойымен қалыңдыққа (${p.thickness} мм) ығысқан: қалыңдық теріс жаққа өседі — A1 адаптерінің болжамы қате.`
  }
  return undefined
}

type HoleRead = z.infer<typeof HoleReadSchema>

function matchHole(
  eh: { diameter: number; depth: number; point: BasisVec },
  local: (number | null)[] | null,
  actual: HoleRead[],
  used: Set<number>,
  tol: number,
  positionOnly: boolean,
): { index: number; frame: string | null; hasVectors: boolean; nearest: number[] | null; nearestDistance: number | null } {
  let best = { index: -1, frame: null as string | null, score: Infinity, nearest: null as number[] | null, nearestDistance: null as number | null }
  let hasVectors = false
  actual.forEach((a, i) => {
    if (used.has(i)) return
    let frame: string | null = null
    let nearest: number[] | null = null
    let nearestD = Infinity
    for (const [key, v] of Object.entries(a.props ?? {})) {
      if (!isVec(v)) continue
      hasVectors = true
      const dw = dist(v, eh.point)
      const dl = local && isVec(local) ? dist(v, local) : Infinity
      if (dw <= tol) frame = `world:${key}`
      else if (dl <= tol) frame = `local:${key}`
      if (Math.min(dw, dl) < nearestD) { nearestD = Math.min(dw, dl); nearest = v }
    }
    const dd = typeof a.diameter === 'number' ? Math.abs(a.diameter - eh.diameter) : 99
    if (frame === null && (positionOnly || dd > 3)) return
    const score = (frame ? 0 : 1000) + dd * 10 + (typeof a.depth === 'number' ? Math.abs(a.depth - eh.depth) : 50)
    if (score < best.score) {
      best = { index: i, frame, score, nearest, nearestDistance: Number.isFinite(nearestD) ? Math.round(nearestD * 1000) / 1000 : null }
    }
  })
  return { index: best.index, frame: best.frame, hasVectors, nearest: best.nearest, nearestDistance: best.nearestDistance }
}

// ── Қазақша Markdown есеп ────────────────────────────────────────────────────

const CATEGORY_TITLES: Record<AuditCategory, string> = {
  'environment': 'Орта және скрипт қателері',
  'mapping': 'Сәйкестендіру',
  'panel-missing': 'Панель құрылмады',
  'panel-size': 'Панель өлшемі',
  'panel-thickness': 'Панель қалыңдығы',
  'panel-position': 'Панельдің орны (габарит)',
  'panel-normal': 'Панельдің бағыты (нормаль)',
  'panel-material': 'Материал атауы',
  'edge-missing': 'Кромка жоқ',
  'edge-thickness': 'Кромка қалыңдығы',
  'edge-clip': 'Кромка: ClipPanel',
  'fastener-missing': 'Крепеж қойылмады',
  'fastener-point': 'Крепеждің орны',
  'fastener-panels': 'Крепеж біріктірген панельдер',
  'hole-missing': 'Тесік жоқ',
  'hole-extra': 'Артық тесік',
  'hole-diameter': 'Тесік диаметрі',
  'hole-depth': 'Тесік тереңдігі',
  'hole-position': 'Тесіктің орны',
}

const show = (v: unknown): string => (v === undefined ? '—' : typeof v === 'string' ? v : JSON.stringify(v))

export function basisAuditMarkdown(report: BasisAuditReport, limitPerCategory = 15): string {
  const c = report.counts
  const lines: string[] = [
    `# Базис audit есебі — ${report.project}`,
    '',
    `Іске қосылған уақыты: ${report.runAt ?? 'белгісіз'} · шек: ±${report.tolerance} мм`,
    '',
    '## Қорытынды',
    '',
    '| Сәйкес | Айырма | Жоқ | Артық | Жіберілмеген (крепеж таңдалмаған) | Өткізілген (скрипт салмайды) |',
    '|---:|---:|---:|---:|---:|---:|',
    `| ${c.ok} | ${c.mismatch} | ${c.missing} | ${c.extra} | ${c.notSent} | ${c.skipped} |`,
    '',
    report.holesAvailable
      ? `Тесіктер Базистің өзінен оқылды. Орны табылған кеңістік: ${Object.keys(report.holeFrames).length ? Object.entries(report.holeFrames).map(([k, v]) => `${k} (${v})`).join(', ') : 'табылмады (тесікте вектор өрісі жоқ не сәйкес келмеді)'}.`
      : 'Тесіктерді оқу мүмкін болмады — тек панель мен крепеж тексерілді.',
  ]
  if (report.scriptSummary) {
    lines.push('', `Скрипттің өз есебі (айқастыру): ${Object.entries(report.scriptSummary).map(([k, v]) => `${k}=${v}`).join(', ')}`)
  }

  lines.push('', '## Орта', '')
  for (const [k, v] of Object.entries(report.environment)) lines.push(`- \`${k}\`: ${show(v)}`)

  lines.push('', '## Тестер таңдаған крепеж', '', '| Түр | Таңдалды | Базистегі атауы |', '|---|---|---|')
  for (const m of report.mapping) lines.push(`| ${m.kind} | ${m.chosen ? 'иә' : 'жоқ'} | ${m.sampleName ?? '—'} |`)

  const grouped = new Map<AuditCategory, AuditProblem[]>()
  for (const p of report.problems) {
    const list = grouped.get(p.category) ?? []
    list.push(p)
    grouped.set(p.category, list)
  }
  lines.push('', '## Мәселелер түрі бойынша', '')
  if (grouped.size === 0) lines.push('Мәселе жоқ: Базис біз күткенді құрды.')
  for (const [category, list] of grouped) {
    lines.push(`### ${CATEGORY_TITLES[category]} — ${list.length}`, '', `Ықтимал себеп: ${CATEGORY_HINTS[category]}`, '')
    for (const p of list.slice(0, limitPerCategory)) {
      const tail = [
        p.expected !== undefined ? `күтілген ${show(p.expected)}` : '',
        p.actual !== undefined ? `Базисте ${show(p.actual)}` : '',
        p.delta !== undefined ? `Δ ${p.delta} мм` : '',
      ].filter(Boolean).join('; ')
      lines.push(`- ${p.where}${tail ? ` — ${tail}` : ''}${p.hint ? `  \n  ↳ ${p.hint}` : ''}`)
    }
    if (list.length > limitPerCategory) lines.push(`- … тағы ${list.length - limitPerCategory}`)
    lines.push('')
  }
  return lines.join('\n')
}
