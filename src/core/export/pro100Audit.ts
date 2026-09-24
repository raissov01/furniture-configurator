/**
 * PRO100 көпірінен қайтқан AUDIT файлын талдау (біз жақта).
 *
 * Тестер `pro100-bridge.exe audit pro100-test-kit.json` іске қосып,
 * `pro100-audit.json` жібереді. Онда PRO100-дан ШИКІ оқылғаны (Properties
 * мәндері, есептердің жолдары) және `expected` — тест-жинақтың өзі бар.
 * Бұл модуль көпірдің өз салыстыруына СЕНБЕЙДІ: шикі деректен бәрін қайта
 * есептейді (алгоритм `tools/pro100-bridge/pro100_bridge/compare.py`-мен
 * бірдей), көпірдің қорытындысымен айқастырады да, қазақша есеп жазады —
 * мәселе түрі бойынша топталған, ықтимал себебімен.
 *
 * Таза TS (§3): файл оқу/жазу `src/cli/pro100Audit.ts`-те.
 */
import { z } from 'zod'
import type { PanelRole } from '../types'
import type { Pro100ExpectedCosts, Pro100ExpectedElement, Pro100ExpectedMaterial, Pro100ExpectedPart } from './pro100Kit'

export const PRO100_AUDIT_FORMAT = 'furniture-configurator.pro100-audit'

// ── Файлдың пішіні ───────────────────────────────────────────────────────────

const num = z.number()
const PartRowSchema = z.object({
  name: z.string(), length: num, width: num, thickness: num, count: num, material: z.string(),
}).loose()
const CalcRowSchema = z.object({
  label: z.string(), sumWithoutVat: num.nullable(), sumWithVat: num.nullable(),
}).loose()
const CalculationSchema = z.object({
  rows: z.array(CalcRowSchema),
  total: num.nullable(), discount: num.nullable(), toPay: num.nullable(), priceListEmpty: z.boolean(),
}).loose()

const ElementValuesSchema = z.object({
  name: z.string().nullable().optional(),
  width: z.union([num, z.string()]).nullable().optional(),
  height: z.union([num, z.string()]).nullable().optional(),
  depth: z.union([num, z.string()]).nullable().optional(),
  left: z.union([num, z.string()]).nullable().optional(),
  bottom: z.union([num, z.string()]).nullable().optional(),
  back: z.union([num, z.string()]).nullable().optional(),
  locks: z.array(z.boolean()).optional(),
}).loose()

const ItemSchema = z.object({
  id: z.string(),
  scenario: z.string(),
  requested: z.object({ name: z.string(), width: num, height: num, depth: num, left: num, bottom: num, back: num }),
  created: z.boolean(),
  insert: z.object({ strategy: z.string(), libraryPath: z.string().nullable(), selected: z.string().nullable() }).loose().nullable(),
  actual: ElementValuesSchema.nullable(),
}).loose()

const ReportSchema = z.object({
  scenario: z.string(),
  source: z.string(),
  parts: z.array(PartRowSchema),
  elements: z.array(z.object({ name: z.string(), count: num }).loose()),
  materials: z.array(z.object({ name: z.string(), qty: num, unit: z.string() }).loose()),
  calculation: CalculationSchema.nullable(),
}).loose()

const ResultSchema = z.object({ status: z.string() }).loose()

const ExpectedScenarioSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  items: z.array(z.object({ id: z.string() }).loose()),
  expected: z.object({
    parts: z.array(z.object({
      name: z.string(), role: z.string(), qty: num, finishedLength: num, finishedWidth: num,
      cutLength: num, cutWidth: num, thickness: num, material: z.string(),
      edgeAlongLength: num.optional(), edgeAlongWidth: num.optional(),
    }).loose()),
    elements: z.array(z.object({ name: z.string(), kind: z.string(), qty: num }).loose()),
    materials: z.array(z.object({ name: z.string(), thickness: num, areaMm2: num }).loose()),
    costs: z.object({ total: num, missingPrices: z.array(z.string()).optional() }).loose(),
  }).loose(),
}).loose()

export const Pro100AuditFileSchema = z.object({
  format: z.literal(PRO100_AUDIT_FORMAT),
  version: z.literal(1),
  project: z.string(),
  runAt: z.string().optional(),
  tolerance: num,
  environment: z.record(z.string(), z.unknown()).optional(),
  items: z.array(ItemSchema),
  reports: z.array(ReportSchema),
  comparison: z.object({
    summary: z.record(z.string(), num),
    results: z.array(ResultSchema).optional(),
  }).loose().nullable().optional(),
  errors: z.array(z.object({ step: z.string(), error: z.string() })),
  stopped: z.object({
    reason: z.string(), window: z.string().nullable().optional(),
    detail: z.string().nullable().optional(), step: z.string().optional(),
  }).loose().nullable(),
  notes: z.array(z.string()).optional(),
  shots: z.array(z.string()).optional(),
  expected: z.object({
    format: z.literal('furniture-configurator.pro100-kit'),
    scenarios: z.array(ExpectedScenarioSchema),
  }).loose(),
}).loose()

export type Pro100AuditFile = z.infer<typeof Pro100AuditFileSchema>

export function parsePro100Audit(raw: unknown): Pro100AuditFile {
  return Pro100AuditFileSchema.parse(raw)
}

// ── Атау синонимдері (Python `names.py`-мен БІРДЕЙ) ─────────────────────────

/** Ұзыны бірінші: «дно ящика» «дно»-дан бұрын. */
export const PART_SYNONYMS: [string, PanelRole[]][] = [
  ['крышка-дно', ['top', 'bottom']],
  ['дно ящика', ['drawerBottom']],
  ['задняя ящика', ['drawerBack']],
  ['задняя стенка ящика', ['drawerBack']],
  ['передняя стенка ящика', ['drawerBack']],
  ['боковина ящика', ['drawerSide']],
  ['фасад ящика', ['front']],
  ['задняя стенка', ['back']],
  ['стенка задняя', ['back']],
  ['задняя', ['back']],
  ['двп', ['back']],
  ['хдф', ['back']],
  ['боковина', ['side']],
  ['бок', ['side']],
  ['крышка', ['top']],
  ['дно', ['bottom']],
  ['полка', ['shelf']],
  ['перегородка', ['divider']],
  ['стойка', ['divider']],
  ['дверь', ['front']],
  ['дверка', ['front']],
  ['фасад', ['front']],
  ['цоколь', ['plinth']],
  ['планка', ['rail']],
  ['царга', ['rail']],
  ['ящик', ['drawerSide', 'drawerBack']],
]

/** Аксессуарлар бірінші: заглушка — конфирмат емес, ответная планка — петля емес. */
export const HARDWARE_SYNONYMS: [string, string][] = [
  ['заглушк', 'cap'],
  ['ответн', 'hingePlate'],
  ['полкодерж', 'shelfPin'],
  ['петл', 'hinge'],
  ['направляющ', 'runner'],
  ['ручк', 'handle'],
  ['ножк', 'leg'],
  ['опор', 'leg'],
  ['конфирмат', 'confirmat'],
  ['евровинт', 'confirmat'],
  ['минификс', 'minifix'],
  ['эксцентрик', 'minifix'],
  ['стяжк', 'minifix'],
  ['шкант', 'dowel'],
]

export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()
}

export function partRoles(name: string): PanelRole[] {
  const n = normalizeName(name)
  return PART_SYNONYMS.find(([syn]) => n.includes(syn))?.[1] ?? []
}

export function hardwareKind(name: string): string | null {
  const n = normalizeName(name)
  return HARDWARE_SYNONYMS.find(([syn]) => n.includes(syn))?.[1] ?? null
}

// ── Салыстыру ────────────────────────────────────────────────────────────────

export type Pro100Status = 'OK' | 'MISMATCH' | 'MISSING' | 'EXTRA' | 'SKIPPED'
export const PRO100_STATUSES: Pro100Status[] = ['OK', 'MISMATCH', 'MISSING', 'EXTRA', 'SKIPPED']

type PartRow = z.infer<typeof PartRowSchema>

export type Pro100Result = {
  section: 'element' | 'parts' | 'hardware' | 'materials' | 'costs' | 'reports'
  status: Pro100Status
  where: string
  field?: string | undefined
  expected?: unknown
  actual?: unknown
  delta?: number | undefined
  basis?: 'finished' | 'cut' | 'mixed' | undefined
  pro100Name?: string | undefined
  hint?: string | undefined
  /** Себеп іздеуге: қай күтілген деталь (тек parts) */
  part?: Pro100ExpectedPart | undefined
}

const ELEMENT_FIELDS = ['width', 'height', 'depth', 'left', 'bottom', 'back'] as const
const r3 = (v: number): number => Math.round(v * 1000) / 1000

export function compareElementValues(
  itemId: string,
  requested: z.infer<typeof ItemSchema>['requested'],
  actual: z.infer<typeof ElementValuesSchema> | null,
  tol: number,
): Pro100Result[] {
  const where = `${itemId} · элемент`
  if (!actual) return [{ section: 'element', status: 'MISSING', where, expected: requested }]
  const out: Pro100Result[] = []
  if (typeof actual.name === 'string' && normalizeName(actual.name) !== normalizeName(requested.name)) {
    out.push({ section: 'element', status: 'MISMATCH', where, field: 'name', expected: requested.name, actual: actual.name })
  }
  for (const f of ELEMENT_FIELDS) {
    const want = requested[f]
    const got = actual[f]
    if (typeof got !== 'number') {
      out.push({ section: 'element', status: 'MISMATCH', where, field: f, expected: want, actual: got ?? null, hint: 'мәні оқылмады' })
      continue
    }
    const delta = got - want
    if (Math.abs(delta) > tol) {
      const tenfold = want !== 0 && Math.abs(got * 10 - want) <= tol * 10
      out.push({
        section: 'element', status: 'MISMATCH', where, field: f, expected: want, actual: r3(got), delta: r3(delta),
        hint: tenfold ? 'мән 10 есе аз: PRO100-да бірлік см болуы мүмкін (Tools → Preferences → Units)' : undefined,
      })
    }
  }
  if (out.length === 0) out.push({ section: 'element', status: 'OK', where })
  return out
}

type Exp = { row: Pro100ExpectedPart; finished: [number, number]; cut: [number, number]; remaining: number; links: { a: Act; n: number; kind: 'finished' | 'cut' | 'name' | 'size' }[] }
type Act = { row: PartRow; roles: PanelRole[]; dims: [number, number]; remaining: number }

const pair = (a: number, b: number): [number, number] => (a >= b ? [a, b] : [b, a])
const close = (a: [number, number], b: [number, number], tol: number): boolean =>
  Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol

/**
 * Деталь тізімі. Өлшем бағдарсыз, сан «бюджетпен» (бір PRO100 жолы бірнеше
 * біздің жолды жабуы мүмкін және керісінше). Өту реті: рөл+готовый →
 * рөл+рез → тек өлшем (атауы басқа) → тек рөл, ең жақын өлшем.
 */
export function comparePro100Parts(scenario: string, expected: Pro100ExpectedPart[], actual: PartRow[], tol: number): Pro100Result[] {
  const exps: Exp[] = expected.map((row) => ({
    row, finished: pair(row.finishedLength, row.finishedWidth), cut: pair(row.cutLength, row.cutWidth), remaining: row.qty, links: [],
  }))
  const acts: Act[] = actual.map((row) => ({ row, roles: partRoles(row.name), dims: pair(row.length, row.width), remaining: row.count }))
  const roleOk = (e: Exp, a: Act): boolean => a.roles.includes(e.row.role)
  const thickOk = (e: Exp, a: Act): boolean => Math.abs(a.row.thickness - e.row.thickness) <= tol
  const pass = (pred: (e: Exp, a: Act) => boolean, kind: Exp['links'][number]['kind'], closest = false): void => {
    for (const e of exps) {
      while (e.remaining > 0) {
        const cands = acts.filter((a) => a.remaining > 0 && pred(e, a))
        if (cands.length === 0) break
        if (closest) {
          const cost = (a: Act): number => Math.abs(a.dims[0] - e.finished[0]) + Math.abs(a.dims[1] - e.finished[1]) + Math.abs(a.row.thickness - e.row.thickness)
          cands.sort((x, y) => cost(x) - cost(y))
        }
        const a = cands[0]!
        const n = Math.min(e.remaining, a.remaining)
        e.remaining -= n
        a.remaining -= n
        e.links.push({ a, n, kind })
      }
    }
  }
  pass((e, a) => roleOk(e, a) && thickOk(e, a) && close(a.dims, e.finished, tol), 'finished')
  pass((e, a) => roleOk(e, a) && thickOk(e, a) && close(a.dims, e.cut, tol), 'cut')
  pass((e, a) => thickOk(e, a) && (close(a.dims, e.finished, tol) || close(a.dims, e.cut, tol)), 'name')
  pass(roleOk, 'size', true)

  const out: Pro100Result[] = []
  for (const e of exps) {
    const where = `${scenario} · деталь · ${e.row.name}`
    if (e.links.length === 0) {
      out.push({
        section: 'parts', status: 'MISSING', where, part: e.row,
        expected: { name: e.row.name, qty: e.row.qty, finished: e.finished, cut: e.cut, thickness: e.row.thickness },
      })
      continue
    }
    const problems: Pro100Result[] = []
    for (const { a, kind } of e.links) {
      if (kind === 'name') {
        problems.push({ section: 'parts', status: 'MISMATCH', where, field: 'name', expected: e.row.name, actual: a.row.name, part: e.row })
      } else if (kind === 'size') {
        const fields: [string, number, number][] = [
          ['length', e.finished[0], a.dims[0]], ['width', e.finished[1], a.dims[1]], ['thickness', e.row.thickness, a.row.thickness],
        ]
        for (const [f, want, got] of fields) {
          if (Math.abs(got - want) > tol) {
            problems.push({ section: 'parts', status: 'MISMATCH', where, field: f, expected: r3(want), actual: r3(got), delta: r3(got - want), pro100Name: a.row.name, part: e.row })
          }
        }
      }
    }
    if (e.remaining > 0) {
      const matched = e.row.qty - e.remaining
      problems.push({ section: 'parts', status: 'MISMATCH', where, field: 'qty', expected: e.row.qty, actual: matched, delta: matched - e.row.qty, part: e.row })
    }
    if (problems.length > 0) out.push(...problems)
    else {
      const kinds = new Set(e.links.map((l) => l.kind))
      const basis = kinds.size === 1 && kinds.has('cut') ? 'cut' : kinds.has('cut') ? 'mixed' : 'finished'
      out.push({ section: 'parts', status: 'OK', where, basis, part: e.row })
    }
  }
  for (const a of acts) {
    if (a.remaining > 0) {
      out.push({
        section: 'parts', status: 'EXTRA', where: `${scenario} · деталь · ${a.row.name}`,
        actual: { name: a.row.name, length: a.row.length, width: a.row.width, thickness: a.row.thickness, count: a.remaining, material: a.row.material },
      })
    }
  }
  return out
}

/** `kind` — біздің `HardwareKind`; файлдан оқылғанда кез келген жол болуы мүмкін. */
export function compareHardware(scenario: string, expected: (Pick<Pro100ExpectedElement, 'name' | 'qty'> & { kind: string })[], actual: { name: string; count: number }[]): Pro100Result[] {
  const want = new Map<string, { name: string; qty: number }>()
  for (const e of expected) {
    const kind = hardwareKind(e.name) ?? e.kind
    const cur = want.get(kind) ?? { name: e.name, qty: 0 }
    want.set(kind, { name: cur.name, qty: cur.qty + e.qty })
  }
  const got = new Map<string, { name: string; qty: number }>()
  const unknown: { name: string; count: number }[] = []
  for (const a of actual) {
    const kind = hardwareKind(a.name)
    if (!kind) { unknown.push(a); continue }
    const cur = got.get(kind) ?? { name: a.name, qty: 0 }
    got.set(kind, { name: cur.name, qty: cur.qty + a.count })
  }
  const out: Pro100Result[] = []
  for (const [kind, w] of want) {
    const where = `${scenario} · фурнитура · ${w.name}`
    const g = got.get(kind)
    if (!g) out.push({ section: 'hardware', status: 'MISSING', where, field: kind, expected: r3(w.qty) })
    else if (Math.abs(g.qty - w.qty) > 1e-9) {
      out.push({ section: 'hardware', status: 'MISMATCH', where, field: kind, expected: r3(w.qty), actual: r3(g.qty), delta: r3(g.qty - w.qty), pro100Name: g.name })
    } else out.push({ section: 'hardware', status: 'OK', where, field: kind })
  }
  for (const [kind, g] of got) {
    if (!want.has(kind)) out.push({ section: 'hardware', status: 'EXTRA', where: `${scenario} · фурнитура · ${g.name}`, field: kind, actual: r3(g.qty) })
  }
  for (const a of unknown) {
    out.push({ section: 'hardware', status: 'EXTRA', where: `${scenario} · фурнитура · ${a.name}`, actual: a.count, hint: 'түрі атауынан танылмады' })
  }
  return out
}

const AREA_UNITS = new Set(['m²', 'м²', 'm2', 'м2', 'кв.м', 'кв. м', 'sq m'])

export function compareMaterials(scenario: string, expected: Pick<Pro100ExpectedMaterial, 'areaMm2'>[], actual: { name: string; qty: number; unit: string }[]): Pro100Result[] {
  const want = expected.reduce((s, e) => s + e.areaMm2, 0) / 1_000_000
  const rows = actual.filter((a) => AREA_UNITS.has(a.unit.trim().toLowerCase()))
  const where = `${scenario} · материалы · общая площадь, м²`
  if (rows.length === 0) return [{ section: 'materials', status: 'MISSING', where, expected: r3(want) }]
  const got = rows.reduce((s, a) => s + a.qty, 0)
  // PRO100 әр жолды 0.01 м²-ге дөңгелектейді.
  const tol = 0.01 * Math.max(1, rows.length) + 0.005
  const delta = got - want
  const ok = Math.abs(delta) <= tol
  return [{
    section: 'materials', status: ok ? 'OK' : 'MISMATCH', where, field: 'areaM2',
    expected: r3(want), actual: r3(got), delta: ok ? undefined : r3(delta),
  }]
}

export function compareCosts(scenario: string, expected: Pick<Pro100ExpectedCosts, 'total'>, calc: z.infer<typeof CalculationSchema> | null): Pro100Result[] {
  const where = `${scenario} · стоимость · итог`
  const want = expected.total / 100
  if (!calc) return [{ section: 'costs', status: 'MISSING', where, expected: want }]
  if (calc.priceListEmpty) return [{ section: 'costs', status: 'SKIPPED', where, expected: want, hint: 'PRO100 прайс-листі бос — сомалар нөл' }]
  const got = calc.toPay ?? calc.total
  if (got === null) return [{ section: 'costs', status: 'MISSING', where, expected: want, hint: 'ИТОГО/К ОПЛАТЕ жолы табылмады' }]
  const delta = got - want
  const ok = Math.abs(delta) <= 1
  return [{ section: 'costs', status: ok ? 'OK' : 'MISMATCH', where, field: 'total', expected: want, actual: got, delta: ok ? undefined : Math.round(delta * 100) / 100 }]
}

export function summarizePro100(results: Pro100Result[]): Record<Pro100Status, number> {
  const s: Record<Pro100Status, number> = { OK: 0, MISMATCH: 0, MISSING: 0, EXTRA: 0, SKIPPED: 0 }
  for (const r of results) s[r.status] += 1
  return s
}

/** Шикі деректен толық қайта салыстыру (көпірдің қорытындысына сенбейміз). */
export function recomparePro100Audit(audit: Pro100AuditFile): Pro100Result[] {
  const tol = audit.tolerance
  const results: Pro100Result[] = []
  const reports = new Map(audit.reports.map((r) => [r.scenario, r]))
  for (const sc of audit.expected.scenarios) {
    for (const it of audit.items.filter((i) => i.scenario === sc.id)) {
      results.push(...compareElementValues(it.id, it.requested, it.actual, tol))
    }
    const rep = reports.get(sc.id)
    if (!rep) { results.push({ section: 'reports', status: 'MISSING', where: `${sc.id} · отчёты` }); continue }
    const exp = sc.expected
    const parts = exp.parts.map((p) => ({ ...p, role: p.role as PanelRole, edgeAlongLength: p.edgeAlongLength ?? 0, edgeAlongWidth: p.edgeAlongWidth ?? 0 }))
    results.push(...comparePro100Parts(sc.id, parts, rep.parts, tol))
    results.push(...compareHardware(sc.id, exp.elements, rep.elements))
    results.push(...compareMaterials(sc.id, exp.materials, rep.materials))
    results.push(...compareCosts(sc.id, exp.costs, rep.calculation))
  }
  return results
}

// ── Себептер ────────────────────────────────────────────────────────────────

export type Pro100Category =
  | 'environment' | 'reports-missing'
  | 'element-missing' | 'element-size' | 'element-position' | 'element-name'
  | 'part-missing' | 'part-extra' | 'part-size' | 'part-thickness' | 'part-qty' | 'part-name'
  | 'hardware-missing' | 'hardware-extra' | 'hardware-qty'
  | 'materials-area' | 'cost'

export type Pro100Problem = {
  category: Pro100Category
  where: string
  expected?: unknown
  actual?: unknown
  delta?: number | undefined
  hint?: string | undefined
}

export const PRO100_CATEGORY_TITLES: Record<Pro100Category, string> = {
  'environment': 'Орта, көпір қадамының қателері',
  'reports-missing': 'Есептер оқылмады',
  'element-missing': 'Элемент қойылмады не оқылмады',
  'element-size': 'Элемент өлшемі (Properties → Dimensions)',
  'element-position': 'Элемент орны (Properties → Position)',
  'element-name': 'Элемент аты',
  'part-missing': 'Деталь PRO100-да жоқ',
  'part-extra': 'PRO100-да артық деталь',
  'part-size': 'Деталь өлшемі',
  'part-thickness': 'Деталь қалыңдығы',
  'part-qty': 'Деталь саны',
  'part-name': 'Деталь атауы',
  'hardware-missing': 'Фурнитура PRO100-да жоқ',
  'hardware-extra': 'PRO100-да артық фурнитура',
  'hardware-qty': 'Фурнитура саны',
  'materials-area': 'Материал ауданы',
  'cost': 'Құн',
}

export const PRO100_CATEGORY_HINTS: Record<Pro100Category, string> = {
  'environment': 'Көпір PRO100 терезесін/батырмасын таба алмады не лицензия терезесі шықты — `errors`, `stopped` және `shots/` скриншоттарын қараңыз; `ui_pro100.py` тұрақтысын түзету керек болуы мүмкін.',
  'reports-missing': 'Сценарий есебіне жетпей тоқтады (StopRun не қате): алдыңғы қадамдарды қараңыз.',
  'element-missing': 'Кітапханадан АТЫ бойынша табылмады не қою тәсілі (Insert from Catalog / Catalog терезесі) жұмыс істемеді.',
  'element-size': 'Properties-ке жазылған өлшем сақталмады: өлшем құлыпталған (Lock белгісі), «Aspect ratio» қосулы, не бірлік мм емес.',
  'element-position': 'Орын өзгеше: PRO100 элементті қабырғаға/еденге «тартып» қойды (привязка) не Back өрісінің мағынасы басқа.',
  'element-name': 'Name өрісі сақталмады не PRO100 атауды басқаша көрсетеді — өндіріске әсері жоқ.',
  'part-missing': 'PRO100 кітапхана корпусында бұл деталь жоқ, не басқа атпен/өлшеммен біріктірілген (мысалы «крышка-дно»).',
  'part-extra': 'PRO100 кітапхана элементінің құрамында біздің модельде жоқ деталь бар (цоколь, столешница, стеновая панель) — конструкция айырмасы.',
  'part-size': 'Өлшем айырмасы: РЕЗ пен ГОТОВЫЙ шатасуы, кромка шегерімі (PRO100 Reports → Edges 0.4 мм-ді де шегереді, біз ≥1 мм ғана — §4.3), не конструкция (фасад тереңдікке кіреді, бүйір/қақпақ басқаша жабылады).',
  'part-thickness': 'Материал қалыңдығы басқа: PRO100 кітапханасында фасад МДФ 19 мм, бізде ЛДСП 16 мм т.б.',
  'part-qty': 'Сан айырмасы: PRO100 бірдей детальдерді басқаша топтайды не корпуста сөре/есік саны басқа.',
  'part-name': 'Атау айырмасы: өлшемі сәйкес, атауы басқа (кітапхана авторы өз атауын жазады) — өндіріске әсері жоқ.',
  'hardware-missing': 'PRO100 «Список элементов» тек кітапхана элементіне салынған фурнитураны көрсетеді; бізде ол присадкадан саналады.',
  'hardware-extra': 'PRO100 элементінде бізде жоқ фурнитура (мысалы цоколь аяғы) — конструкция айырмасы.',
  'hardware-qty': 'Фурнитура саны басқа: есік/сөре саны не петля саны ережесі өзгеше.',
  'materials-area': 'Аудан айырмасы: PRO100 цоколь/столешница/кромканы қосады, не материалды басқаша топтайды.',
  'cost': 'PRO100 прайс-листі мен біздің цех бағасы синхрондалмаған — құн тек бағалар бір болса салыстырылады.',
}

function categoryOf(r: Pro100Result): Pro100Category {
  switch (r.section) {
    case 'reports': return 'reports-missing'
    case 'element':
      if (r.status === 'MISSING') return 'element-missing'
      if (r.field === 'name') return 'element-name'
      return r.field === 'left' || r.field === 'bottom' || r.field === 'back' ? 'element-position' : 'element-size'
    case 'parts':
      if (r.status === 'MISSING') return 'part-missing'
      if (r.status === 'EXTRA') return 'part-extra'
      if (r.field === 'thickness') return 'part-thickness'
      if (r.field === 'qty') return 'part-qty'
      if (r.field === 'name') return 'part-name'
      return 'part-size'
    case 'hardware':
      return r.status === 'MISSING' ? 'hardware-missing' : r.status === 'EXTRA' ? 'hardware-extra' : 'hardware-qty'
    case 'materials': return 'materials-area'
    case 'costs': return 'cost'
  }
}

/** Өлшем айырмасын сценарийдің белгілі қалыңдықтарымен түсіндіру. */
function sizeHint(r: Pro100Result, parts: Pro100ExpectedPart[], tol: number): string | undefined {
  if (r.delta === undefined || !r.part) return undefined
  const p = r.part
  const d = Math.abs(r.delta)
  const lengthIsLong = p.finishedLength >= p.finishedWidth
  const along = r.field === 'length' ? (lengthIsLong ? p.edgeAlongLength : p.edgeAlongWidth) : (lengthIsLong ? p.edgeAlongWidth : p.edgeAlongLength)
  const t = parts.find((x) => x.role === 'side')?.thickness
  const front = parts.find((x) => x.role === 'front')?.thickness
  const back = parts.find((x) => x.role === 'back')?.thickness
  const candidates: [string, number | undefined][] = [
    [`кромка осы бағытта (${along} мм, 0.4-ті қоса)`, along > 0 ? along : undefined],
    [`корпус қалыңдығы (${t} мм)`, t],
    [`екі корпус қалыңдығы (${t === undefined ? '?' : 2 * t} мм)`, t === undefined ? undefined : 2 * t],
    [`фасад қалыңдығы (${front} мм)`, front],
    [`арт қабырға (${back} мм)`, back],
  ]
  const hits = candidates.filter(([, v]) => v !== undefined && Math.abs(d - v) <= tol).map(([label]) => label)
  if (r.delta < 0 && along > 0 && Math.abs(d - along) <= tol) {
    return `PRO100 кромканы шегерген өлшем көрсетті: |Δ| = ${hits.join(' / ')}. Біз 1 мм-ден жұқа кромканы шегермейміз (§4.3).`
  }
  return hits.length > 0 ? `|Δ| ${d} мм = ${hits.join(' / ')} — конструкция айырмасы болуы ықтимал.` : undefined
}

export type Pro100AuditReport = {
  project: string
  runAt: string | null
  tolerance: number
  summary: Record<Pro100Status, number>
  /** Көпірдің өз қорытындысы (айқастыру үшін) */
  bridgeSummary: Record<string, number> | null
  summaryAgrees: boolean | null
  problems: Pro100Problem[]
  /** PRO100 РЕЗ өлшемін көрсеткен (бірақ сәйкес) детальдер */
  cutBasis: string[]
  stopped: Pro100AuditFile['stopped']
  environment: Record<string, unknown>
  notes: string[]
  items: { id: string; created: boolean; strategy: string | null; libraryPath: string | null; requested: string; actual: string }[]
  materialNames: { scenario: string; ours: string[]; pro100: string[] }[]
}

const hwd = (h: unknown, w: unknown, d: unknown): string => `${String(h ?? '?')} (H) × ${String(w ?? '?')} (W) × ${String(d ?? '?')} (D)`

export function analyzePro100Audit(audit: Pro100AuditFile): Pro100AuditReport {
  const results = recomparePro100Audit(audit)
  const summary = summarizePro100(results)
  const bridge = audit.comparison?.summary ?? null
  const agrees = bridge ? PRO100_STATUSES.every((s) => (bridge[s] ?? 0) === summary[s]) : null
  const partsByScenario = new Map(audit.expected.scenarios.map((s) => [s.id, s.expected.parts as Pro100ExpectedPart[]]))

  const problems: Pro100Problem[] = []
  for (const e of audit.errors) problems.push({ category: 'environment', where: e.step, actual: e.error })
  if (audit.stopped) {
    problems.push({
      category: 'environment', where: `тоқтады: ${audit.stopped.step ?? '?'}`,
      actual: [audit.stopped.reason, audit.stopped.window, audit.stopped.detail].filter(Boolean).join(' · '),
      hint: audit.stopped.reason === 'license' ? 'PRO100 лицензия/активация терезесін көрсетті — көпір ештеңе баспады; тестер PRO100-ды өзі іске қосып тексерсін.' : undefined,
    })
  }
  const cutBasis: string[] = []
  for (const r of results) {
    if (r.status === 'OK') { if (r.basis === 'cut' || r.basis === 'mixed') cutBasis.push(r.where); continue }
    if (r.status === 'SKIPPED') continue
    const category = categoryOf(r)
    const scenario = r.where.split(' · ')[0] ?? ''
    let hint = r.hint
    if (category === 'part-size') hint = sizeHint(r, partsByScenario.get(scenario) ?? [], audit.tolerance) ?? hint
    if (category === 'part-name' || (category === 'part-size' && r.pro100Name)) {
      hint = [hint, r.pro100Name ? `PRO100-дағы атауы: «${r.pro100Name}»` : undefined].filter(Boolean).join(' ')
    }
    problems.push({ category, where: r.where + (r.field && category !== 'part-name' ? ` · ${r.field}` : ''), expected: r.expected, actual: r.actual, delta: r.delta, hint: hint || undefined })
  }

  const reports = new Map(audit.reports.map((r) => [r.scenario, r]))
  return {
    project: audit.project,
    runAt: audit.runAt ?? null,
    tolerance: audit.tolerance,
    summary,
    bridgeSummary: bridge,
    summaryAgrees: agrees,
    problems,
    cutBasis,
    stopped: audit.stopped,
    environment: audit.environment ?? {},
    notes: audit.notes ?? [],
    items: audit.items.map((i) => ({
      id: i.id,
      created: i.created,
      strategy: i.insert?.strategy ?? null,
      libraryPath: i.insert?.libraryPath ?? null,
      requested: hwd(i.requested.height, i.requested.width, i.requested.depth),
      actual: i.actual ? hwd(i.actual.height, i.actual.width, i.actual.depth) : '—',
    })),
    materialNames: audit.expected.scenarios.map((s) => ({
      scenario: s.id,
      ours: s.expected.materials.map((m) => m.name),
      pro100: (reports.get(s.id)?.materials ?? []).map((m) => `${m.name} (${m.qty} ${m.unit})`),
    })),
  }
}

// ── Қазақша Markdown ─────────────────────────────────────────────────────────

const show = (v: unknown): string => (v === undefined || v === null ? '—' : typeof v === 'string' ? v : JSON.stringify(v))

export function pro100AuditMarkdown(report: Pro100AuditReport, limitPerCategory = 15): string {
  const s = report.summary
  const lines: string[] = [
    `# PRO100 audit есебі — ${report.project}`,
    '',
    `Іске қосылған уақыты: ${report.runAt ?? 'белгісіз'} · шек: ±${report.tolerance} мм`
      + (report.environment['dryRun'] === true ? ' · **ПРОБНЫЙ ПРОГОН (PRO100-сіз)**' : ''),
    '',
    '## Қорытынды',
    '',
    '| Сәйкес | Айырма | PRO100-да жоқ | PRO100-да артық | Өткізілген |',
    '|---:|---:|---:|---:|---:|',
    `| ${s.OK} | ${s.MISMATCH} | ${s.MISSING} | ${s.EXTRA} | ${s.SKIPPED} |`,
    '',
    report.summaryAgrees === null
      ? 'Көпірдің өз қорытындысы файлда жоқ.'
      : report.summaryAgrees
        ? 'Көпірдің өз қорытындысы біздің қайта есебімізбен сәйкес.'
        : `⚠ Көпірдің қорытындысы (${Object.entries(report.bridgeSummary ?? {}).map(([k, v]) => `${k}=${v}`).join(', ')}) біздің қайта есебімізден өзгеше — көпір мен TS салыстыруының нұсқасы әртүрлі болуы мүмкін.`,
  ]
  if (report.stopped) {
    lines.push('', `**Жүгіріс тоқтатылды** (${report.stopped.step ?? '?'}): ${report.stopped.reason}${report.stopped.window ? ` — «${report.stopped.window}»` : ''}.`)
  }

  lines.push('', '## Элементтер', '', '| Элемент | Қойылды | Тәсіл | Кітапханадағы жолы | Сұралған | PRO100-да |', '|---|---|---|---|---|---|')
  for (const i of report.items) {
    lines.push(`| ${i.id} | ${i.created ? 'иә' : 'жоқ'} | ${i.strategy ?? '—'} | ${i.libraryPath ?? '—'} | ${i.requested} | ${i.actual} |`)
  }

  const grouped = new Map<Pro100Category, Pro100Problem[]>()
  for (const p of report.problems) grouped.set(p.category, [...(grouped.get(p.category) ?? []), p])
  lines.push('', '## Мәселелер түрі бойынша', '')
  if (grouped.size === 0) lines.push('Мәселе жоқ: PRO100 біз күткенді берді.')
  for (const [category, list] of grouped) {
    lines.push(`### ${PRO100_CATEGORY_TITLES[category]} — ${list.length}`, '', `Ықтимал себеп: ${PRO100_CATEGORY_HINTS[category]}`, '')
    for (const p of list.slice(0, limitPerCategory)) {
      const tail = [
        p.expected !== undefined ? `күтілген ${show(p.expected)}` : '',
        p.actual !== undefined ? `PRO100-да ${show(p.actual)}` : '',
        p.delta !== undefined ? `Δ ${p.delta}` : '',
      ].filter(Boolean).join('; ')
      lines.push(`- ${p.where}${tail ? ` — ${tail}` : ''}${p.hint ? `  \n  ↳ ${p.hint}` : ''}`)
    }
    if (list.length > limitPerCategory) lines.push(`- … тағы ${list.length - limitPerCategory}`)
    lines.push('')
  }

  if (report.cutBasis.length > 0) {
    lines.push('## PRO100 РЕЗ өлшемін көрсеткен детальдер', '', 'Бұлар сәйкес деп саналды, бірақ PRO100 кромка шегерілген (РЕЗ) өлшемді берді — есептерді салыстырғанда ГОТОВЫЙ пен РЕЗ шатаспасын:', '')
    for (const w of report.cutBasis) lines.push(`- ${w}`)
    lines.push('')
  }

  lines.push('## Материал атаулары қатар', '', 'Атаулар әр цехта әртүрлі, сондықтан тек жалпы аудан салыстырылады; сәйкестендіруді адам жасайды.', '')
  for (const m of report.materialNames) {
    lines.push(`- **${m.scenario}** — бізде: ${m.ours.join('; ') || '—'}; PRO100-да: ${m.pro100.join('; ') || '—'}`)
  }
  if (report.notes.length > 0) {
    lines.push('', '## Көпірдің ескертпелері', '')
    for (const n of report.notes) lines.push(`- ${n}`)
  }
  lines.push('', '## Орта', '')
  for (const [k, v] of Object.entries(report.environment)) lines.push(`- \`${k}\`: ${show(v)}`)
  return `${lines.join('\n')}\n`
}
