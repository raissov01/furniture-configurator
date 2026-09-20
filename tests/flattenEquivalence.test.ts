/**
 * БАСТЫ КЕПІЛ: ағаш жолы = ескі жол.
 *
 * Ескі жол:  cabinets[] + placements[] → generateCabinet + placementPose
 * Жаңа жол:  treeFromProject → flattenTree
 *
 * Екеуі де бірдей панель, бірдей фурнитура, бірдей поза беруі керек. Бұл
 * тест өтсе — 2-фазада сторды ағашқа көшіргенде деталировка да, раскрой да,
 * смета да, присадка да, DXF те бұзылмайды.
 *
 * Тест `SEED_SETS`-тің БӘРІН аралайды: ас үй, шкаф, балалар бөлмесі —
 * әрқайсысы бірнеше модульден тұрады, қабырғасы мен бұрышы әртүрлі.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS, IDENTITY_TRANSFORM, SEED_CATALOG, SEED_SETS, findTemplate, flattenTree,
  formatCutList, generateCabinet, generateHardware, placementPose, scenePanels, setToProject,
  templateToCabinet, treeFromProject,
} from '../src/core/index'
import type { GroupNode, ProjectFile, SettingsOverride } from '../src/core/index'

/**
 * `setToProject` толық ProjectFile ЕМЕС, тек { cabinets, placements } береді —
 * қалған өрістерді осында жинаймыз. Бөлме — жиынтықтың өз ең кіші бөлмесі.
 */
const projects: { name: string; project: ProjectFile }[] = SEED_SETS.map((set) => {
  const { cabinets, placements } = setToProject(set, SEED_CATALOG)
  return {
    name: set.id,
    project: {
      schemaVersion: 3,
      name: set.name,
      materials: SEED_CATALOG.materials,
      edgeBands: SEED_CATALOG.edgeBands,
      cabinets,
      room: set.room,
      placements,
    },
  }
})

describe('ағаш жолы = ескі жол', () => {
  it('тексерілетін жоба бар', () => {
    expect(projects.length).toBeGreaterThan(0)
    // Бос `cabinets` жиыны төмендегі бес тестті де жалған-жасыл қылады:
    // цикл ешнәрсеге жүгірмей, дереу өтеді.
    for (const { project } of projects) {
      expect(project.cabinets.length).toBeGreaterThan(0)
    }
  })

  for (const { name, project } of projects) {
    describe(name, () => {
      const scene = flattenTree(treeFromProject(project), SEED_CATALOG, project.settings)

      it('түйін саны — орны бар шкаф саны', () => {
        const placed = project.cabinets.filter((c) =>
          project.placements.some((p) => p.cabinetId === c.id))
        expect(scene.nodes).toHaveLength(placed.length)
      })

      it('әр шкафтың панельдері БІРДЕЙ', () => {
        for (const cabinet of project.cabinets) {
          const node = scene.nodes.find((n) => n.nodeId === cabinet.id)
          // `continue` емес — тексеру тізбектен үнсіз шығып кетпесін: node
          // табылмаса тест шынымен ҚҰЛАУЫ керек, бос циклмен өтпеуі керек.
          expect(node).toBeDefined()
          expect(node!.panels).toEqual(generateCabinet(cabinet, SEED_CATALOG, project.settings))
        }
      })

      it('әр шкафтың фурнитурасы БІРДЕЙ', () => {
        for (const cabinet of project.cabinets) {
          const node = scene.nodes.find((n) => n.nodeId === cabinet.id)
          expect(node).toBeDefined()
          expect(node!.hardware).toEqual(generateHardware(cabinet, SEED_CATALOG, project.settings))
        }
      })

      it('әр шкафтың позасы placementPose-пен БІРДЕЙ', () => {
        for (const placement of project.placements) {
          const cabinet = project.cabinets.find((c) => c.id === placement.cabinetId)
          if (!cabinet) continue
          const node = scene.nodes.find((n) => n.nodeId === cabinet.id)!
          expect(node.pose).toEqual(placementPose(project.room, cabinet, placement))
        }
      })

      it('деталировка БІРДЕЙ', () => {
        const oldPanels = project.cabinets
          .filter((c) => project.placements.some((p) => p.cabinetId === c.id))
          .flatMap((c) => generateCabinet(c, SEED_CATALOG, project.settings))
        expect(formatCutList(scenePanels(scene), SEED_CATALOG))
          .toEqual(formatCutList(oldPanels, SEED_CATALOG))
      })
    })
  }
})

/**
 * ТӨМЕНДЕГІ ҮШ БЛОК — мутация тестінің салдары.
 *
 * Жоғарыдағы 26 тест бес тұжырымды тексереді, бірақ `SEED_SETS`-тің өзі үш
 * жағдайды ЕШҚАШАН тудырмайды: `settings` беру, түбірден басқа бұрылған
 * ата-түйін, орны жоқ шкаф. Сондықтан ол жерлерде код бұзылса да (settings
 * `flattenTree`-ге жетпесе, `composePose`-тағы sin таңбасы аударылса, сүзгі
 * жойылса) 26/26 өтіп кете береді. Бұл блоктар нақ сол үш жағдайды қолмен
 * тудырады.
 */

describe('settings таралуы (мутация тестімен расталған)', () => {
  // Әдепкі 0, мұнда әдейі басқа мән — жиынтықтардың ешқайсысында бұл
  // берілмейді, сондықтан жоғарыдағы 26 тест мұны ешқашан тексермейді.
  const custom: SettingsOverride = { shelfSetback: 15 }

  it('таңдалған мән әдепкіден өзгеше (тестің өзі мағыналы екенін дәлелдеу)', () => {
    expect(custom.shelfSetback).not.toBe(DEFAULT_SETTINGS.shelfSetback)
  })

  const base = projects.find((p) => p.name === 'corner-wardrobe')!.project
  const project: ProjectFile = { ...base, settings: custom }
  const scene = flattenTree(treeFromProject(project), SEED_CATALOG, project.settings)

  it('settings шынымен панельді өзгертеді — сөренің тереңдігі кемиді', () => {
    // Бұл тест жоқ болса, төмендегі теңдік мағынасыз болар еді: екі жол да
    // `settings`-ті мүлде елемей бірдей нәтиже беруі мүмкін еді.
    const withDefault = generateCabinet(project.cabinets[0]!, SEED_CATALOG, undefined)
    const withCustom = generateCabinet(project.cabinets[0]!, SEED_CATALOG, custom)
    expect(withCustom).not.toEqual(withDefault)
  })

  it('ағаш жолы settings-ті generateCabinet-ке дәл сол күйінде жеткізеді', () => {
    for (const cabinet of project.cabinets) {
      const node = scene.nodes.find((n) => n.nodeId === cabinet.id)
      expect(node).toBeDefined()
      expect(node!.panels).toEqual(generateCabinet(cabinet, SEED_CATALOG, project.settings))
    }
  })

  it('фурнитура да settings-пен бірдей', () => {
    for (const cabinet of project.cabinets) {
      const node = scene.nodes.find((n) => n.nodeId === cabinet.id)
      expect(node).toBeDefined()
      expect(node!.hardware).toEqual(generateHardware(cabinet, SEED_CATALOG, project.settings))
    }
  })
})

describe('composePose — тереңдетілген ағаш (қолмен есептелген поза)', () => {
  // `treeFromProject` әрқашан ЖАЛПАҚ ағаш береді (түбір → корпус), сондықтан
  // sin/cos формуласы `treeFromProject`-тен ЕШҚАШАН нақты тексерілмейді:
  // түбірдің rotationY-і әрқашан 0, ал 0-де sin(0)=0 болғандықтан таңба
  // қатесі көбейіп жоғалады. Мұнда қолмен екі деңгейлі, бұрылған ағаш
  // құрамыз.
  const cabinet = templateToCabinet(findTemplate('wardrobe-penal-600')!, SEED_CATALOG)

  // Ата топ 90°-қа бұрылған, бала корпус ата кеңістігінде {x:1000, y:0, z:0}.
  // Қолмен есеп (composePose-тың формуласын кодтан көшірместен):
  //   cos90 = 0, sin90 = 1
  //   world.x = parent.x(0) + child.x(1000)·cos(0) + child.z(0)·sin(1)     = 0
  //   world.z = parent.z(0) − child.x(1000)·sin(1) + child.z(0)·cos(0) = −1000
  //   world.y = parent.y(0) + child.y(0)                                   = 0
  //   rotationY = parent.rotationY(90) + child.rot.y(0)                    = 90
  const root: GroupNode = {
    kind: 'group',
    id: 'root',
    name: 'Түбір',
    transform: IDENTITY_TRANSFORM,
    children: [
      {
        kind: 'group',
        id: 'rotated',
        name: 'Бұрылған топ',
        transform: { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 90, z: 0 } },
        children: [
          {
            kind: 'cabinet',
            id: 'c1',
            name: cabinet.name,
            transform: { pos: { x: 1000, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
            config: cabinet,
          },
        ],
      },
    ],
  }

  it('поза қолмен есептелген мәнмен ДӘЛ сәйкес келеді', () => {
    const scene = flattenTree(root, SEED_CATALOG)
    const node = scene.nodes.find((n) => n.nodeId === 'c1')
    expect(node).toBeDefined()
    expect(node!.pose).toEqual({ position: { x: 0, y: 0, z: -1000 }, rotationY: 90 })
  })
})

describe('орны жоқ шкаф (placement алынып тасталды)', () => {
  const base = projects.find((p) => p.name === 'corner-kitchen')!.project
  const droppedId = base.placements[0]!.cabinetId
  const placements = base.placements.filter((p) => p.cabinetId !== droppedId)
  // `cabinets` тізімі ӨЗГЕРМЕЙДІ — тек орны жойылады. Дәл осылай UI-де
  // болады: шкафты сахнадан алып тастасаң, ол каталогта қалады.
  const project: ProjectFile = { ...base, placements }

  it('placements шынымен қысқарды (тестің өзі мағыналы екенін дәлелдеу)', () => {
    expect(placements.length).toBe(base.placements.length - 1)
    expect(project.cabinets.some((c) => c.id === droppedId)).toBe(true)
  })

  const scene = flattenTree(treeFromProject(project), SEED_CATALOG, project.settings)

  it('ағаш жолы орны жоқ шкафты түсіріп қалдырады', () => {
    expect(scene.nodes.some((n) => n.nodeId === droppedId)).toBe(false)
    const placedCount = project.cabinets.filter((c) =>
      project.placements.some((p) => p.cabinetId === c.id)).length
    expect(scene.nodes).toHaveLength(placedCount)
  })

  it('деталировка да түскен шкафсыз ЕСКІ ЖОЛМЕН БІРДЕЙ', () => {
    const oldPanels = project.cabinets
      .filter((c) => project.placements.some((p) => p.cabinetId === c.id))
      .flatMap((c) => generateCabinet(c, SEED_CATALOG, project.settings))
    expect(formatCutList(scenePanels(scene), SEED_CATALOG))
      .toEqual(formatCutList(oldPanels, SEED_CATALOG))
  })
})
