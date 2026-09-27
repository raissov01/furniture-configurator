/**
 * Базис-Мебельщикке СКРИПТ экспорты (`src/core/export/basisScript.ts`).
 *
 * Базис бізде ЖОҚ — скриптті шын Базисте іске қоса алмаймыз. Сондықтан
 * мұнда тексерілетіні:
 *   1. деректер блогы = `flattenTree` панельдері (саны, ГОТОВЫЙ өлшем,
 *      материал, кромка) — барлық SEED_TEMPLATES үшін;
 *   2. `drilling.ts`-тің әр тесігі ДӘЛ БІР крепежге түседі, әлем координатасы
 *      қолмен есептелген бұрылған/кірістірілген жағдаймен сәйкес;
 *   3. скрипт — жарамды JS және ресми API-дің өзіміз жазған қысқа
 *      stub тізіміндегі атауларын ғана шақырады;
 *   4. скрипттің денесі жалған (mock) Базис ортасында аяғына дейін жүреді.
 */
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import { drillToLocalMarker } from '../lib/drillGeometry'
import { runInFakeBazis } from './fakeBazis'
import { BASIS_CLASSIC_API_NAMES } from './bazisApiStub'
import {
  BASIS_API_FROM_EXAMPLES,
  IDENTITY_TRANSFORM,
  ORIENT_HORIZONTAL,
  SEED_CATALOG,
  SEED_TEMPLATES,
  basisScriptBytes,
  basisScriptData,
  canonicalDrill,
  exportBasisScript,
  flattenTree,
  mergeSettings,
  scenePanels,
  templateToCabinet,
} from '../src/core/index'
import type { BasisScriptData, CabinetTemplate, GroupNode, Panel, SceneNode } from '../src/core/index'

const settings = mergeSettings(undefined)
const bands = new Map(SEED_CATALOG.edgeBands.map((b) => [b.id, b]))
const thicknessOf = (p: Panel): number => SEED_CATALOG.materials.find((m) => m.id === p.materialId)!.thickness

function cabinetRoot(template: CabinetTemplate, rotY = 0): GroupNode {
  const child: SceneNode = {
    id: `cab-${template.id}`,
    name: template.name,
    kind: 'cabinet',
    transform: { pos: { x: 100, y: 0, z: 200 }, rot: { x: 0, y: rotY, z: 0 } },
    config: templateToCabinet(template, SEED_CATALOG),
  }
  return { id: 'root', name: 'root', kind: 'group', transform: IDENTITY_TRANSFORM, children: [child] }
}

const sceneOf = (template: CabinetTemplate, rotY = 0) => flattenTree(cabinetRoot(template, rotY), SEED_CATALOG)
const wardrobe = SEED_TEMPLATES.find((t) => t.id === 'wardrobe-penal-600')!

describe('деректер блогы = flattenTree панельдері', () => {
  it('әр кабинеттің minBandSubtract баптауы ClipPanel-ге жетеді', () => {
    const root = cabinetRoot(wardrobe)
    const cabinet = root.children[0]
    if (cabinet?.kind !== 'cabinet') throw new Error('cabinet fixture missing')
    cabinet.config.settings = { minBandSubtract: 3 }
    const scene = flattenTree(root, SEED_CATALOG)
    const data = basisScriptData(scene, SEED_CATALOG)
    const withoutNodeSettings = { nodes: scene.nodes.map(({ settings: _settings, ...node }) => node) }
    expect(data).toEqual(basisScriptData(withoutNodeSettings, SEED_CATALOG, { minBandSubtract: 3 }))
    const panel = data.panels.find((p) => p.edges.some((edge) => edge.thickness === 2))!
    expect(panel.cutWidth).toBe(panel.finishedWidth)
    expect(panel.edges.filter((edge) => edge.thickness === 2).every((edge) => edge.clip === false)).toBe(true)
  })
  for (const template of SEED_TEMPLATES) {
    it(`${template.id}: саны, ГОТОВЫЙ өлшем, материал, кромка`, () => {
      const scene = sceneOf(template)
      const panels = scenePanels(scene)
      const data = basisScriptData(scene, SEED_CATALOG)

      expect(data.panels).toHaveLength(panels.length)
      panels.forEach((panel, i) => {
        const rec = data.panels[i]!
        const material = SEED_CATALOG.materials.find((m) => m.id === panel.materialId)!
        expect(rec.panelId).toBe(panel.id)
        expect(rec.name).toBe(panel.label)
        // ⚠ ГОТОВЫЙ өлшем: Базис кромканы өзі шегереді (basis.ts-тегі ереже).
        expect(rec.finishedLength).toBe(panel.finishedLength)
        expect(rec.finishedWidth).toBe(panel.finishedWidth)
        expect(rec.material).toBe(material.name)
        expect(rec.materialId).toBe(material.id)
        expect(rec.thickness).toBe(material.thickness)

        // Габарит: нормаль бойында — қалыңдық, қалған екеуі — готовый өлшем.
        const ext = [0, 1, 2].map((k) => Math.round((rec.max[k]! - rec.min[k]!) * 10) / 10)
        const normalIdx = ['x', 'y', 'z'].indexOf(rec.normal)
        expect(ext[normalIdx]).toBe(material.thickness)
        expect(ext.filter((_, k) => k !== normalIdx).sort((a, b) => a - b))
          .toEqual([panel.finishedLength, panel.finishedWidth].sort((a, b) => a - b))

        // Кромка: әр толтырылған жағына бір жазба, қалыңдығы каталогтан.
        const sides = (['L1', 'L2', 'W1', 'W2'] as const).filter((s) => panel.edges[s] !== null)
        expect(rec.edges.map((e) => e.side)).toEqual(sides)
        for (const e of rec.edges) {
          const band = bands.get(panel.edges[e.side]!.bandId)!
          expect(e.bandId).toBe(band.id)
          expect(e.thickness).toBe(band.thickness)
          // Базис рез өлшемін біздікімен бірдей шығаруы үшін: тек шегерілетін
          // кромка панельді «подрезает» (§4.3 minBandSubtract).
          expect(e.clip).toBe(band.thickness >= settings.minBandSubtract)
        }
      })
    })
  }
})

describe('әр тесік ДӘЛ БІР крепежде', () => {
  for (const template of SEED_TEMPLATES) {
    it(`${template.id}`, () => {
      const scene = sceneOf(template, 90)
      const panels = scenePanels(scene)
      const data = basisScriptData(scene, SEED_CATALOG)

      const seen = new Map<string, number>()
      for (const f of data.fasteners) {
        for (const h of f.holes) {
          const key = `${h.panel}:${h.drill}`
          seen.set(key, (seen.get(key) ?? 0) + 1)
          // Тесіктің түрі крепеждің түрімен бірдей.
          expect(panels[h.panel]!.drilling[h.drill]!.purpose).toBe(f.kind)
        }
        // pair — екі ТҮРЛІ деталь, single — біреу.
        if (f.mount === 'pair') {
          expect(f.panels).toHaveLength(2)
          expect(f.panels[0]).not.toBe(f.panels[1])
        } else {
          expect(f.panels).toHaveLength(1)
        }
      }
      const expected = panels.flatMap((p, i) => p.drilling.map((_, j) => `${i}:${j}`))
      expect([...seen.keys()].sort()).toEqual(expected.sort())
      expect([...seen.values()].every((n) => n === 1)).toBe(true)
    })
  }
})

describe('канондық тесік нүктесі = 3D маркерімен бірдей (lib/drillGeometry)', () => {
  it('барлық шаблон, барлық тесік', () => {
    let checked = 0
    for (const template of SEED_TEMPLATES) {
      for (const panel of scenePanels(sceneOf(template))) {
        for (const drill of panel.drilling) {
          const ours = canonicalDrill(panel, drill, thicknessOf(panel), bands, settings)
          const theirs = drillToLocalMarker(panel, drill, thicknessOf(panel), bands, settings)
          expect(ours.point).toEqual(theirs.point)
          expect(ours.direction).toEqual(theirs.direction)
          checked += 1
        }
      }
    }
    expect(checked).toBeGreaterThan(500)
  })
})

describe('әлем координатасы — қолмен есептелген кірістірілген, бұрылған жағдай', () => {
  /*
   * root ─ group «wall» (pos 1000,0,500; rot Y 90°) ─ group «inner» (pos 100,50,0)
   *                                                   └ board 600 (L) × 400 (W), жатық, t = 16
   * Тесік: inner бет, x = 100, y = 50 (кромка жоқ → рез = готовый).
   *
   * composePose: wall ∘ inner → pos (1000 + 0, 50, 500 − 100) = (1000, 50, 400), rotY 90.
   * Канондық: (100, 50, 16), бағыт (0, 0, −1).
   * ORIENT_HORIZONTAL (length x, width z, thickness y) → локал (100, 16, 50), бағыт (0, −1, 0).
   * Y 90°: x' = x·0 + z·1 = 50, z' = −x·1 + z·0 = −100 → әлем (1050, 66, 300).
   * Тақтаның әлем габариті: x 1000..1400, y 50..66, z −200..400 → zShift = 400.
   * Базис: Z алға қарай (Z_b = zShift − z) → (1050, 66, 100), бағыт (0, −1, 0).
   * Габарит Базисте: x 1000..1400, y 50..66, z 0..600.
   */
  const material = SEED_CATALOG.materials.find((m) => m.thickness === 16)!
  const root: GroupNode = {
    id: 'root', name: 'root', kind: 'group', transform: IDENTITY_TRANSFORM,
    children: [{
      id: 'wall', name: 'wall', kind: 'group',
      transform: { pos: { x: 1000, y: 0, z: 500 }, rot: { x: 0, y: 90, z: 0 } },
      children: [{
        id: 'inner', name: 'inner', kind: 'group',
        transform: { pos: { x: 100, y: 50, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
        children: [{
          id: 'b1', name: 'Полка', kind: 'board', transform: IDENTITY_TRANSFORM,
          board: {
            materialId: material.id, length: 600, width: 400, orientation: ORIENT_HORIZONTAL,
            edges: { L1: null, L2: null, W1: null, W2: null }, grainAlongLength: true, role: 'custom',
            drilling: [{ face: 'inner', x: 100, y: 50, diameter: 5, depth: 12, purpose: 'shelfPin' }],
          },
        }],
      }],
    }],
  }
  const data = basisScriptData(flattenTree(root, SEED_CATALOG), SEED_CATALOG)

  it('панель габариті мен нормалі', () => {
    expect(data.zShift).toBe(400)
    const p = data.panels[0]!
    expect(p.min).toEqual([1000, 50, 0])
    expect(p.max).toEqual([1400, 66, 600])
    expect(p.normal).toBe('y')
  })

  it('тесік нүктесі мен осі', () => {
    expect(data.fasteners).toHaveLength(1)
    const f = data.fasteners[0]!
    expect(f.kind).toBe('shelfPin')
    expect(f.mount).toBe('single')
    expect(f.point).toEqual([1050, 66, 100])
    expect(f.axis).toEqual([0, -1, 0])
    expect(f.holes[0]!.point).toEqual([1050, 66, 100])
  })
})

describe('қосылыстар (конфирмат, ілгек) — эталон шкаф', () => {
  const scene = sceneOf(wardrobe)
  const panels = scenePanels(scene)
  const data = basisScriptData(scene, SEED_CATALOG)
  const byKind = (k: string) => data.fasteners.filter((f) => f.kind === k)

  it('конфирмат: pair, екі тесік (бет Ø8 + торец Ø5), бір түзуде', () => {
    const list = byKind('confirmat')
    expect(list.length).toBeGreaterThan(0)
    for (const f of list) {
      expect(f.mount).toBe('pair')
      expect(f.holes).toHaveLength(2)
      const edge = f.holes.find((h) => h.face.startsWith('edge'))!
      const face = f.holes.find((h) => !h.face.startsWith('edge'))!
      // 1-деталь — торцына бұранда кіретін деталь (Aventos HF үлгісіндегі
      // `Евровинт.Value.Mount(Polka, LeftPanel, …)` тәртібі).
      expect(f.panels).toEqual([edge.panel, face.panel])
      // Орнату нүктесі — буын жазықтығы: торц тесігінің кіре берісі.
      expect(f.point).toEqual(edge.point)
      // Бір түзуде: екі кіре беріс арасы осьпен параллель.
      const d = [0, 1, 2].map((k) => edge.point[k]! - face.point[k]!)
      const cross = [
        d[1]! * f.axis[2]! - d[2]! * f.axis[1]!,
        d[2]! * f.axis[0]! - d[0]! * f.axis[2]!,
        d[0]! * f.axis[1]! - d[1]! * f.axis[0]!,
      ]
      expect(Math.hypot(...cross)).toBeLessThan(0.5)
    }
  })

  it('ілгек: чашка санымен бірдей, чашка фасадта, планка корпуста', () => {
    const cups = panels.flatMap((p) => p.drilling.filter((d) => d.purpose === 'hinge' && d.diameter === 35))
    const hinges = byKind('hinge')
    expect(hinges).toHaveLength(cups.length)
    for (const f of hinges) {
      const cup = f.holes.find((h) => h.diameter === 35)!
      expect(f.point).toEqual(cup.point)
      expect(panels[f.panels[f.panels.length - 1]!]!.role).toBe('front')
    }
  })

  it('полкодержатель: әр тесік — бөлек single', () => {
    for (const f of byKind('shelfPin')) {
      expect(f.mount).toBe('single')
      expect(f.holes).toHaveLength(1)
    }
  })
})

describe('Базиске жеткізе алмайтын жағдай — ЕСКЕРТУМЕН, үнсіз емес', () => {
  it('90°-қа еселі емес бұрылыс: деталь мен оның крепежі skip', () => {
    const data = basisScriptData(sceneOf(wardrobe, 30), SEED_CATALOG)
    expect(data.panels.every((p) => p.skip !== null)).toBe(true)
    expect(data.fasteners.every((f) => f.skip !== null)).toBe(true)
  })

  it('мансарда: көлбеу крышка skip, қалғаны салынады', () => {
    const mansard = SEED_TEMPLATES.find((t) => t.id === 'wardrobe-mansard-1200')!
    const data = basisScriptData(sceneOf(mansard), SEED_CATALOG)
    const skipped = data.panels.filter((p) => p.skip !== null)
    expect(skipped.map((p) => p.role)).toEqual(['top'])
    expect(data.panels.some((p) => p.skip === null)).toBe(true)
    // Көлбеу крышканың тесіктері бар крепеж да skip болады.
    const topIndex = data.panels.indexOf(skipped[0]!)
    for (const f of data.fasteners) {
      if (f.holes.some((h) => h.panel === topIndex)) expect(f.skip).not.toBeNull()
    }
  })
})

// ── Скрипт мәтіні ────────────────────────────────────────────────────────────

const script = exportBasisScript(sceneOf(wardrobe), SEED_CATALOG, undefined, { projectName: 'Шкаф-пенал */ тест' })

describe('скрипт — жарамды JS', () => {
  it('vm.Script парсинг', () => {
    expect(() => new vm.Script(script)).not.toThrow()
  })

  it('комментарийден тыс тек ASCII (ескі Базис CP1251 оқыса да, жолдар бұзылмайды)', () => {
    const code = script.split('\n').filter((l) => !l.trimStart().startsWith('//'))
    for (const line of code) expect(line).toMatch(/^[\x09\x20-\x7e]*$/)
  })

  it('UTF-8 + BOM байттары', () => {
    const bytes = basisScriptBytes(sceneOf(wardrobe), SEED_CATALOG, undefined, { projectName: 'x' })
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  })

  it('жоба атауындағы «*/» комментарийді бұзбайды', () => {
    expect(script).not.toContain('тест */')
  })
})

function keysDeep(value: unknown, out: Set<string>): Set<string> {
  if (Array.isArray(value)) for (const v of value) keysDeep(v, out)
  else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.add(k)
      keysDeep(v, out)
    }
  }
  return out
}

function bazisNames(): Set<string> {
  return new Set(BASIS_CLASSIC_API_NAMES)
}

/** JS-тің өзінің атаулары (ES5) — Базиске қатысы жоқ. */
const JS_BUILTINS = new Set([
  'Math', 'abs', 'round', 'max', 'min', 'sqrt', 'String', 'message', 'length', 'push', 'join',
  'slice', 'indexOf', 'lastIndexOf', 'concat', 'sort', 'replace', 'JSON', 'stringify', 'Date',
  'toISOString',
])

/** Скрипттің БІЗДІҢ объектілері (өрістеріне жазу/оқу API емес). */
const OWN_OBJECTS = 'a|out|env|m|c|R|audit|entry|e|best|summary'

/** Скрипт ДЕНЕСІ (DATA/MSG блоктарынан кейінгі бөлік), комментарий мен жолдарсыз. */
function scriptBody(text: string): string {
  const start = text.indexOf('// ===== BODY')
  return text.slice(start)
    .split('\n').map((l) => l.replace(/^\s*\/\/.*$/, '')).join('\n')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/\/(?:[^/\\\n]|\\.)+\/[gi]*/g, (m) => (m.startsWith('//') ? m : '/re/'))
}

function extractData(text: string): { DATA: BasisScriptData; MSG: Record<string, unknown> } {
  const ctx: Record<string, unknown> = {}
  const head = text.slice(0, text.indexOf('// ===== BODY'))
  vm.runInNewContext(`${head}\nthis.DATA = DATA; this.MSG = MSG;`, ctx)
  return { DATA: ctx.DATA as BasisScriptData, MSG: ctx.MSG as Record<string, unknown> }
}

/** Скрипттің денесі қолданатын, бірақ ешқайда жарияланбаған атаулар. */
function unknownApiNames(text: string): string[] {
  const names = bazisNames()
  for (const n of BASIS_API_FROM_EXAMPLES) names.add(n)
  const { DATA, MSG } = extractData(text)
  const ours = keysDeep(MSG, keysDeep(DATA, new Set()))
  const body = scriptBody(text)

  const locals = new Set<string>(['DATA', 'MSG'])
  for (const m of body.matchAll(/\b(?:function|var)\s+([A-Za-z_$][\w$]*)/g)) locals.add(m[1]!)
  for (const m of body.matchAll(/function\s*[\w$]*\s*\(([^)]*)\)/g)) {
    for (const p of m[1]!.split(',')) if (p.trim()) locals.add(p.trim())
  }
  // Объект литералының кілттері: `{ key:` не `, key:`
  for (const m of body.matchAll(/[{,]\s*([A-Za-z_$][\w$]*)\s*:/g)) locals.add(m[1]!)
  // Өз объектілерімізге жазылған өрістер: `audit.saved = …`
  for (const m of body.matchAll(new RegExp(`\\b(?:${OWN_OBJECTS})\\.([A-Za-z_$][\\w$]*)\\s*=[^=]`, 'g'))) locals.add(m[1]!)

  const used = new Set<string>()
  for (const m of body.matchAll(/\.\s*([A-Za-z_$][\w$]*)/g)) used.add(m[1]!)
  for (const m of body.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) used.add(m[1]!)
  for (const m of body.matchAll(/(?<![.\w$'])([A-Z][\w$]*)\b/g)) used.add(m[1]!)
  for (const m of body.matchAll(/typeof\s+([A-Za-z_$][\w$]*)/g)) used.add(m[1]!)

  const KEYWORDS = new Set(['if', 'for', 'while', 'function', 'return', 'catch', 'typeof', 'in', 'var', 'new', 'switch'])
  return [...used].filter((n) =>
    !KEYWORDS.has(n) && !names.has(n) && !JS_BUILTINS.has(n) && !locals.has(n) && !ours.has(n)).sort()
}

describe('скрипт тек құжатталған API-ді қолданады', () => {
  it('қысқа stub саналы толтырылған', () => {
    const names = bazisNames()
    for (const n of ['AddVertPanel', 'Mount1', 'Mount', 'NewFurniture', 'AddButt', 'ClipPanel', 'ToGlobal', 'GabMin']) {
      expect(names.has(n), n).toBe(true)
    }
    expect(names.has('AddMagicHole')).toBe(false)
  })

  it('әр шақыру/қасиет атауы жарияланған', () => {
    expect(unknownApiNames(script)).toEqual([])
  })

  it('ойдан шығарылған API ұсталады (тесттің өзін тексеру)', () => {
    const bad = script.replace('panel.Build();', 'panel.Build(); panel.AddMagicHole(1);')
    expect(unknownApiNames(bad)).toEqual(['AddMagicHole'])
  })
})

// ── Жалған Базис ортасында іске қосу ─────────────────────────────────────────

describe('скрипт жалған Базисте', () => {
  const data = basisScriptData(sceneOf(wardrobe), SEED_CATALOG)
  const allKinds = Object.fromEntries(data.kinds.map((k) => [k.id, true]))

  it('бәрі сәйкестендірілген: бірден салады, әр крепеж — бір Mount', () => {
    const fake = runInFakeBazis(script, { mapped: allKinds })
    expect(fake.isFinished()).toBe(true)

    const made = fake.calls.filter((c) => ['front', 'horiz', 'vert'].includes(c.fn))
    expect(made).toHaveLength(data.panels.filter((p) => p.skip === null).length)

    const mounts = fake.calls.filter((c) => c.fn.startsWith('Mount'))
    expect(mounts).toHaveLength(data.fasteners.length)
    data.fasteners.forEach((f, i) => {
      const call = mounts[i]!
      expect(call.fn).toBe(`${f.mount === 'pair' ? 'Mount' : 'Mount1'}:${f.kind}`)
      const xyz = f.mount === 'pair' ? call.args.slice(2, 5) : call.args.slice(1, 4)
      expect(xyz).toEqual(f.point)
    })
  })

  it('кромка контурдың дұрыс торцына түседі (жалған геометрия бойынша)', () => {
    const fake = runInFakeBazis(script, { mapped: allKinds })
    expect(fake.alerts.join('\n')).not.toContain('не найден торец')
  })

  it('сәйкестендірілмеген түр (ілгек) — БОЛЖАМАЙДЫ, есепте тесік санымен айтады', () => {
    const fake = runInFakeBazis(script, { mapped: { ...allKinds, hinge: false } })
    const hinges = data.fasteners.filter((f) => f.kind === 'hinge')
    expect(fake.calls.some((c) => c.fn.startsWith('Mount') && c.fn.endsWith(':hinge'))).toBe(false)
    const report = fake.alerts[fake.alerts.length - 1]!
    const holes = hinges.reduce((s, f) => s + f.holes.length, 0)
    expect(report).toContain('[hinge]')
    expect(report).toContain(`${holes}`)
  })

  it('кромка таңдалмаса — панель салынады, есепте айтылады', () => {
    const fake = runInFakeBazis(script, { mapped: allKinds, buttThickness: 0 })
    const report = fake.alerts[fake.alerts.length - 1]!
    expect(report).toContain('Кромка не выбрана')
  })
})

describe('AUDIT: скрипт өзін тексеріп, файл жазады', () => {
  const data = basisScriptData(sceneOf(wardrobe), SEED_CATALOG)
  const allKinds = Object.fromEntries(data.kinds.map((k) => [k.id, true]))

  it('таза жағдай: JSON + TXT модельдің қалтасына, бәрі OK', () => {
    const fake = runInFakeBazis(script, { mapped: allKinds })
    expect([...fake.files.keys()].sort()).toEqual([
      'C:\\Models\\Шкаф-пенал __ тест-bazis-audit.json',
      'C:\\Models\\Шкаф-пенал __ тест-bazis-audit.txt',
    ])
    const audit = fake.audit!
    expect(audit.format).toBe('furniture-configurator.basis-audit')
    const summary = (audit.comparison as { summary: Record<string, number> }).summary
    expect(summary).toMatchObject({ mismatch: 0, missing: 0, extra: 0 })
    expect(summary.ok).toBeGreaterThan(data.panels.length)
    expect((audit.errors as unknown[])).toEqual([])
    // Тестерге хабарлама: файл қайда және «отправьте».
    expect(fake.alerts[fake.alerts.length - 1]).toContain('Отправьте этот файл')
    expect(fake.alerts[fake.alerts.length - 1]).toContain('C:\\Models\\')
  })

  it('бұзылған тесік: MISMATCH (диаметр) және MISSING шығады, audit тоқтамайды', () => {
    const fake = runInFakeBazis(script, {
      mapped: allKinds,
      corruptHoles: (_panel, holes) => holes.slice(1).map((h, i) => (i === 0 ? { ...h, Diameter: h.Diameter + 2 } : h)),
    })
    const summary = (fake.audit!.comparison as { summary: Record<string, number> }).summary
    expect(summary.mismatch).toBeGreaterThan(0)
    expect(summary.missing).toBeGreaterThan(0)
  })

  it('координатасы жоқ тесіктер OK емес, аралас нәтиже TXT есебінде де көрінеді', () => {
    let removed = false
    const fake = runInFakeBazis(script, {
      mapped: allKinds,
      corruptHoles: (_panel, holes) => holes.map((hole) => {
        if (removed) return hole
        removed = true
        const withoutPosition = { ...hole }
        Reflect.deleteProperty(withoutPosition, 'Position')
        return withoutPosition
      }),
    })
    const comparison = fake.audit!.comparison as {
      summary: Record<string, number>
      holes: { status: string }[]
    }
    expect(comparison.summary.positionUnverified).toBe(1)
    expect(comparison.holes.filter((hole) => hole.status === 'POSITION_UNVERIFIED')).toHaveLength(1)
    expect(comparison.holes.some((hole) => hole.status === 'OK')).toBe(true)
    expect([...fake.files.values()].find((value) => value.includes('POSITION_UNVERIFIED'))).toBeDefined()
  })

  it('тесік API-і жоқ (ескі Базис): audit бәрібір жазылады, себебі көрсетілген', () => {
    const fake = runInFakeBazis(script, { mapped: allKinds, holeApi: false })
    const holes = fake.audit!.holes as { available: boolean; error: string }
    expect(holes.available).toBe(false)
    expect(holes.error).toContain('NewHoleDrilling')
    expect((fake.audit!.panels as unknown[]).length).toBe(data.panels.length)
  })

  it('модель сақталмаған: тестер файлды өзі таңдайды (askFileNameSave)', () => {
    const fake = runInFakeBazis(script, { mapped: allKinds, modelFilename: '' })
    expect(fake.auditPath).toBe('C:\\chosen\\audit.json')
  })
})
