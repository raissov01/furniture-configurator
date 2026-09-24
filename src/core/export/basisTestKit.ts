/**
 * Базис ТЕСТ-ЖИНАҒЫ: Базисте тексеруге болатын барлық жағдайды қамтитын БІР жоба.
 *
 * Бізде Базис жоқ. Базисі бар тестер `bazis-test-kit.js`-ті бір рет іске
 * қосады да, audit файлын қайтарады. Сол бір файлдан барлық болжамымыз
 * (осьтер, бет, крепеж нүктесі, кромка, ClipPanel) тексерілуі үшін жоба
 * әдейі «бәрінен бір-бірден» құрастырылған:
 *
 *   1. қарапайым төменгі корпус: конфирмат, полкодержатель, аяқ, ілгек
 *      чашкасы PRESS-FIT, фасадтың СЫРТҚЫ бетіндегі тұтқа тесігі;
 *   2. ящикті тумба: направляющая, минификс (Ø5 бұранда), шкант (ящик түбі),
 *      ящик фасадының еврошурупы;
 *   3. сол тумба, минификс ФУТОРКАМЕН (Ø8);
 *   4. аспалы шкаф, ілгек чашкасы БҰРАНДАМЕН (screw-on);
 *   5. аспалы шкаф, КӨТЕРІЛЕТІН фасад (ілгек присадкасы жоқ — механизм);
 *   6. бұрыштық (переходной) корпус — қиғаш деталь;
 *   7. арт қабырғасы ПАЗҒА отыратын корпус (паз Базиске берілмейді — audit көрсетеді);
 *   8. төрт жағында ТӘРТҮРЛІ кромкасы бар еркін тақта + қолмен шкант;
 *   9. бұрылған (90°) және кірістірілген топ ішіндегі корпус пен тақта.
 *
 * ⚠ 1, 3, 4-тегі артикулдық мәндер (pilot Ø2.8×8, press-fit 12 мм, футорка
 * 12 мм) ӨНДІРІСКЕ арналмаған: олар `tests/shopDrilling.test.ts`-тегі ТЕСТ
 * мәндері, тек Базистің сол режимдерді қалай қабылдайтынын көру үшін.
 */
import { ORIENT_HORIZONTAL, ORIENT_SIDE } from '../geometry'
import { findTemplate, templateToCabinet } from '../templates'
import { IDENTITY_TRANSFORM } from '../tree'
import type { BoardNode, CabinetNode, GroupNode, SceneNode } from '../tree'
import type { CabinetConfig, Catalog, EdgeSpec } from '../types'
import { flattenTree } from '../flatten'
import { exportBasisScript } from './basisScript'

export const BASIS_TEST_KIT_NAME = 'bazis-test-kit'

function cabinetNode(id: string, name: string, config: CabinetConfig, x: number, y = 0, z = 0): CabinetNode {
  return { id, name, kind: 'cabinet', config, transform: { pos: { x, y, z }, rot: { x: 0, y: 0, z: 0 } } }
}

function template(id: string, catalog: Catalog): CabinetConfig {
  const t = findTemplate(id)
  if (!t) throw new Error(`Тест-жинақ: шаблон табылмады — ${id}`)
  return templateToCabinet(t, catalog)
}

function band(catalog: Catalog, thickness: number): EdgeSpec {
  const b = catalog.edgeBands.find((e) => e.thickness === thickness)
  return b ? { bandId: b.id } : null
}

/** Тест-жинақтың ағашы. */
export function basisTestKitTree(catalog: Catalog): GroupNode {
  // 1. Төменгі корпус + фасадтың сыртындағы тұтқа
  const base = template('kitchen-base-600', catalog)
  const withHandle: CabinetConfig = {
    ...base,
    // Аяқ (дноның астындағы бұранда тесіктері) + чашка PRESS-FIT (тест мәні).
    base: { kind: 'legs', height: 100 },
    settings: { hingeCupMount: 'press-fit', hingePressFitDepth: 12 },
    sections: base.sections.map((s) => (s.fronts
      ? { ...s, fronts: { ...s.fronts, handle: { handleId: 'handle-bar', boreSpacing: 128, position: 'top', edgeOffset: 50, endOffset: 0 } } }
      : s)),
  }

  // 2–3. Ящикті тумба: минификс бұрандамен және футоркамен
  const drawers = template('kitchen-base-drawers-600', catalog)
  const drawersSleeve: CabinetConfig = { ...drawers, settings: { minifixBoltMount: 'sleeve-8', minifixSleeveDepth: 12 } }

  // 4–5. Аспалы шкаф: чашка бұрандамен; көтерілетін фасад (ілгексіз — механизм қағаз шаблонмен)
  const wall = template('kitchen-wall-600', catalog)
  const wallScrew: CabinetConfig = { ...wall, settings: { hingeCupMount: 'screw', hingeScrewPilotDiameter: 2.8, hingeScrewPilotDepth: 8 } }
  const wallLift: CabinetConfig = {
    ...wall,
    sections: wall.sections.map((s) => (s.fronts ? { ...s, fronts: { ...s.fronts, count: 1, opening: 'up' as const } } : s)),
  }

  // 6. Бұрыштық (переходной) корпус — `tests/corner.test.ts` үлгісі
  const penal = template('wardrobe-penal-600', catalog)
  const corner: CabinetConfig = {
    ...penal,
    depth: 600,
    back: { mode: 'none' },
    corner: { depthAtRight: 350 },
    sections: [{ ...penal.sections[0]!, fronts: null, contents: [{ kind: 'shelves', count: 3, shelfKind: 'adjustable' }] }],
  }

  // 7. Арт қабырға пазда
  const grooved: CabinetConfig = { ...template('bookcase-2sec-1200', catalog), back: { mode: 'groove' } }

  // 8. Төрт жағы әртүрлі кромкалы тақта + қолмен шкант (тақтаның торцы → екінші тақтаның беті)
  const materialId = base.carcassMaterialId
  const material = catalog.materials.find((m) => m.id === materialId)
  if (!material) throw new Error(`Тест-жинақ: материал табылмады — ${materialId}`)
  const t = material.thickness
  const edged: BoardNode = {
    id: 'kit-board-edges', name: 'Щит с разной кромкой', kind: 'board',
    transform: { pos: { x: 0, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
    board: {
      materialId, length: 500, width: 300, orientation: ORIENT_HORIZONTAL,
      edges: { L1: band(catalog, 2), L2: band(catalog, 0.4), W1: band(catalog, 1), W2: null },
      grainAlongLength: true, role: 'custom',
      // Шкант: тақтаның W2 торцына (кромкасыз), екі тесік.
      drilling: [
        // x — РЕЗ координатасы (§4.9): L1-дің 2 мм кромкасы шегерілген → готовый 80 және 220.
        { face: 'edgeW2', x: 78, y: t / 2, diameter: 8, depth: 30, purpose: 'dowel' },
        { face: 'edgeW2', x: 218, y: t / 2, diameter: 8, depth: 30, purpose: 'dowel' },
      ],
    },
  }
  // Екінші тақта тік тұрып, біріншісінің W2 торцына тіреледі (x = 500).
  const post: BoardNode = {
    id: 'kit-board-post', name: 'Стойка под шкант', kind: 'board',
    transform: { pos: { x: 500, y: -200, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
    board: {
      materialId, length: 400, width: 300, orientation: ORIENT_SIDE,
      // Кромкасыз: рез басы = готовый басы, тесік координатасы қарапайым.
      edges: { L1: null, L2: null, W1: null, W2: null },
      grainAlongLength: true, role: 'custom',
      // Біріншінің торц тесіктері осы тақтаның бетіне (outer — x = 500 жағы) түседі.
      // Жергілікті: x — биіктік (y + 200), y — тереңдік (z).
      drilling: [
        { face: 'outer', x: 200 + t / 2, y: 80, diameter: 8, depth: 12, purpose: 'dowel' },
        { face: 'outer', x: 200 + t / 2, y: 220, diameter: 8, depth: 12, purpose: 'dowel' },
      ],
    },
  }

  // 9. Бұрылған + кірістірілген топ
  const nested: GroupNode = {
    id: 'kit-rotated', name: 'Повёрнутая группа 90°', kind: 'group',
    transform: { pos: { x: 5200, y: 0, z: 0 }, rot: { x: 0, y: 90, z: 0 } },
    children: [{
      id: 'kit-inner', name: 'Вложенная группа', kind: 'group',
      transform: { pos: { x: 100, y: 200, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
      children: [
        cabinetNode('kit-rot-penal', 'Пенал в повёрнутой группе', template('wardrobe-penal-600', catalog), 0),
        { ...edged, id: 'kit-rot-board', transform: { pos: { x: 800, y: 0, z: 0 }, rot: { x: 0, y: 0, z: 0 } } },
      ],
    }],
  }

  const children: SceneNode[] = [
    cabinetNode('kit-base', '1 Базовая тумба: ручка, ножки, чашка press-fit', withHandle, 0),
    cabinetNode('kit-drawers', '2 Тумба с ящиками (минификс Ø5)', drawers, 700),
    cabinetNode('kit-drawers-sleeve', '3 Тумба с ящиками (футорка Ø8)', drawersSleeve, 1400),
    cabinetNode('kit-wall-screw', '4 Навесной (чашка на шурупы)', wallScrew, 0, 1500),
    cabinetNode('kit-wall-lift', '5 Навесной подъёмный фасад', wallLift, 700, 1500),
    cabinetNode('kit-corner', '6 Угловой переходной', corner, 2100),
    cabinetNode('kit-groove', '7 Задняя стенка в паз', grooved, 2900),
    {
      id: 'kit-boards', name: '8 Щиты: кромка по сторонам + шкант', kind: 'group',
      transform: { pos: { x: 4300, y: 200, z: 0 }, rot: { x: 0, y: 0, z: 0 } },
      children: [edged, post],
    },
    nested,
  ]
  return { id: 'kit-root', name: 'Bazis test kit', kind: 'group', transform: IDENTITY_TRANSFORM, children }
}

/** Тест-жинақтың Базис скрипті (`bazis-test-kit.js`). */
export function basisTestKitScript(catalog: Catalog): string {
  const scene = flattenTree(basisTestKitTree(catalog), catalog)
  return exportBasisScript(scene, catalog, undefined, { projectName: BASIS_TEST_KIT_NAME })
}
