/**
 * Присадка тесігін (`Drill`, CLAUDE.md §4.9) панельдің ӨЗ КАНОНДЫҚ локал
 * кеңістігіне түрлендіру — таза функция, рендерден (R3F/three.js) МҮЛДЕ
 * тәуелсіз. `components/PanelMesh.tsx`/`components/DrillMarkers.tsx` бұл
 * функцияны шақырып, нәтижені өз рендер кеңістігіне ауыстырады.
 *
 * Канондық кеңістік — `Drill.x/y`-дің өзі сүйенетін кеңістік (types.ts:170-183):
 *   x — finishedLength бойымен, 0..finishedLength
 *   y — finishedWidth  бойымен, 0..finishedWidth
 *   z — қалыңдық бойымен,       0..thickness
 *
 * Бұрғылау координаталары ӘРҚАШАН РЕЗ панелінде беріледі (станок соны
 * көреді) — W1/L1 кромкасының қалыңдығы шегерілген. Мұнда ГОТОВЫЙ (жиналған,
 * 3D-де көрсетілетін) кеңістікке қайта аударамыз: `cutOrigin` дәл осы
 * ығысуды қайта қосу үшін бар (drilling.ts-тегі `toCut`-тің КЕРІСІ).
 *
 * Формулалар `src/core/drilling.ts`-тегі `pushFace`/`edgeXShiftFor`/
 * `edgeFaceFor`-мен ӘДЕЙІ дәл сәйкес (сол жерден шыққан): бөлек файл болу
 * себебі — `drilling.ts` тесікті ЖАЗАДЫ (ГОТОВЫЙ→РЕЗ), ал бұл оны 3D-ге
 * ОҚИДЫ (РЕЗ→ГОТОВЫЙ→канондық нүкте). Екі бағыт бір формуланың айнасы
 * болуы керек, сондықтан біреуін өзгертсең — екіншісін де тексер
 * (`tests/drillGeometry.test.ts`).
 */
import { cutOrigin } from '../src/core/drilling'
import type { ConstructionSettings, Drill, EdgeBand, Panel, Vec3 } from '../src/core/types'

export type DrillMarker3D = {
  /** Тесіктің БЕТКЕ шығатын нүктесі (терең кірместен), канондық кеңістікте, мм. */
  point: Vec3
  /** Бірлік бағыт: тесік МАТЕРИАЛДЫҢ ІШІНЕ қарай осы бағытпен кіреді. */
  direction: Vec3
  diameter: number
  depth: number
}

/**
 * `Drill` бір беттегі (`face`) координатасын панельдің канондық 3D нүктесі
 * мен бағытына айналдырады.
 *
 * ⚠ Трапеция (`Panel.bevel`, бұрыштық/переходной корпус) панельде де осы
 * формула ӨЗГЕРМЕЙДІ: `x`/`y` координатасы әрқашан панельдің РЕЗ
 * тікбұрышының сол-төмен бұрышынан саналады (§4.9), тек НАҒЫЗ материал
 * сол тікбұрыштың толық ауданын алмайды — соны тексеру
 * `src/core/bevelBounds.ts`-тің ісі, бұл функцияның ЕМЕС (сол екеуі
 * `tests/drillGeometry.test.ts`-те бірге тексеріледі).
 */
export function drillToLocalMarker(
  panel: Panel,
  drill: Drill,
  thickness: number,
  bands: Map<string, EdgeBand>,
  settings: ConstructionSettings,
): DrillMarker3D {
  // { x: W1 кромкасының қалыңдығы, y: L1 кромкасының қалыңдығы } — дәл
  // drilling.ts-тегі `toCut`-те шегерілетін шама, мұнда кері қосылады.
  const origin = cutOrigin(panel, bands, settings)
  const { diameter, depth } = drill

  switch (drill.face) {
    // Кең беттер: `orientation.thickness` осі бойынша ажыратылады
    // (types.ts:185-207). inner — +қалыңдық жағы (z=thickness), материалға
    // −z бағытымен кіреді; outer — қарсы жақ (z=0), +z бағытымен.
    case 'inner':
      return {
        point: { x: drill.x + origin.x, y: drill.y + origin.y, z: thickness },
        direction: { x: 0, y: 0, z: -1 },
        diameter,
        depth,
      }
    case 'outer':
      return {
        point: { x: drill.x + origin.x, y: drill.y + origin.y, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        diameter,
        depth,
      }

    // Торц беттер: edgeW1/W2 — ұзындықтың (x) басы/соңы, ондағы `drill.x`
    // ЕН осі бойымен жүреді (L1 шегеріледі — `edgeXShiftFor` §4.9).
    case 'edgeW1':
      return {
        point: { x: 0, y: drill.x + origin.y, z: drill.y },
        direction: { x: 1, y: 0, z: 0 },
        diameter,
        depth,
      }
    case 'edgeW2':
      return {
        point: { x: panel.finishedLength, y: drill.x + origin.y, z: drill.y },
        direction: { x: -1, y: 0, z: 0 },
        diameter,
        depth,
      }

    // edgeL1/L2 — енінің (y) басы/соңы, ондағы `drill.x` ҰЗЫНДЫҚ осі
    // бойымен жүреді (W1 шегеріледі).
    case 'edgeL1':
      return {
        point: { x: drill.x + origin.x, y: 0, z: drill.y },
        direction: { x: 0, y: 1, z: 0 },
        diameter,
        depth,
      }
    case 'edgeL2':
      return {
        point: { x: drill.x + origin.x, y: panel.finishedWidth, z: drill.y },
        direction: { x: 0, y: -1, z: 0 },
        diameter,
        depth,
      }

    default: {
      const exhaustive: never = drill.face
      throw new Error(`drillToLocalMarker: белгісіз Drill.face — ${exhaustive as string}`)
    }
  }
}
