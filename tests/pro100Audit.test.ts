import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { defaultShopProfile } from '../src/core/shop'
import { pro100TestKit } from '../src/core/export/pro100Kit'
import type { Pro100Kit } from '../src/core/export/pro100Kit'
import {
  analyzePro100Audit, compareElementValues, comparePro100Parts, parsePro100Audit, partRoles, pro100AuditMarkdown,
} from '../src/core/export/pro100Audit'

const kit = pro100TestKit(defaultShopProfile())

type Mutable = Record<string, unknown> & {
  errors: { step: string; error: string }[]
  items: { id: string; scenario: string; actual: Record<string, unknown> | null }[]
  reports: { scenario: string; parts: Record<string, unknown>[]; elements: { name: string; count: number }[]; materials: unknown[] }[]
}

/** СИНТЕТИКАЛЫҚ audit: PRO100 біз күткенді дәл қайталады деп құрастырылған. */
function cleanAudit(k: Pro100Kit): Mutable {
  return {
    format: 'furniture-configurator.pro100-audit',
    version: 1,
    project: k.project,
    runAt: '2026-09-25T10:00:00+05:00',
    tolerance: k.tolerance,
    environment: { dryRun: false, driver: 'synthetic' },
    items: k.scenarios.flatMap((s) => s.items.map((i) => {
      const requested = { name: i.name, width: i.width, height: i.height, depth: i.depth, ...i.position }
      return {
        id: i.id, scenario: s.id, kind: i.kind, requested, created: true,
        insert: { strategy: 'catalog', libraryPath: `${i.library.search[0]}.meb`, selected: i.name },
        actual: { ...requested },
      }
    })),
    reports: k.scenarios.map((s) => ({
      scenario: s.id,
      source: 'save-all',
      parts: s.expected.parts.map((p) => ({
        name: p.name.toLowerCase(), length: p.finishedLength, width: p.finishedWidth, thickness: p.thickness, count: p.qty, material: '01\\Лдсп',
      })),
      elements: s.expected.elements.map((e) => ({ name: e.name, count: e.qty })),
      materials: [{ name: 'Лдсп', qty: Math.round(s.expected.materials.reduce((a, m) => a + m.areaMm2, 0) / 10_000) / 100, unit: 'm²' }],
      calculation: { rows: [{ label: 'TOTAL', sumWithoutVat: 0, sumWithVat: 0 }], total: 0, discount: null, toPay: null, priceListEmpty: true },
    })),
    comparison: null,
    errors: [],
    stopped: null,
    expected: k,
  }
}

describe('PRO100 audit: қайта салыстыру', () => {
  it('таза audit — айырма жоқ, құн өткізілген (прайс бос)', () => {
    const report = analyzePro100Audit(parsePro100Audit(cleanAudit(kit)))
    expect(report.summary.MISMATCH + report.summary.MISSING + report.summary.EXTRA).toBe(0)
    expect(report.summary.SKIPPED).toBe(4)
    expect(report.problems).toEqual([])
    expect(pro100AuditMarkdown(report)).toContain('Мәселе жоқ')
  })

  it('айырмасы бар audit — түрі бойынша топталып, себебі айтылады', () => {
    const audit = cleanAudit(kit)
    const s1 = audit.reports[0]!
    const side = s1.parts.find((p) => p['name'] === 'боковина')!
    side['length'] = 719.2            // 0.4 + 0.4 кромка шегерілген
    const shelf = s1.parts.find((p) => p['name'] === 'полка')!
    shelf['width'] = 555              // РЕЗ өлшемі — сәйкес, бірақ белгіленеді
    const front = s1.parts.find((p) => p['name'] === 'фасад')!
    front['thickness'] = 19
    s1.parts.push({ name: 'цоколь', length: 568, width: 80, thickness: 16, count: 2, material: '01\\Лдсп' })
    s1.elements = s1.elements.filter((e) => !e.name.startsWith('Петля'))
    audit.items[0]!.actual!['depth'] = 582
    audit.items[1]!.actual!['width'] = 80 // 800 орнына: бірлік см?
    audit.errors.push({ step: 's4-wall-3:insert', error: 'UiError: в библиотеке не найден ни один из: В 2дв 800' })

    const report = analyzePro100Audit(parsePro100Audit(audit))
    const cats = new Map<string, number>()
    for (const p of report.problems) cats.set(p.category, (cats.get(p.category) ?? 0) + 1)
    expect(Object.fromEntries(cats)).toEqual({
      'environment': 1, 'element-size': 2, 'part-size': 1, 'part-thickness': 1, 'part-extra': 1, 'hardware-missing': 1,
    })
    const sizeProblem = report.problems.find((p) => p.category === 'part-size')!
    expect(sizeProblem.delta).toBeCloseTo(-0.8)
    expect(sizeProblem.hint).toContain('кромканы шегерген')
    expect(report.problems.find((p) => p.where.startsWith('s2-wall'))!.hint).toContain('см')
    expect(report.cutBasis).toEqual(['s1-base-600 · деталь · Полка'])

    const md = pro100AuditMarkdown(report)
    expect(md).toContain('### Деталь өлшемі — 1')
    expect(md).toContain('Ықтимал себеп:')
    expect(md).toContain('## PRO100 РЕЗ өлшемін көрсеткен детальдер')
    expect(md).toContain('PRO100-да артық деталь')
  })

  it('Python көпірінің қорытындысымен сәйкес (dry-run фикстурасы)', () => {
    const raw: unknown = JSON.parse(readFileSync(join(__dirname, 'fixtures/pro100/bridge-dryrun-audit.json'), 'utf8'))
    const report = analyzePro100Audit(parsePro100Audit(raw))
    expect(report.bridgeSummary).not.toBeNull()
    expect(report.summaryAgrees).toBe(true)
    expect(report.summary.MISMATCH).toBeGreaterThan(0)
  })

  it('тоқтатылған жүгіріс орта мәселесі ретінде көрінеді', () => {
    const audit = cleanAudit(kit)
    audit['stopped'] = { reason: 'license', window: 'Лицензия', detail: 'Не обнаружен аппаратный ключ защиты.', step: 's2-wall-800:new-project' }
    audit.reports = audit.reports.slice(0, 1)
    const report = analyzePro100Audit(parsePro100Audit(audit))
    expect(report.problems.filter((p) => p.category === 'reports-missing')).toHaveLength(3)
    expect(report.problems[0]!.hint).toContain('лицензия')
    expect(pro100AuditMarkdown(report)).toContain('**Жүгіріс тоқтатылды**')
  })

  it('басқа пішімдегі файл қабылданбайды', () => {
    expect(() => parsePro100Audit({ format: 'furniture-configurator.basis-audit' })).toThrow()
  })
})

describe('comparePro100Parts', () => {
  const part = (name: string, role: 'side' | 'top' | 'bottom', qty: number, fl: number, fw: number) => ({
    name, role, qty, finishedLength: fl, finishedWidth: fw, cutLength: fl, cutWidth: fw - 2,
    thickness: 16, material: 'ЛДСП', edgeAlongLength: 0.8, edgeAlongWidth: 2,
  })

  it('«крышка-дно» ×2 Дно мен Крышканы бірге жабады', () => {
    const res = comparePro100Parts('s', [part('Дно', 'bottom', 1, 568, 557), part('Крышка', 'top', 1, 568, 557)],
      [{ name: 'крышка-дно', length: 568, width: 557, thickness: 16, count: 2, material: 'x' }], 0.5)
    expect(res.map((r) => r.status)).toEqual(['OK', 'OK'])
  })

  it('шек 0.5 мм қоса алғанда', () => {
    const exp = [part('Боковина', 'side', 2, 720, 557)]
    const row = (length: number) => [{ name: 'боковина', length, width: 557, thickness: 16, count: 2, material: 'x' }]
    expect(comparePro100Parts('s', exp, row(720.5), 0.5)[0]!.status).toBe('OK')
    expect(comparePro100Parts('s', exp, row(720.6), 0.5)[0]!.status).toBe('MISMATCH')
  })

  it('шек атауы танылмаған деталь үшін де (тек өлшем бойынша жұптау)', () => {
    const exp = [part('Боковина', 'side', 2, 720, 557)]
    const res = comparePro100Parts('s', exp, [{ name: 'щит', length: 720.5, width: 557, thickness: 16, count: 2, material: 'x' }], 0.5)
    expect(res.map((r) => [r.status, r.field])).toEqual([['MISMATCH', 'name']])
  })

  it('элемент: 0.5 мм — сәйкес, 0.51 — айырма', () => {
    const req = { name: 'S1', width: 600, height: 720, depth: 560, left: 0, bottom: 0, back: 0 }
    expect(compareElementValues('x', req, { ...req, height: 720.5 }, 0.5)[0]!.status).toBe('OK')
    expect(compareElementValues('x', req, { ...req, height: 720.51 }, 0.5)[0]!.status).toBe('MISMATCH')
  })

  it('атау синонимдері', () => {
    expect(partRoles('задняя  стенка')).toEqual(['back'])
    expect(partRoles('Дно ящика')).toEqual(['drawerBottom'])
    expect(partRoles('Передняя стенка ящика')).toEqual(['drawerBack'])
    expect(partRoles('дверь')).toEqual(['front'])
    expect(partRoles('щит')).toEqual([])
  })
})
