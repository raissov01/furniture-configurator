/**
 * «Не помещается» дегеннен КЕЙІНГІ сөз.
 *
 * Бұрын раскрой детальдің параққа сыймағанын айтатын да, сонымен тынатын.
 * Цех үшін бұл — тұйық: себебі белгілі, ал шешімі белгісіз. Ал шешім
 * әрқашан САНАЛАТЫН нәрсе: подрезканы азайту жететін бе, деталь тек
 * текстураға байланысты бұрылмай тұр ма, әлде басқа формат парақ керек пе.
 *
 * Сондықтан кеңес UI-да жазылмайды (әйтпесе экрандағы кеңес пен нақты есеп
 * ажырап кетер еді) — осында, ядрода, дәл сол сандардан шығады.
 */

import { SHEET_FORMATS } from './shop'
import type { NestingOptions, NestingResult } from './nesting'
import type { Catalog, Material, Panel } from './types'

export type UnplacedAdvice = {
  panelId: string
  label: string
  /** Рез өлшемі, мм — станок соны кеседі. */
  cutLength: number
  cutWidth: number
  materialId: string
  materialName: string
  /** Қазіргі подрезка, мм (бір жағына). */
  trimEdge: number
  /** Подрезкадан кейінгі пайдалы аймақ, мм. */
  usable: { width: number; height: number }
  /** Не істеу керек — ретімен, ең арзан жолдан бастап. */
  suggestions: string[]
}

/** Деталь берілген аймаққа сыя ма. Текстура бұрылуға тыйым салады. */
function fits(
  panel: { cutLength: number; cutWidth: number; grainAlongLength: boolean },
  material: Pick<Material, 'hasGrain'>,
  width: number,
  height: number,
  allowRotation = true,
): boolean {
  const along = panel.cutLength <= width && panel.cutWidth <= height
  const across = panel.cutWidth <= width && panel.cutLength <= height
  if (material.hasGrain && !allowRotation) {
    return panel.grainAlongLength ? along : across
  }
  return along || across
}

/**
 * Парақтың шетін ең көп дегенде қанша алуға болады, әрі деталь сонда сия ма.
 * `null` — подрезканы нөлге түсірсе де сыймайды.
 */
function maxTrimThatFits(panel: Panel, material: Material, current: number): number | null {
  for (let trim = 0; trim <= current; trim += 1) {
    const width = material.sheetWidth - trim * 2
    const height = material.sheetHeight - trim * 2
    if (!fits(panel, material, width, height, false)) {
      return trim === 0 ? null : trim - 1
    }
  }
  return current
}

function advise(panel: Panel, material: Material, trimEdge: number): string[] {
  const usableWidth = material.sheetWidth - trimEdge * 2
  const usableHeight = material.sheetHeight - trimEdge * 2
  const out: string[] = []

  // 1. Подрезка. Ең арзан жол: парақтың шетін аз алу.
  if (trimEdge > 0) {
    const room = maxTrimThatFits(panel, material, trimEdge)
    if (room !== null) {
      out.push(
        `уменьшить обрезку с ${trimEdge} до ${room} мм на сторону — этого хватит, ` +
        `деталь встанет на текущий лист`,
      )
    }
  }

  // 2. Текстура. Деталь бұрылса сияды, бірақ материал текстуралы деп белгіленген.
  const rotatedFits = fits(panel, material, usableWidth, usableHeight, true)
  const asIsFits = fits(panel, material, usableWidth, usableHeight, false)
  if (rotatedFits && !asIsFits) {
    out.push(
      `деталь встанет, если её повернуть, но материал помечен текстурным — ` +
      `снимите «текстура» у «${material.name}» (рисунок ЛДСП пойдёт поперёк) ` +
      `или возьмите лист другого формата`,
    )
  }

  // 3. Басқа формат парақ. Нақты форматты атаймыз — цех оны жеткізушіден сұрайды.
  const format = SHEET_FORMATS.find((f) =>
    fits(panel, material, f.width - trimEdge * 2, f.height - trimEdge * 2, false),
  )
  if (format) {
    out.push(
      `подойдёт формат ${format.label}: добавьте материал с таким листом ` +
      `в «Цех → Материалы» и назначьте его этой детали`,
    )
  }

  // 4. Ешқайсысы көмектеспесе — деталь стандарт парақтан ұзын.
  if (out.length === 0) {
    const longest = Math.max(panel.cutLength, panel.cutWidth)
    out.push(
      `деталь ${longest} мм длиннее любого стандартного листа: разделите корпус ` +
      `(например, стойку по высоте на две части со стыком) или заказывайте эту ` +
      `деталь у поставщика отдельно`,
    )
  }

  return out
}

/**
 * Сыймаған детальдардың әрқайсысына кеңес. Тізім бос болса — бәрі орналасқан.
 *
 * `options` — раскройға берілген БАП, әйтпесе кеңес басқа подрезкаға қарап
 * есептелер еді де, «азайтыңыз» дегені жалған шығар еді.
 */
export function unplacedAdvice(
  nesting: NestingResult,
  panels: Panel[],
  catalog: Catalog,
  options: NestingOptions = {},
): UnplacedAdvice[] {
  const byId = new Map(panels.map((p) => [p.id, p]))
  const materials = new Map(catalog.materials.map((m) => [m.id, m]))

  const out: UnplacedAdvice[] = []
  for (const item of nesting.unplaced) {
    const panel = byId.get(item.panelId)
    const material = panel ? materials.get(panel.materialId) : undefined
    if (!panel || !material) continue

    const trimEdge = options.trimEdge ?? material.trimEdge
    out.push({
      panelId: panel.id,
      label: item.label,
      cutLength: panel.cutLength,
      cutWidth: panel.cutWidth,
      materialId: material.id,
      materialName: material.name,
      trimEdge,
      usable: {
        width: material.sheetWidth - trimEdge * 2,
        height: material.sheetHeight - trimEdge * 2,
      },
      suggestions: advise(panel, material, trimEdge),
    })
  }
  return out
}
