/**
 * САҚТАП-АШУ: барлық өріс аман қала ма.
 *
 * ⚠ НЕГЕ БҰЛ ТЕСТ БАР. zod белгісіз кілттерді ҮНСІЗ алып тастайды. Демек
 * `types.ts`-ке өріс қосып, `schema.ts`-ке қосуды ұмытсақ, ол сессия ішінде
 * жұмыс істейді де, жобаны сақтап қайта ашқанда ЖОҒАЛАДЫ. Мұндай қате
 * тестсіз тек клиент «менің баптауым жоғалып кетті» дегенде байқалады.
 *
 * Сондықтан мұнда жаңа мүмкіндіктердің БӘРІ бір конфигке жиналған да,
 * файл арқылы да, сілтеме арқылы да өткізіледі.
 */
import { describe, expect, it } from 'vitest'
import {
  SEED_CATALOG, decodeProject, encodeProject, findTemplate, parseProject, templateToCabinet,
} from '../src/core/index'
import type { CabinetConfig, ProjectFile } from '../src/core/index'

/** Жаңа өрістердің БӘРІ қосылған корпус. */
const loaded = (): CabinetConfig => ({
  ...templateToCabinet(findTemplate('kitchen-base-600')!, SEED_CATALOG),
  // Крыша: планка
  topRails: { width: 100, count: 2, orientation: 'edge' },
  // Направляющая мен металл жәшік
  drawerSystem: 'legrabox',
  metalBoxBackHeight: 115,
  // Фронтальдық панель
  frontPanel: { width: 120, side: 'left', materialId: SEED_CATALOG.materials[0]!.id },
  // Аяқтар
  base: {
    kind: 'legs', height: 100,
    legType: 'vector', legPlate: 'square', legHoleSpacing: 68, legStep: 500,
    plinthMaterialId: SEED_CATALOG.materials[0]!.id,
  },
  // Детальдің қасиеттері
  panelGrain: { 'side-left': 'width' },
  panelCorners: { top: { bottomLeft: 20, bottomRight: 20, topRight: 0, topLeft: 0 } },
  panelCutouts: {
    back: [{ id: 'c1', shape: 'circle', label: 'Розетка', corner: 'bottomLeft', x: 100, y: 100, diameter: 68 }],
  },
  sections: [{
    id: 's1', widthMode: 'flex',
    contents: [{
      kind: 'drawers', count: 2,
      gaps: { between: 4, left: 2, right: 2, top: 5, bottom: 5 },
      fillers: { left: 16, right: 0 },
      frontMount: 'inset',
    }],
    fronts: { count: 1, mount: 'overlay', opening: 'up' },
  }],
})

const project = (): ProjectFile => {
  const cabinet = loaded()
  return {
    schemaVersion: 3,
    name: 'Толық',
    materials: SEED_CATALOG.materials,
    edgeBands: SEED_CATALOG.edgeBands,
    cabinets: [cabinet],
    room: { width: 4000, depth: 3000, height: 2700 },
    placements: [{ cabinetId: cabinet.id, wall: 'south', offset: 300, elevation: 0, rotate: 45 }],
  }
}

/** Сақтау = JSON, сондықтан салыстыру да сол арқылы. */
const throughFile = (p: ProjectFile) => parseProject(JSON.parse(JSON.stringify(p)))

describe('файл арқылы', () => {
  const back = throughFile(project())
  const before = project().cabinets[0]!
  const after = back.cabinets[0]!

  it('ЕШТЕҢЕ жоғалмайды — бүкіл корпус бірдей', () => {
    expect(after).toEqual(before)
  })

  it('бөлмедегі орны да, БҰРЫЛЫСЫ да сақталады', () => {
    expect(back.placements[0]).toEqual(project().placements[0])
  })

  // Әр өрісті ЖЕКЕ атап шығу: жалпы toEqual құласа, қайсысы екені бірден
  // көрінбейді, ал бұл тізім сол сұраққа жауап береді.
  const fields: [string, (c: CabinetConfig) => unknown][] = [
    ['topRails', (c) => c.topRails],
    ['drawerSystem', (c) => c.drawerSystem],
    ['metalBoxBackHeight', (c) => c.metalBoxBackHeight],
    ['frontPanel', (c) => c.frontPanel],
    ['base.legType', (c) => c.base?.legType],
    ['base.legPlate', (c) => c.base?.legPlate],
    ['base.legHoleSpacing', (c) => c.base?.legHoleSpacing],
    ['base.legStep', (c) => c.base?.legStep],
    ['base.plinthMaterialId', (c) => c.base?.plinthMaterialId],
    ['panelGrain', (c) => c.panelGrain],
    ['panelCorners', (c) => c.panelCorners],
    ['panelCutouts', (c) => c.panelCutouts],
    ['drawers.gaps', (c) => (c.sections[0]!.contents[0] as { gaps?: unknown }).gaps],
    ['drawers.fillers', (c) => (c.sections[0]!.contents[0] as { fillers?: unknown }).fillers],
    ['drawers.frontMount', (c) => (c.sections[0]!.contents[0] as { frontMount?: unknown }).frontMount],
    ['fronts.opening', (c) => c.sections[0]!.fronts?.opening],
  ]
  for (const [name, get] of fields) {
    it(`${name} сақталады`, () => {
      expect(get(after)).toEqual(get(before))
    })
  }
})

describe('сілтеме арқылы', () => {
  it('клиентке жіберілетін сілтемеде де бәрі аман', () => {
    const back = decodeProject(encodeProject(project()))
    expect(back.cabinets[0]).toEqual(project().cabinets[0])
    expect(back.placements).toEqual(project().placements)
  })
})
