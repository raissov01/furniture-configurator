/**
 * Присадканы ҚОЛМЕН түзету.
 *
 * Автоматты присадка (§4.9) дұрыс, бірақ ол ЖОБАНЫҢ бәрін біле бермейді:
 * цех бір тесікті қосымша қоюы (мысалы, ілгекті үшінші нүктеге бекіту),
 * не артық тесікті алып тастауы мүмкін. Ондай түзету панельдің өзінде
 * ЖАЗЫЛМАЙДЫ — панель әрқашан конфигтен қайта есептеледі (§7). Сондықтан
 * түзету КОНФИГТЕ, панельдің id-і бойынша сақталады да, генерацияның ең
 * соңында үстіне жабылады.
 *
 * АВТО ТЕСІКТІҢ КІЛТІ. Өшірілген тесікті id-мен белгілеу мүмкін емес:
 * автоматты тесіктің id-і жоқ әрі болуы да мүмкін емес — ол әр есептеуде
 * қайта туады. Оның орнына кілт КООРДИНАТАДАН шығады. Мұның салдары бар
 * және ол ӘДЕЙІ: пайдаланушы шкафтың биіктігін өзгертсе, ілгектің орны
 * жылжиды да, «өшірілген» тесік ҚАЙТА ПАЙДА БОЛАДЫ. Бұл дұрыс мінез —
 * басқа өлшемдегі шкаф басқа присадканы талап етеді, ал ескі түзетуді
 * үнсіз көшіру нақты тесікті жоқ жерге бұрғылауға әкелер еді.
 */

import {
  CONFIRMAT_EDGE_DEPTH, CONFIRMAT_EDGE_DIAMETER, CONFIRMAT_FACE_DIAMETER,
  HINGE_CUP_DEPTH, HINGE_CUP_DIAMETER, HINGE_PLATE_DEPTH, HINGE_PLATE_DIAMETER,
  RUNNER_SCREW_DEPTH, RUNNER_SCREW_DIAMETER, SHELF_PIN_DEPTH, SHELF_PIN_DIAMETER,
  SHELF_PIN_PITCH,
} from './constants'
import { materialWidthRangeAt } from './bevelBounds'
import type { Drill, DrillPurpose, Panel } from './types'

/**
 * Қолмен қосылатын тесіктің координатасы панельдің НАҒЫЗ материалы ішінде ме
 * (Аудит Y6, docs/audit/drilling-2026-09-20.md: «Қолмен қосылған тесіктің
 * координатасы ешбір шекпен салыстырылмайды» — `DrillEditor` тікбұрышты
 * шектен (0 ≤ x ≤ cutLength, 0 ≤ y ≤ cutWidth) тыс шықпаса ғана рұқсат
 * беретін, бірақ ЕН бойынша қиғаш (бұрыштық корпус) панельде заготовка
 * тікбұрыш болғанымен нақты материал трапеция — тікбұрыштың ІШІНДЕ, бірақ
 * кесіліп кететін үшбұрышта жатқан тесік сол тексеруден ӨТІП КЕТЕДІ).
 *
 * Кең бетте (`inner`/`outer`) `bevelBounds.ts`-тегі `materialWidthRangeAt`-пен
 * тексереді — ГЕОМЕТРИЯНЫ ҚАЙТАЛАМАЙДЫ, сол көмекшіні қайта пайдаланады
 * (dxf.ts-тің контур есебімен ӘДЕЙІ бірдей формула, сонда осы тексеру мен
 * станокқа кететін пішін екі басқа геометрия болып алшақтамайды).
 *
 * Торц беттерін (edgeL1/L2/W1/W2) бұл жерде қарастырмайды: `DrillEditor`-дің
 * 2D жаймасы оларды әрдайым тікбұрышты жолақ ретінде салады, ескі
 * (тікбұрыш) тексеру сол жерде дұрыс.
 */
export function isDrillWithinMaterial(panel: Panel, face: Drill['face'], x: number, y: number): boolean {
  if (x < 0 || x > panel.cutLength) return false
  if (face !== 'inner' && face !== 'outer') return y >= 0 && y <= panel.cutWidth
  const [yMin, yMax] = materialWidthRangeAt(panel, x)
  return y >= yMin && y <= yMax
}

/** Бір панельдің присадкасына енгізілген түзету. */
export type DrillEdit = {
  /** Қолмен қосылған тесіктер. */
  added: Drill[]
  /** Өшірілген АВТО тесіктердің кілттері (`drillKey`). */
  removed: string[]
}

/** Панель id-і → түзету. */
export type DrillEdits = Record<string, DrillEdit>

export const EMPTY_DRILL_EDIT: DrillEdit = { added: [], removed: [] }

/**
 * Авто тесіктің кілті. Координата мен диаметр — тесікті цехта ажырататынның
 * бәрі; тереңдік кілтке КІРМЕЙДІ, себебі ол панельдің қалыңдығынан туындайды
 * да, материал ауысқанда өзгереді.
 */
export function drillKey(drill: Drill): string {
  return `${drill.face}:${drill.x}:${drill.y}:${drill.diameter}`
}

/** Тесік қолмен қосылған ба (сол панельдің түзетуіне қарап). */
export function isManualDrill(drill: Drill, edit: DrillEdit | undefined): boolean {
  if (!edit) return false
  const key = drillKey(drill)
  return edit.added.some((d) => drillKey(d) === key)
}

/**
 * Түзетуді панельдерге жабу. Панельдер ОРНЫНДА өзгертіледі: бұл функция
 * `generateCabinet`-тің ішінде, панельдер әлі ешкімге берілмей тұрып
 * шақырылады.
 */
export function applyDrillEdits(panels: Panel[], edits: DrillEdits | undefined): void {
  if (!edits) return
  for (const panel of panels) {
    const edit = edits[panel.id]
    if (!edit) continue

    if (edit.removed.length > 0) {
      const removed = new Set(edit.removed)
      panel.drilling = panel.drilling.filter((d) => !removed.has(drillKey(d)))
    }
    for (const drill of edit.added) {
      // Көшірме: конфигтегі объект панельге СІЛТЕМЕМЕН кетпеуі керек,
      // әйтпесе экспорт конфигті өзгертіп жіберуі мүмкін.
      panel.drilling.push({ ...drill })
    }
  }
}

// ── Пресеттер ────────────────────────────────────────────────────────────────

/**
 * Қолмен қоятын тесіктің дайын түрлері.
 *
 * Мұндағы САНДАРДЫҢ БІРДЕ-БІРІ ойдан алынбаған: бәрі `constants.ts`-тегі
 * автоматты присадка қолданатын дәл сол константалар. Қолмен қойылған тесік
 * автоматты тесіктен ӨЛШЕМІМЕН ажырамауы керек — әйтпесе бір панельде екі
 * түрлі «конфирмат» пайда болады да, цех қайсысын бұрғылаудың керегін
 * білмей қалады.
 */
export type DrillPreset = {
  id: string
  name: string
  purpose: DrillPurpose
  diameter: number
  /** Тереңдігі, мм. `'through'` — панельді ТЕСІП өтеді (қалыңдығына тең). */
  depth: number | 'through'
  /** Қай бетке қоюға болады: кең бет (пласть) немесе торц. */
  where: 'face' | 'edge'
}

export const DRILL_PRESETS: DrillPreset[] = [
  {
    id: 'confirmat-face',
    name: `Конфирмат в пласть Ø${CONFIRMAT_FACE_DIAMETER}, насквозь`,
    purpose: 'confirmat',
    diameter: CONFIRMAT_FACE_DIAMETER,
    depth: 'through',
    where: 'face',
  },
  {
    id: 'confirmat-edge',
    name: `Конфирмат в торец Ø${CONFIRMAT_EDGE_DIAMETER} × ${CONFIRMAT_EDGE_DEPTH}`,
    purpose: 'confirmat',
    diameter: CONFIRMAT_EDGE_DIAMETER,
    depth: CONFIRMAT_EDGE_DEPTH,
    where: 'edge',
  },
  {
    id: 'shelf-pin',
    name: `Полкодержатель Ø${SHELF_PIN_DIAMETER} × ${SHELF_PIN_DEPTH}`,
    purpose: 'shelfPin',
    diameter: SHELF_PIN_DIAMETER,
    depth: SHELF_PIN_DEPTH,
    where: 'face',
  },
  {
    id: 'hinge-cup',
    name: `Чашка петли Ø${HINGE_CUP_DIAMETER} × ${HINGE_CUP_DEPTH}`,
    purpose: 'hinge',
    diameter: HINGE_CUP_DIAMETER,
    depth: HINGE_CUP_DEPTH,
    where: 'face',
  },
  {
    id: 'hinge-plate',
    name: `Ответная планка Ø${HINGE_PLATE_DIAMETER} × ${HINGE_PLATE_DEPTH}`,
    purpose: 'hinge',
    diameter: HINGE_PLATE_DIAMETER,
    depth: HINGE_PLATE_DEPTH,
    where: 'face',
  },
  {
    id: 'runner-screw',
    name: `Направляющая Ø${RUNNER_SCREW_DIAMETER} × ${RUNNER_SCREW_DEPTH}`,
    purpose: 'runner',
    diameter: RUNNER_SCREW_DIAMETER,
    depth: RUNNER_SCREW_DEPTH,
    where: 'face',
  },
]

export function findDrillPreset(id: string): DrillPreset | undefined {
  return DRILL_PRESETS.find((p) => p.id === id)
}

/** 32 мм торына түсіру — қолмен қойылған тесік те жүйенің ішінде қалуы үшін. */
export function snapToPitch(value: number, datum = 0): number {
  return datum + Math.round((value - datum) / SHELF_PIN_PITCH) * SHELF_PIN_PITCH
}

/**
 * Пресеттен нақты тесік жасау. `thickness` — панельдің қалыңдығы; өтпелі
 * тесіктің тереңдігі содан алынады.
 */
export function drillFromPreset(
  preset: DrillPreset,
  face: Drill['face'],
  x: number,
  y: number,
  thickness: number,
): Drill {
  return {
    face,
    x: Math.round(x),
    y: Math.round(y),
    diameter: preset.diameter,
    depth: preset.depth === 'through' ? thickness : preset.depth,
    purpose: preset.purpose,
  }
}

// ── Түзетуді өзгерту (таза функциялар) ───────────────────────────────────────

const editOf = (edits: DrillEdits, panelId: string): DrillEdit =>
  edits[panelId] ?? EMPTY_DRILL_EDIT

/** Тесік қосу. Дәл сол жерде тесік бар болса, ЕКІНШІ рет қосылмайды. */
export function addDrill(edits: DrillEdits, panelId: string, drill: Drill): DrillEdits {
  const edit = editOf(edits, panelId)
  const key = drillKey(drill)
  if (edit.added.some((d) => drillKey(d) === key)) return edits
  return {
    ...edits,
    [panelId]: {
      added: [...edit.added, drill],
      // Дәл сол координатадағы авто тесік бұрын өшірілген болса, оны қайта
      // қосу «өшірілген» деген белгіні де алып тастауы керек.
      removed: edit.removed.filter((k) => k !== key),
    },
  }
}

/**
 * Тесікті өшіру. Қолмен қосылғаны тізімнен ЖОҒАЛАДЫ, ал автоматты тесік
 * «өшірілген» деп белгіленеді — оны әр есептеуде қайта тудырмау үшін.
 */
export function removeDrill(
  edits: DrillEdits,
  panelId: string,
  drill: Drill,
  { manual }: { manual: boolean },
): DrillEdits {
  const edit = editOf(edits, panelId)
  const key = drillKey(drill)

  const next: DrillEdit = manual
    ? { added: edit.added.filter((d) => drillKey(d) !== key), removed: edit.removed }
    : {
      added: edit.added,
      removed: edit.removed.includes(key) ? edit.removed : [...edit.removed, key],
    }

  // Бос түзетуді сақтамаймыз: жоба файлында бос объект жиналып қалмауы керек.
  if (next.added.length === 0 && next.removed.length === 0) {
    const { [panelId]: _dropped, ...rest } = edits
    return rest
  }
  return { ...edits, [panelId]: next }
}

/** Панельдің барлық түзетуін қайтару — «авто күйіне қайтар» батырмасы. */
export function resetPanelDrills(edits: DrillEdits, panelId: string): DrillEdits {
  const { [panelId]: _dropped, ...rest } = edits
  return rest
}

/** Жобада қанша тесік қолмен қосылған / өшірілген. */
export function drillEditCounts(edits: DrillEdits | undefined): { added: number; removed: number } {
  if (!edits) return { added: 0, removed: 0 }
  let added = 0
  let removed = 0
  for (const edit of Object.values(edits)) {
    added += edit.added.length
    removed += edit.removed.length
  }
  return { added, removed }
}
