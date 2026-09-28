import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { flattenTree } from '../src/core/flatten'
import { SEED_CATALOG } from '../src/core/seed'
import { ConfigValidationError } from '../src/core/errors'
import { walkTree } from '../src/core/tree'
import type { BoardNode, SceneNode, SolidNode } from '../src/core/tree'
import type { Catalog } from '../src/core/types'
import { basisBandThicknessFromArticle, importBasisB3d } from '../src/core/import/basisB3d'
import type { BasisImportResult } from '../src/core/import/basisB3d'
import { readBasisContainer, readContour } from '../src/core/import/basisBz'

// Клиенттің өз Базис кітапханасынан (2023 Модули КУХНИ), оның келісімімен.
const fixture = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(join(__dirname, 'fixtures', 'basis', name)))

const SIDE = 'shv1080x320x20-bok-fasad-pr.b3d' // ШВ1080х320х20-Бок-фасад-пр
const WALL = 'shv360x300x900-sp8-2d-0p.b3d' // ШВ360х300х900-СП8-2Д-0П
const SINK = 'shn720x550x600-sp8-2d-mojka.b3d' // ШН720х550х600-СП8-2Д-мойка
const CHAMFER = 'shv1080x300x100-2psk-lv.b3d' // ШВ1080х300х100-2ПСк-лв
const SCREW = 'evrovint-7x50.fr3d' // Евровинт 7х50.fr3d

function boards(root: SceneNode): BoardNode[] {
  const out: BoardNode[] = []
  const step = (n: SceneNode): void => {
    if (n.kind === 'board') out.push(n)
    if (n.kind === 'group') n.children.forEach(step)
  }
  step(root)
  return out
}

function solids(root: SceneNode): SolidNode[] {
  const out: SolidNode[] = []
  const step = (n: SceneNode): void => {
    if (n.kind === 'solid') out.push(n)
    if (n.kind === 'group') n.children.forEach(step)
  }
  step(root)
  return out
}

/** Импорт нәтижесінен каталог: материал/кромка id-лері нақты тақтаға сәйкес келеді. */
function catalogOf(r: BasisImportResult): Catalog {
  const base = SEED_CATALOG.materials[0]!
  return {
    materials: r.materials.map((m) => ({ ...base, id: m.id, name: m.name, thickness: m.thickness })),
    edgeBands: r.bands.map((b) => ({ id: b.id, name: b.name, thickness: b.thickness ?? 0.4, pricePerMeter: 0 })),
  }
}

/** Модуль атауы Базис кітапханасында H × D × W ретімен: «ШВ360х300х900» = 360 (H) × 900 (W) × 300 (D). */
function nameDims(name: string): { kind: string; h: number; d: number; w: number } {
  const m = /^(Ш[ВНП])(\d+)х(\d+)х(\d+)/.exec(name)!
  return { kind: m[1]!, h: Number(m[2]), d: Number(m[3]), w: Number(m[4]) }
}

describe('BZ85 контейнері', () => {
  it('тақырып сегменті ашық, құжат zlib-пен сығылған; атаулар кестесі мен ағаш толық оқылады', () => {
    const { header, document } = readBasisContainer(fixture(SIDE))
    expect(header.key).toBe('Header')
    expect(document.key).toBe('Document')
    const keys = header.type === 'object' ? header.children.map((c) => c.key) : []
    expect(keys).toEqual(['Version', 'Thumbnail', 'Article'])
  })

  it('BZ85 емес байттан ConfigValidationError-мен бас тартады', () => {
    expect(() => readBasisContainer(new TextEncoder().encode('PK\u0003\u0004 not basis'))).toThrow(ConfigValidationError)
    expect(() => importBasisB3d(fixture(SIDE).subarray(0, 300))).toThrow(ConfigValidationError)
  })

  it('контурдың үш элементін оқиды: кесінді 0x10, шеңбер 0x11, доға 0x12 (ccw жалаушасы)', () => {
    const buf = new ArrayBuffer(4 + 33 + 25 + 50)
    const v = new DataView(buf)
    let o = 0
    v.setUint32(o, 3, true); o += 4
    v.setUint8(o, 0x10); o += 1
    for (const n of [0, 0, 100, 0]) { v.setFloat64(o, n, true); o += 8 }
    v.setUint8(o, 0x11); o += 1
    for (const n of [5, 6, 7]) { v.setFloat64(o, n, true); o += 8 }
    v.setUint8(o, 0x12); o += 1
    for (const n of [0, 0, 10, 0, 0, 10]) { v.setFloat64(o, n, true); o += 8 }
    v.setUint8(o, 1)
    expect(readContour(new Uint8Array(buf))).toEqual([
      { kind: 'line', x1: 0, y1: 0, x2: 100, y2: 0 },
      { kind: 'circle', cx: 5, cy: 6, r: 7 },
      { kind: 'arc', cx: 0, cy: 0, x1: 10, y1: 0, x2: 0, y2: 10, ccw: true },
    ])
  })

  it('кромка артикулынан қалыңдық: K04x19 → 0.4', () => {
    expect(basisBandThicknessFromArticle('K04x19-S1')).toBe(0.4)
    expect(basisBandThicknessFromArticle('K2x43')).toBe(2)
    expect(basisBandThicknessFromArticle('LDSP/16')).toBeUndefined()
  })
})

describe('Базис модулі → түйін ағашы', () => {
  it('жалғыз фасад-бүйір: 1080 (H) × 20 (W) × 320 (D) рамка, бір тақта, төрт кромка', () => {
    const r = importBasisB3d(fixture(SIDE))
    expect(r.info).toMatchObject({ fileType: 1, name: 'ШВ1080х320х20-Бок-фасад-пр' })
    expect(r.info.frame).toEqual({ height: 1080, width: 20, depth: 320 })
    expect(r.info.thumbnailPng?.subarray(1, 4)).toEqual(new TextEncoder().encode('PNG'))
    const [b] = boards(r.root)
    expect(boards(r.root)).toHaveLength(1)
    expect(b!.board).toMatchObject({
      length: 1080, width: 320, orientation: { length: 'y', width: 'z', thickness: 'x' },
      materialId: 'basis:F/16', grainAlongLength: true,
    })
    expect(Object.values(b!.board.edges).every((e) => e?.bandId === 'basis:K04x19-S/F')).toBe(true)
    expect(r.materials).toEqual([expect.objectContaining({ name: 'Фасад 16мм', article: 'F/16', thickness: 16 })])
    expect(r.warnings).toEqual([])
  })

  it('ілме шкаф: атаудағы H × D × W рамкаға сәйкес, 7 тақта, фасад корпустың алдында (z < 0)', () => {
    const r = importBasisB3d(fixture(WALL))
    const dims = nameDims(r.info.name)
    expect(r.info.frame).toEqual({ height: dims.h, width: dims.w, depth: dims.d })
    const list = boards(r.root)
    expect(list).toHaveLength(7)
    const byName = (n: string): BoardNode[] => list.filter((b) => b.name === n)
    expect(byName('ШВ Бок лв')[0]!.transform.pos).toEqual({ x: 0, y: 0, z: 0 })
    expect(byName('ШВ Бок пр')[0]!.transform.pos).toEqual({ x: 884, y: 0, z: 0 })
    for (const side of [...byName('ШВ Бок лв'), ...byName('ШВ Бок пр')]) {
      expect(side.board).toMatchObject({ length: 360, width: 300, role: 'side' })
    }
    for (const door of [...byName('ШВ Дверь лв'), ...byName('ШВ Дверь пр')]) {
      expect(door.board).toMatchObject({ length: 447, width: 357, role: 'front', grainAlongLength: false })
      expect(door.transform.pos.z).toBe(-16)
    }
    // Барлық тақта W бойынша рамкаға сыяды
    walkTree(r.root, (node, pose) => {
      if (node.kind === 'board') expect(pose.position.x).toBeGreaterThanOrEqual(0)
    })
    expect(r.hardware.find((h) => h.furnType === 'Петля')).toBeTruthy()
    expect(solids(r.root).map((s) => s.name)).toEqual(['Ручка-скоба 96мм', 'Ручка-скоба 96мм'])
  })

  it('мойка шкафы: рамка 720 + 100 аяқ, 10 тақта, аяқ пен тұтқа solid, присадка flattenTree-ден өтеді', () => {
    const r = importBasisB3d(fixture(SINK))
    const dims = nameDims(r.info.name)
    expect(dims.kind).toBe('ШН')
    expect(r.info.frame).toEqual({ height: dims.h + 100, width: dims.w, depth: dims.d })
    expect(r.stats).toMatchObject({ panels: 10, boards: 10, solids: 6, holes: 44, drills: 44 })
    const top = boards(r.root).find((b) => b.name === 'Столешница')!
    expect(top.board).toMatchObject({ length: 600, width: 600, materialId: 'basis:ST/38' })
    expect(top.transform.pos).toEqual({ x: 0, y: 820, z: -50 })
    // Накладной дно бүйірлердің астында: евровинттің Ø8 өтпелі тесігі дноның
    // үстіңгі бетінде бүйір қалыңдығының ортасында (16/2 = 8), шегініс 50 мм
    // (JointData.Scheme.StartIndent); Ø5×34 — бүйірдің астыңғы торцында.
    const bottom = boards(r.root).find((b) => b.name === 'ШН Дно накл')!
    expect(bottom.board.drilling).toEqual(expect.arrayContaining([
      { face: 'inner', x: 8, y: 50, diameter: 8, depth: 16, purpose: 'confirmat' },
    ]))
    const left = boards(r.root).find((b) => b.name === 'ШН Бок лв')!
    expect(left.board.drilling).toEqual(expect.arrayContaining([
      { face: 'edgeW1', x: 50, y: 8, diameter: 5, depth: 34, purpose: 'confirmat' },
    ]))
    const legs = solids(r.root).filter((s) => s.name.startsWith('Ножка'))
    expect(legs).toHaveLength(4)
    for (const leg of legs) expect(leg.solid.size.y).toBe(100)
    const scene = flattenTree(r.root, catalogOf(r))
    expect(scene.nodes.flatMap((n) => n.panels)).toHaveLength(10)
    expect(r.warnings.map((w) => w.code).sort()).toEqual(['groove-unsupported'])
  })

  it('скос сөрелер: 5 төбелі контур тақта, flattenTree контурды қабылдайды', () => {
    const r = importBasisB3d(fixture(CHAMFER))
    const shelves = boards(r.root).filter((b) => b.name === 'ШВ Полка скос')
    expect(shelves).toHaveLength(4)
    for (const s of shelves) {
      expect(s.board.contour?.points).toHaveLength(5)
      expect(s.board.contour?.bands).toHaveLength(5)
      expect(Object.values(s.board.edges).every((e) => e === null)).toBe(true)
    }
    expect(r.warnings).toEqual([])
    expect(() => flattenTree(r.root, catalogOf(r))).not.toThrow()
  })

  it('.fr3d фрагменті: артикул мен FurnType оқылады, тақтасыз тесік ескертумен қалады', () => {
    const r = importBasisB3d(fixture(SCREW))
    expect(r.info).toMatchObject({ fileType: 3, name: 'Евровинт 7х50', code: 'EK-7x50', furnType: 'Евровинт' })
    expect(boards(r.root)).toHaveLength(0)
    expect(r.hardware).toEqual([{ name: 'Евровинт 7х50', article: 'EK-7x50', furnType: 'Евровинт', count: 1 }])
    expect(r.stats.holes).toBe(2)
    expect(r.warnings).toEqual([expect.objectContaining({ code: 'hole-no-panel', count: 2 })])
  })

  it('материал/кромка id-лерін шақырушы береді (каталогқа сәйкестендіру)', () => {
    const r = importBasisB3d(fixture(SIDE), {
      idPrefix: 'x-',
      materialId: (m) => (m.article === 'F/16' ? 'mdf16-paint' : 'unknown'),
      bandId: () => 'band-04',
    })
    const [b] = boards(r.root)
    expect(b!.id.startsWith('x-')).toBe(true)
    expect(b!.board.materialId).toBe('mdf16-paint')
    expect(b!.board.edges.L1).toEqual({ bandId: 'band-04' })
  })
})
