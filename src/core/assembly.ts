/**
 * Пошаговая сборка: детальді қай ретпен және қай бағытта қою керек.
 *
 * Бұл — АНИМАЦИЯ ЕМЕС, реттің өзі. Цехтағы жинаушы «алдымен нені, сосын нені»
 * дегенді біледі, ал ол рет геометриядан шығады: астыңғысынан үстіңгісіне,
 * сырттан ішке. Сондықтан мұнда ешқандай «сборка ережесі» ойдан жазылмайды —
 * панельдің өз орны мен рөлі ретті өзі анықтайды.
 *
 * Бағыт та геометриядан: панель өз қалыңдығының осі бойымен қойылады
 * (жатық деталь — жоғарыдан, тік деталь — жанынан, фасад — алдынан).
 */

import type { Panel, PanelRole } from './types'

/** Қай кезеңге жататыны: цех оларды осылай топтап жинайды. */
export type AssemblyStage = 'carcass' | 'fixed' | 'movable' | 'front'

export type AssemblyStep = {
  /** 1-ден басталатын қадам нөмірі. */
  step: number
  panelId: string
  label: string
  stage: AssemblyStage
  /** Панельді қай жақтан әкеп қою керек. */
  direction: 'сверху' | 'снизу' | 'слева' | 'справа' | 'спереди' | 'сзади'
  /** Осы қадамдағы бұрғыланған тесік саны — жинаушыға бағдар. */
  holes: number
  note: string
}

const STAGE_OF: Record<PanelRole, AssemblyStage> = {
  side: 'carcass',
  bottom: 'carcass',
  top: 'carcass',
  divider: 'carcass',
  back: 'fixed',
  rail: 'fixed',
  plinth: 'fixed',
  shelf: 'movable',
  drawerSide: 'movable',
  drawerBack: 'movable',
  drawerBottom: 'movable',
  front: 'front',
  custom: 'fixed',
}

/** Кезеңдердің реті: корпус → бекітілгені → жылжымалысы → фасад. */
const STAGE_ORDER: AssemblyStage[] = ['carcass', 'fixed', 'movable', 'front']

/**
 * Корпустың ішінде де рет бар: дно, бүйірлер мен перегородкалар, сосын крышка.
 * Крышка ЕҢ СОҢЫНДА — оны бірінші қойса, ішіне қол жетпейді.
 */
const ROLE_ORDER: PanelRole[] = [
  'bottom', 'side', 'divider', 'top',
  'back', 'rail', 'plinth', 'custom',
  'drawerSide', 'drawerBack', 'drawerBottom', 'shelf',
  'front',
]

function directionOf(panel: Panel): AssemblyStep['direction'] {
  // Қалыңдық осі — панельдің «жалпақ» бағыты: ол сол ось бойымен қойылады.
  switch (panel.orientation.thickness) {
    case 'y':
      // Жатық деталь: дно астынан, қалғаны үстінен түседі.
      return panel.role === 'bottom' ? 'снизу' : 'сверху'
    case 'x':
      // Тік деталь: корпустың ортасынан қай жақта тұрғанына қарай.
      return panel.role === 'side' || panel.role === 'divider' ? 'слева' : 'справа'
    case 'z':
      return panel.role === 'back' ? 'сзади' : 'спереди'
  }
}

/**
 * Жинау реті. Панельдер тізімі ӨЗГЕРМЕЙДІ — жаңа массив қайтады.
 *
 * Бірдей рөлдегі детальдар сол-төменнен оңға-жоғары қарай реттеледі: жинаушы
 * бір жақтан бастап жүреді, ал бұл рет деталировкадағы позициямен де,
 * 3D-дегі көрініспен де сәйкес.
 */
export function assemblySteps(panels: Panel[]): AssemblyStep[] {
  const ordered = [...panels].sort((a, b) => {
    const stage = STAGE_ORDER.indexOf(STAGE_OF[a.role]) - STAGE_ORDER.indexOf(STAGE_OF[b.role])
    if (stage !== 0) return stage
    const role = ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)
    if (role !== 0) return role
    return a.position.y - b.position.y || a.position.x - b.position.x || a.position.z - b.position.z
  })

  return ordered.map((panel, i) => ({
    step: i + 1,
    panelId: panel.id,
    label: panel.label,
    stage: STAGE_OF[panel.role],
    direction: directionOf(panel),
    holes: panel.drilling.length,
    note: panel.note,
  }))
}

export const ASSEMBLY_STAGE_NAMES: Record<AssemblyStage, string> = {
  carcass: 'Корпус',
  fixed: 'Закрепить',
  movable: 'Наполнение',
  front: 'Фасады',
}


/**
 * Жинау қадамдарының индексі: `panel.id` → қадам нөмірі.
 *
 * 3D-де корпусты нөлден бастап жинап көрсету үшін керек. Рет `assemblySteps`
 * -тен алынады, сондықтан ҚАҒАЗДАҒЫ нұсқаулықтың N-қадамы мен 3D-дегі
 * N-қадам БІР деталь болады — екеуін бөлек санауға болмайды.
 */
export function assemblyStepIndex(panels: Panel[]): Map<string, number> {
  return new Map(assemblySteps(panels).map((s) => [s.panelId, s.step]))
}
