/**
 * Баға (§6).
 *
 * Әр жол ӨЗІН ТУДЫРҒАН ДЕТАЛЬДАРҒА дейін қадағаланады: цех «неге осынша»
 * дегенді көре алуы керек. Клиентке қорытынды, цехқа жіктеме.
 *
 * Ақша — ТИЫН, бүтін сан. Float ЕШҚАШАН: 0.1 + 0.2 ≠ 0.3, ал бұл ақша.
 * Бөлу тек соңында, дөңгелектеумен.
 */

import {
  CONFIRMAT_EDGE_DIAMETER,
  HINGE_CUP_DIAMETER,
} from './constants'
import type { HardwarePlacement } from './hardware'
import type { NestingResult } from './nesting'
import type { Panel } from './types'
import type { ShopProfile } from './shop'

export type PriceLine = {
  id: string
  name: string
  /** Саны: парақ / метр / дана / м² */
  qty: number
  unit: 'лист' | 'м' | 'шт' | 'м²' | 'отв'
  /** Бір бірліктің бағасы, тиын */
  unitPrice: number
  /** Жол сомасы, тиын */
  cost: number
}

export type PriceBreakdown = {
  materials: PriceLine[]
  edges: PriceLine[]
  hardware: PriceLine[]
  labour: PriceLine[]
  /** Үстемесіз сома, тиын */
  subtotal: number
  markupPercent: number
  /** Үстеме сомасы, тиын */
  markup: number
  /** Клиентке шығатын сан, тиын */
  total: number
  /**
   * Бағасы толтырылмаған позициялар. Бос болмаса — КП шығаруға БОЛМАЙДЫ:
   * ойдан жазылған баға клиентке кеткен ұсынысқа түседі.
   */
  missingPrices: string[]
}

/** Кромка жиегінің ұзындығы: L1/L2 — детальдің ұзындығы, W1/W2 — ені. */
export function edgeMetresByBand(panels: Panel[]): Map<string, number> {
  const mm = new Map<string, number>()
  for (const p of panels) {
    const sides: [keyof Panel['edges'], number][] = [
      ['L1', p.finishedLength],
      ['L2', p.finishedLength],
      ['W1', p.finishedWidth],
      ['W2', p.finishedWidth],
    ]
    for (const [side, length] of sides) {
      const spec = p.edges[side]
      if (!spec) continue
      mm.set(spec.bandId, (mm.get(spec.bandId) ?? 0) + length)
    }
  }
  const metres = new Map<string, number>()
  for (const [band, total] of mm) metres.set(band, total / 1000)
  return metres
}

/**
 * Фурнитура саны — присадкадан шығады, қолмен саналмайды.
 *
 * Конфирмат: ТОРЦТАҒЫ Ø7 тесік — бір бұранда. Беттегі Ø5 тесік сол
 * бұранданың екінші ұшы, оны қайта санауға болмайды.
 *
 * Полкодержатель: бір жылжымалы сөреде 4 дана (әр жағында 2). Тесік саны
 * бұдан көп — сөре жоғары-төмен жылжысын деп бірнеше қатар бұрғыланады,
 * бірақ сатып алынатыны 4-еу.
 */
export function countHardware(panels: Panel[]): Map<string, number> {
  const counts = new Map<string, number>()
  const add = (id: string, n: number) => counts.set(id, (counts.get(id) ?? 0) + n)

  let confirmats = 0
  let shelves = 0
  let drawerSides = 0
  /** Ілгек пен тұтқа брендке қарай әртүрлі позицияға түседі — id бойынша. */
  const byHardwareId = new Map<string, number>()
  const bump = (id: string) => byHardwareId.set(id, (byHardwareId.get(id) ?? 0) + 1)

  for (const p of panels) {
    if (p.role === 'shelf') shelves += 1
    if (p.role === 'drawerSide') drawerSides += 1
    for (const d of p.drilling) {
      if (d.purpose === 'confirmat' && d.diameter === CONFIRMAT_EDGE_DIAMETER) confirmats += 1
      // Чашка = бір ілгек. Планканың тесіктері сол ілгектің екінші ұшы,
      // оларды қайта санауға болмайды.
      if (d.purpose === 'hinge' && d.diameter === HINGE_CUP_DIAMETER) {
        bump(d.hardwareId ?? 'hinge-overlay')
      }
      // Тұтқа: скобаға екі тесік, кнопкаға бір. Тесік санынан тұтқа санын
      // шығару үшін ұзындығын білу керек, сондықтан ПАНЕЛЬМЕН санаймыз —
      // төменде.
    }
  }

  // Бір фасадта тұтқа біреу: тесік саны 1 де, 2 де болуы мүмкін.
  for (const p of panels) {
    const ids = new Set(
      p.drilling.filter((d) => d.purpose === 'handle').map((d) => d.hardwareId ?? 'handle-bar'),
    )
    for (const id of ids) bump(id)
  }

  if (confirmats > 0) {
    add('confirmat-7x50', confirmats)
    add('confirmat-cap', confirmats)
  }
  for (const [id, n] of byHardwareId) {
    add(id, n)
    // Әр ілгекке бір жауап планка.
    if (id.startsWith('hinge-')) add('hinge-plate', n)
  }
  if (shelves > 0) add('shelf-pin-5', shelves * 4)
  // Бір ящикте екі бүйір, ал направляющая ЖҰП болып сатылады: сондықтан
  // жиынтық саны = ящик саны, бүйір саны емес.
  if (drawerSides > 0) add('runner-roller-400', drawerSides / 2)

  return counts
}

/** Барлық бұрғылау тесігі — жұмыс ақысы осыған да байланады. */
export function countHoles(panels: Panel[]): number {
  return panels.reduce((sum, p) => sum + p.drilling.length, 0)
}

/** Детальдардың ГОТОВЫЙ ауданы, м². */
export function panelAreaSquareMetres(panels: Panel[]): number {
  const mm2 = panels.reduce((sum, p) => sum + p.finishedLength * p.finishedWidth, 0)
  return mm2 / 1_000_000
}

/**
 * Толық есеп. Материал бағасы РАСКРОЙДАН алынады — «ауданы бойынша» емес,
 * нақты қанша ПАРАҚ кеткені бойынша. Цех бүтін парақ сатып алады, қалдық
 * оның қалтасынан шығады.
 */
export function priceProject(
  panels: Panel[],
  nesting: NestingResult,
  shop: ShopProfile,
  /** Панель емес фурнитура: штанга, ұстағыш, рельс. */
  placements: HardwarePlacement[] = [],
): PriceBreakdown {
  const missingPrices: string[] = []

  const materialById = new Map(shop.materials.map((m) => [m.id, m]))
  const materials: PriceLine[] = nesting.byMaterial.map((group) => {
    const material = materialById.get(group.materialId)
    const unitPrice = material?.pricePerSheet ?? 0
    const qty = group.sheets.length
    if (unitPrice <= 0) missingPrices.push(`${group.materialName}: цена листа`)
    return {
      id: group.materialId,
      name: group.materialName,
      qty,
      unit: 'лист',
      unitPrice,
      cost: roundTenge(qty * unitPrice),
    }
  })

  const bandById = new Map(shop.edgeBands.map((b) => [b.id, b]))
  const edges: PriceLine[] = [...edgeMetresByBand(panels)]
    .map(([bandId, metres]) => {
      const band = bandById.get(bandId)
      const unitPrice = band?.pricePerMeter ?? 0
      if (unitPrice <= 0) missingPrices.push(`${band?.name ?? bandId}: цена за метр`)
      return {
        id: bandId,
        name: band?.name ?? bandId,
        qty: Math.round(metres * 100) / 100,
        unit: 'м' as const,
        unitPrice,
        cost: roundTenge(metres * unitPrice),
      }
    })
    .sort((a, b) => b.cost - a.cost)

  const hardwareById = new Map(shop.hardware.map((h) => [h.id, h]))
  const counts = countHardware(panels)
  // Штанга МЕТРМЕН сатылады, ұстағыш данамен — сондықтан бірі ұзындықтан,
  // екіншісі данадан жиналады.
  for (const item of placements) {
    // Техника сметаға ТҮСПЕЙДІ: оны клиент өзі алады, ал ойдан жазылған
    // баға клиентке кеткен КП-ға түсер еді.
    if (!item.priced) continue
    const add = item.length > 0 ? item.length / 1000 : item.qty
    counts.set(item.hardwareId, (counts.get(item.hardwareId) ?? 0) + add)
  }
  const hardware: PriceLine[] = [...counts]
    .map(([id, qty]) => {
      const item = hardwareById.get(id)
      const unitPrice = item?.pricePerUnit ?? 0
      if (unitPrice <= 0) missingPrices.push(`${item?.name ?? id}: цена за штуку`)
      return {
        id,
        name: item?.name ?? id,
        qty: Math.round(qty * 100) / 100,
        unit: (id === 'rod-25' || id === 'sliding-track' ? 'м' : 'шт') as 'м' | 'шт',
        unitPrice,
        cost: roundTenge(qty * unitPrice),
      }
    })
    .sort((a, b) => b.cost - a.cost)

  const area = panelAreaSquareMetres(panels)
  const holes = countHoles(panels)
  const edgeMetres = [...edgeMetresByBand(panels).values()].reduce((s, m) => s + m, 0)

  const labour: PriceLine[] = [
    {
      id: 'labour-area', name: 'Раскрой и обработка', qty: Math.round(area * 100) / 100,
      unit: 'м²' as const, unitPrice: shop.labour.perSquareMetre, cost: roundTenge(area * shop.labour.perSquareMetre),
    },
    {
      id: 'labour-holes', name: 'Присадка', qty: holes,
      unit: 'отв' as const, unitPrice: shop.labour.perHole, cost: roundTenge(holes * shop.labour.perHole),
    },
    {
      id: 'labour-edge', name: 'Кромление', qty: Math.round(edgeMetres * 100) / 100,
      unit: 'м' as const, unitPrice: shop.labour.perEdgeMetre, cost: roundTenge(edgeMetres * shop.labour.perEdgeMetre),
    },
  ].filter((line) => line.qty > 0)

  const subtotal =
    [...materials, ...edges, ...hardware, ...labour].reduce((sum, l) => sum + l.cost, 0)
  const markup = roundTenge((subtotal * shop.markupPercent) / 100)

  return {
    materials,
    edges,
    hardware,
    labour,
    subtotal,
    markupPercent: shop.markupPercent,
    markup,
    total: subtotal + markup,
    missingPrices,
  }
}

/**
 * Жол сомасын БҮТІН ТЕҢГЕГЕ дөңгелектеу.
 *
 * КП — клиент оқитын құжат, ал цех бағанды қолмен қосады. Егер әр жол
 * тиынмен сақталып, көрсету кезінде ғана дөңгелектенсе, баған қосындысы
 * қорытындымен 1–2 ₸ айырмашылық береді де, құжатқа сенім кетеді.
 * Сондықтан дөңгелектеу ЕСЕПТЕУ кезінде, бір рет жүреді.
 */
const roundTenge = (minor: number) => Math.round(minor / 100) * 100

/**
 * Тиынды теңгеге келтіріп, көрсетуге дайын жол қайтарады.
 *
 * `currency` неге параметр: PDF-тегі қаріп жиынтығында **₸ таңбасы жоқ** —
 * ол үнсіз түсіп қалады да, клиентке валютасы жоқ КП кетеді. Сондықтан
 * экранда «₸», ал PDF-те «тг» жазылады.
 */
export function formatTenge(minor: number, currency = '₸'): string {
  const tenge = Math.round(minor / 100)
  return `${tenge.toLocaleString('ru-RU')} ${currency}`
}
