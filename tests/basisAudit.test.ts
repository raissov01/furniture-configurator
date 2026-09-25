/**
 * Базистен қайтқан audit файлын салыстырушы (`src/core/export/basisAudit.ts`).
 *
 * Audit JSON-ды ойдан жазбаймыз: оны скрипттің ӨЗІ жалған Базисте
 * (`tests/fakeBazis.ts`) жазады. Таза нұсқада мәселе жоқ; содан кейін JSON-ға
 * әдейі айырма енгізіп, салыстырушы әр түрін тауып, себебін айта ма — соны
 * тексереміз.
 */
import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInFakeBazis } from './fakeBazis'
import {
  IDENTITY_TRANSFORM, SEED_CATALOG, SEED_TEMPLATES,
  analyzeBasisAudit, basisAuditMarkdown, exportBasisScript, flattenTree, parseBasisAudit, templateToCabinet,
} from '../src/core/index'
import type { AuditCategory, BasisScriptData, GroupNode } from '../src/core/index'

const template = SEED_TEMPLATES.find((t) => t.id === 'wardrobe-penal-600')!
const root: GroupNode = {
  id: 'root', name: 'root', kind: 'group', transform: IDENTITY_TRANSFORM,
  children: [{
    id: 'cab', name: 'Пенал', kind: 'cabinet',
    transform: { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
    config: templateToCabinet(template, SEED_CATALOG),
  }],
}
const script = exportBasisScript(flattenTree(root, SEED_CATALOG), SEED_CATALOG, undefined, { projectName: 'Пенал' })
const KINDS = ['confirmat', 'minifix', 'dowel', 'hinge', 'shelfPin', 'handle', 'runner', 'leg', 'facadeScrew']
const allKinds = Object.fromEntries(KINDS.map((k) => [k, true]))

type Json = Record<string, unknown> & {
  panels: { actual: Record<string, unknown> & { butts: unknown[] } }[]
  fasteners: { actual?: { fastened?: number[] } }[]
  holes: { perPanel: { panel: number; holes: { diameter: number; depth: number; props: Record<string, unknown> }[] }[] }
  expected: BasisScriptData
}

function cleanAudit(): Json {
  const fake = runInFakeBazis(script, { mapped: allKinds })
  return structuredClone(fake.audit) as Json
}

const categories = (json: unknown): AuditCategory[] =>
  [...new Set(analyzeBasisAudit(parseBasisAudit(json)).problems.map((p) => p.category))].sort()

describe('таза audit', () => {
  it('мәселе жоқ, скрипттің есебімен сәйкес', () => {
    const report = analyzeBasisAudit(parseBasisAudit(cleanAudit()))
    expect(report.problems).toEqual([])
    expect(report.counts).toMatchObject({ mismatch: 0, missing: 0, extra: 0 })
    expect(report.counts.ok).toBe(report.scriptSummary!.ok)
    expect(report.holeFrames).toHaveProperty('world:Position')
    expect(basisAuditMarkdown(report)).toContain('Мәселе жоқ')
  })

  it('audit емес файл қабылданбайды', () => {
    expect(() => parseBasisAudit({ format: 'other' })).toThrow()
  })

  it('expected панелі null болса parse кезінде басқарылатын қате береді', () => {
    const json = cleanAudit()
    json.expected.panels = [null] as unknown as BasisScriptData['panels']
    expect(() => parseBasisAudit(json)).toThrow(/expected/)
  })

  it('бұзылған expected бар файлға CLI шикі traceback шығармайды', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bazis-audit-invalid-'))
    try {
      const json = cleanAudit()
      json.expected.panels = [null] as unknown as BasisScriptData['panels']
      const file = join(dir, 'invalid.json')
      writeFileSync(file, JSON.stringify(json))
      const result = spawnSync('node_modules/.bin/tsx', ['src/cli/bazisAudit.ts', file], { cwd: process.cwd(), encoding: 'utf8' })
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('expected.panels.0')
      expect(result.stderr).not.toContain('TypeError')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('енгізілген айырмалар — әрқайсысы өз түрімен және себебімен', () => {
  it('өлшем кромкаға кіші: panel-size + «рез өлшемі» туралы себеп', () => {
    const json = cleanAudit()
    const i = json.expected.panels.findIndex((p) => p.edges.some((e) => e.thickness === 2))
    json.panels[i]!.actual.contourWidth = (json.panels[i]!.actual.contourWidth as number) - 4
    const report = analyzeBasisAudit(parseBasisAudit(json))
    const p = report.problems.find((x) => x.category === 'panel-size')!
    expect(p.where).toContain(`panel#${i}`)
    expect(p.hint).toContain('рез өлшемі')
  })

  it('Z айнасы: panel-position + «Z осі айнадай»', () => {
    const json = cleanAudit()
    const e = json.expected
    const p = e.panels[0]!
    json.panels[0]!.actual.gabMin = [p.min[0], p.min[1], e.zShift - p.max[2]]
    json.panels[0]!.actual.gabMax = [p.max[0], p.max[1], e.zShift - p.min[2]]
    // zShift − max ≠ min болуы үшін панель Z бойынша ортада тұрмауы керек
    expect(e.zShift - p.max[2]).not.toBe(p.min[2])
    const hit = analyzeBasisAudit(parseBasisAudit(json)).problems.find((x) => x.category === 'panel-position')!
    expect(hit.hint).toContain('Z осі айнадай')
  })

  it('кромка жоқ, тесік диаметрі/орны, артық тесік, жоқ тесік, крепеж панельдері', () => {
    const json = cleanAudit()
    const withButts = json.panels.findIndex((p) => p.actual?.butts?.length > 0)
    json.panels[withButts]!.actual.butts = json.panels[withButts]!.actual.butts.slice(1)

    const entry = json.holes.perPanel.find((e) => e.holes.length >= 4)!
    const [h0, h1, h2] = entry.holes
    h0!.diameter += 2
    const pos = h1!.props.Position as number[]
    h1!.props.Position = [pos[0]! + 5, pos[1], pos[2]]
    entry.holes.splice(entry.holes.indexOf(h2!), 1)
    // Диаметрі алшақ (> 3 мм) — ешбір күтілген тесікпен жұпталмайды.
    entry.holes.push({ diameter: 20, depth: 3, props: {} })

    const fi = json.fasteners.findIndex((f) => (f.actual?.fastened?.length ?? 0) === 2)
    json.fasteners[fi]!.actual!.fastened = [json.fasteners[fi]!.actual!.fastened![0]!]

    expect(categories(json)).toEqual([
      'edge-missing', 'fastener-panels', 'hole-diameter', 'hole-extra', 'hole-missing', 'hole-position',
    ])
  })

  it('крепеж таңдалмаған түр: mapping, тесіктері «жоқ» болып саналмайды', () => {
    const fake = runInFakeBazis(script, { mapped: { ...allKinds, hinge: false } })
    const report = analyzeBasisAudit(parseBasisAudit(fake.audit))
    expect(report.problems.map((p) => p.category)).toEqual(['mapping'])
    expect(report.counts.notSent).toBeGreaterThan(0)
  })

  it('тесік API-і жоқ: environment ескертуі, қалғаны тексеріледі', () => {
    const fake = runInFakeBazis(script, { mapped: allKinds, holeApi: false })
    const report = analyzeBasisAudit(parseBasisAudit(fake.audit))
    expect(report.holesAvailable).toBe(false)
    expect(report.problems.map((p) => p.category)).toEqual(['environment'])
    expect(basisAuditMarkdown(report)).toContain('Тесіктерді оқу мүмкін болмады')
  })
})
