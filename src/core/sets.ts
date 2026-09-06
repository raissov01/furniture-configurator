/**
 * Жиынтықтар (наборы): бір батырмамен бірнеше корпус.
 *
 * Бұл — бұрыштық шкафтың да, кухня гарнитурының да ШЫН жауабы. Цехта бұрыш
 * бір «Г-тәрізді» деталь болып кесілмейді: екі тік бұрышты корпус бұрышқа
 * қойылады. Бізде бөлме мен қабырғалар бар, сондықтан жиынтық — жай ғана
 * дайын корпустардың орналасқан тізімі.
 *
 * Мұнда ЖАҢА геометрия жоқ: әр элемент — бұрыннан бар шаблон.
 */

import { ConfigValidationError } from './errors'
import { findTemplate, templateToCabinet } from './templates'
import type { TemplateSize } from './templates'
import type { CabinetConfig, Catalog, Placement, WallId } from './types'

export type SetItem = {
  templateId: string
  /** Шаблонның үнсіз өлшемін қайта анықтау */
  size?: TemplateSize | undefined
  wall: WallId
  /** Қабырға басынан, мм */
  offset: number
}

export type TemplateSet = {
  id: string
  name: string
  description: string
  /** Жиынтық сыятын ең кіші бөлме, мм */
  room: { width: number; depth: number; height: number }
  items: SetItem[]
}

export const SEED_SETS: TemplateSet[] = [
  {
    id: 'corner-wardrobe',
    name: 'Угловой шкаф',
    description:
      'Два корпуса в угол: один вдоль стены, второй перпендикулярно. Так угол и ' +
      'собирают в цехе — Г-образную деталь не выкроить из листа.',
    room: { width: 3000, depth: 3000, height: 2700 },
    // ⚠ БҰРЫШ: екі корпус БІР бұрышта (солтүстік+шығыстың offset 0-і сол
    // жерде түйіседі) түйісуі керек. Перпендикуляр корпус көршісінің
    // ТЕРЕҢДІГІНЕ шегінеді, әйтпесе бұрыш кубында соқтығысады. Штангалы
    // шкаф (тереңдігі 600) бұрышты алады, пенал одан кейін басталады.
    items: [
      { templateId: 'wardrobe-rod-1000', size: { width: 1000 }, wall: 'north', offset: 0 },
      { templateId: 'wardrobe-penal-600', size: { height: 2200, width: 900 }, wall: 'east', offset: 1500 },
    ],
  },
  {
    id: 'corner-kitchen',
    name: 'Угловая кухня',
    description: 'Нижний ряд буквой Г: мойка в углу, рабочий модуль по одной стене, ящики по другой.',
    room: { width: 3200, depth: 3000, height: 2700 },
    // ⚠ БҰРЫШ: мойка (тереңдігі 500) солтүстік+шығыс бұрышын алады да,
    // ящик перпендикуляр қабырғада мойканың ТЕРЕҢДІГІНЕН (500) басталады —
    // сонда екі қатар нақ Г-әрпіндей түйіседі, бұрышта саңылау да,
    // соқтығысу да болмайды.
    items: [
      { templateId: 'kitchen-sink-800', wall: 'north', offset: 0 },
      { templateId: 'kitchen-base-full-600', wall: 'north', offset: 800 },
      { templateId: 'kitchen-base-drawers-600', wall: 'east', offset: 1900 },
    ],
  },
  {
    id: 'kitchen-run-3m',
    name: 'Кухня 3 метра',
    description: 'Нижний ряд из четырёх модулей: мойка, ящики, распашной и узкий добор.',
    room: { width: 3400, depth: 3000, height: 2700 },
    items: [
      { templateId: 'kitchen-sink-800', wall: 'south', offset: 0 },
      { templateId: 'kitchen-base-drawers-600', wall: 'south', offset: 800 },
      { templateId: 'kitchen-base-full-600', wall: 'south', offset: 1400 },
      { templateId: 'kitchen-base-400', wall: 'south', offset: 2000 },
    ],
  },
  {
    id: 'bedroom-set',
    name: 'Спальня: шкаф и две тумбы',
    description: 'Шкаф со штангой на одной стене, прикроватные тумбы на другой.',
    room: { width: 3600, depth: 3200, height: 2700 },
    items: [
      { templateId: 'wardrobe-rod-drawers-1600', wall: 'north', offset: 0 },
      { templateId: 'bedside-drawers-450', wall: 'west', offset: 400 },
      { templateId: 'bedside-drawers-450', wall: 'west', offset: 1400 },
    ],
  },
  {
    id: 'workplace-set',
    name: 'Рабочее место',
    description: 'Стол с тумбой и книжный стеллаж рядом.',
    room: { width: 3000, depth: 2600, height: 2700 },
    items: [
      { templateId: 'desk-drawers-1400', wall: 'south', offset: 0 },
      { templateId: 'bookcase-2sec-1200', wall: 'south', offset: 1400 },
    ],
  },
]

export function findSet(id: string): TemplateSet | undefined {
  return SEED_SETS.find((s) => s.id === id)
}

/**
 * Жиынтық → корпустар мен олардың орны.
 *
 * id-лер жиынтықтың ішінде БІРЕГЕЙ болуы керек: бір шаблон екі рет кірсе де
 * (мысалы екі тумба), олар бөлек корпус болып қалуы тиіс.
 */
export function setToProject(
  set: TemplateSet,
  catalog: Catalog,
): { cabinets: CabinetConfig[]; placements: Placement[] } {
  const cabinets: CabinetConfig[] = []
  const placements: Placement[] = []

  set.items.forEach((item, index) => {
    const template = findTemplate(item.templateId)
    if (!template) {
      throw new ConfigValidationError(
        `sets.${set.id}.items[${index}]`,
        `шаблон табылмады: "${item.templateId}"`,
      )
    }
    const id = `${set.id}-${index + 1}`
    cabinets.push({ ...templateToCabinet(template, catalog, item.size), id })
    placements.push({ cabinetId: id, wall: item.wall, offset: item.offset })
  })

  return { cabinets, placements }
}
