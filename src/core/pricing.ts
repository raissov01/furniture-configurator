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
  HINGE_CUP_DIAMETER, MINIFIX_CAM_DIAMETER,
} from './constants'
import { ConfigValidationError } from './errors'
import type { HardwarePlacement } from './hardware'
import type { NestingResult } from './nesting'
import { isWidthBevel } from './types'
import { polygonArea } from './polygon'
import type { Discount, Panel, PriceOverrides } from './types'
import { SERVICE_IDS, SERVICE_NAMES } from './shop'
import type { ServiceId, ServiceRate, ShopProfile } from './shop'

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
  /** Осы позицияға берілген жеңілдік, тиын; жоқ болса 0. */
  discountAmount?: number | undefined
}

/**
 * Бір материалдың жолы — цехтың негізгі кестесі.
 *
 * ДӨҢГЕЛЕКТЕУ ОСЫ ЖЕРДЕ, БІР РЕТ жүреді: төмендегі `materials` / `edges` /
 * `services` жолдары дәл осы ұяшықтардың ҚОСЫНДЫСЫ болып жиналады.
 * Сондықтан цех қай бағанды қосса да, қорытынды тиынға дейін дәл шығады.
 */
export type MaterialRow = {
  materialId: string
  materialName: string
  /** Готовый ауданы, м² */
  areaSquareMetres: number
  sheets: number
  panels: number
  holes: number
  edgeMetres: number
  /** Парақтардың құны, тиын */
  materialCost: number
  /** Осы материалдың детальдарындағы кромканың құны, тиын */
  edgeCost: number
  /** Қызмет → сома, тиын */
  services: Record<ServiceId, number>
  /** Жолдың бәрі қосылғаны, тиын */
  total: number
}

export type PriceBreakdown = {
  materials: PriceLine[]
  edges: PriceLine[]
  hardware: PriceLine[]
  /** Цехтың қызметтері: распил, присадка, кромка, упаковка, сборка. */
  services: PriceLine[]
  /** Материал бойынша жіктеме — цех осы кестені оқиды. */
  byMaterial: MaterialRow[]

  /** Сатып алынатыны: материал + кромка + фурнитура, тиын */
  goods: number
  /** Қызметтердің сомасы, тиын */
  servicesTotal: number
  coefficient: number
  /** Коэффициент ҚОСҚАН сома (base × (k − 1)), тиын */
  coefficientAmount: number
  installation: { metres: number; rate: number; cost: number }

  /** Үстемесіз сома, тиын */
  subtotal: number
  markupPercent: number
  /** Үстеме сомасы, тиын */
  markup: number
  /**
   * Коэффициенттен шыққан сома (subtotal + markup), qdesign-дегі «Алдын ала
   * сату бағасы». `priceOverrides.salePrice` берілсе де ӨЗГЕРМЕЙДІ — шебер
   * кез келген сәтте override-ты алып тастап, осыған қайта орала алады.
   */
  calculatedTotal: number
  /**
   * Қолмен қойылған сату бағасы, тиын (`priceOverrides.salePrice`-тен,
   * дөңгелектеусіз, тура сол сома). Берілмесе — undefined.
   */
  salePriceOverride?: number | undefined
  /** Жеңілдікке дейінгі ВСЕГО: қолмен сату бағасы болса сол, болмаса есептелген баға. */
  grossTotal: number
  /** Барлық жеке позиция жеңілдігінің қосындысы, тиын. */
  lineDiscountTotal: number
  /** Жалпы жеңілдік, жеке позициялар шегерілгеннен кейін есептеледі. */
  overallDiscountAmount: number
  /** СКИДКА ВСЕГО, тиын. */
  discountTotal: number
  /**
   * К ОПЛАТЕ, тиын: `grossTotal`-дан барлық жеңілдіктер шегеріледі.
   */
  total: number
  /**
   * Бағасы толтырылмаған позициялар. Бос болмаса — КП шығаруға БОЛМАЙДЫ:
   * ойдан жазылған баға клиентке кеткен ұсынысқа түседі.
   */
  missingPrices: string[]
}

/**
 * Жиектің НАҒЫЗ ұзындығы, кромка есебі үшін. Әдетте L1/L2 = `finishedLength`,
 * W1/W2 = `finishedWidth` — бірақ ЕН бойынша қиғаш (`PanelBevel`
 * `widthAtStart`/`widthAtEnd`, бұрыштық корпустың дно/крышка/сөресі) панельде
 * бір ұзын жиек ТІК ЕМЕС, ГИПОТЕНУЗА (audit C10,
 * docs/audit/corner-2026-09-20.md): `finishedLength`-ті тура алса, әр жатық
 * детальде кромка шамамен 9% кем есептеледі — ақша ғана емес, материал
 * тапсырысы да сол саннан шығады.
 *
 * Қай жиек диагональ екені `alignWidth`-пен анықталады: 'end' — арты (L2)
 * тураланып тік қалады (мыс. қабырғаға тіреледі), алды (L1) диагональ;
 * 'start' — керісінше. Тек ЕН бойынша қиғаш әсер етеді — ҰЗЫНДЫҚ бойынша
 * қиғаш (мансард бүйірі, `lengthAtStart`/`lengthAtEnd`) W1/W2-ге тиеді, бұл
 * жерде әдейі қаралмайды (C10 тек L1/L2-ні түзетеді).
 */
function edgeLength(p: Panel, side: keyof Panel['edges']): number {
  const b = p.bevel
  if (b && isWidthBevel(b)) {
    if (side === 'W1') return b.widthAtStart
    if (side === 'W2') return b.widthAtEnd
  }
  if (b && isWidthBevel(b) && (side === 'L1' || side === 'L2')) {
    const diagonalSide = b.alignWidth === 'end' ? 'L1' : 'L2'
    if (side === diagonalSide) {
      const rise = Math.abs(b.widthAtEnd - b.widthAtStart)
      return Math.round(Math.sqrt(p.finishedLength ** 2 + rise ** 2))
    }
  }
  return side === 'L1' || side === 'L2' ? p.finishedLength : p.finishedWidth
}

/** Кромка жиегінің ұзындығы: L1/L2 — детальдің ұзындығы, W1/W2 — ені. */
export function edgeMetresByBand(panels: Panel[]): Map<string, number> {
  const mm = new Map<string, number>()
  for (const p of panels) {
    if (p.contour) {
      for (const [i, start] of p.contour.points.entries()) {
        const spec = p.contour.bands[i]
        if (!spec) continue
        const end = p.contour.points[(i + 1) % p.contour.points.length]!
        const length = Math.hypot(end.x - start.x, end.y - start.y)
        mm.set(spec.bandId, (mm.get(spec.bandId) ?? 0) + length * p.qty)
      }
      continue
    }
    const sides: [keyof Panel['edges'], number][] = [
      ['L1', edgeLength(p, 'L1')],
      ['L2', edgeLength(p, 'L2')],
      ['W1', edgeLength(p, 'W1')],
      ['W2', edgeLength(p, 'W2')],
    ]
    for (const [side, length] of sides) {
      const spec = p.edges[side]
      if (!spec) continue
      mm.set(spec.bandId, (mm.get(spec.bandId) ?? 0) + length * p.qty)
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
  /** Минификс: бір стяжка = ұя + штифт + бұранда, сондықтан ҰЯМЕН саналады. */
  let minifixes = 0
  let shelves = 0
  let drawerSides = 0
  /** Ілгек пен тұтқа брендке қарай әртүрлі позицияға түседі — id бойынша. */
  const byHardwareId = new Map<string, number>()
  const bump = (id: string, qty: number) => byHardwareId.set(id, (byHardwareId.get(id) ?? 0) + qty)

  for (const p of panels) {
    if (p.role === 'shelf' && p.shelfKind === 'adjustable') shelves += p.qty
    if (p.role === 'drawerSide') drawerSides += p.qty
    for (const d of p.drilling) {
      /*
       * Бір конфирмат — ЕКІ тесік: беттегі өтпелі мен ТОРЦТАҒЫ пилот.
       * Санағанда ТОРЦТАҒЫСЫН аламыз: диаметрге қарау сынғыш болатын
       * (диаметрлер 2026-09-02-де ауысты), ал беті-торцы ешқашан ауыспайды.
       */
      if (d.purpose === 'confirmat' && d.face.startsWith('edge')) confirmats += p.qty
      // Эксцентриктің ҰЯСЫ — бір стяжка. Штифт пен бұранданың тесіктері сол
      // стяжканың басқа бөліктері, оларды қайта санауға болмайды.
      if (d.purpose === 'minifix' && d.diameter === MINIFIX_CAM_DIAMETER) minifixes += p.qty
      // Чашка = бір ілгек. Планканың тесіктері сол ілгектің екінші ұшы,
      // оларды қайта санауға болмайды.
      if (d.purpose === 'hinge' && d.diameter === HINGE_CUP_DIAMETER) {
        bump(d.hardwareId ?? 'hinge-overlay', p.qty)
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
    for (const id of ids) bump(id, p.qty)
  }

  if (confirmats > 0) {
    add('confirmat-7x50', confirmats)
    add('confirmat-cap', confirmats)
  }
  if (minifixes > 0) add('minifix-15', minifixes)
  for (const [id, n] of byHardwareId) {
    add(id, n)
    // Әр ілгекке бір жауап планка.
    if (id.startsWith('hinge-')) add('hinge-plate', n)
  }
  if (shelves > 0 && panels.some((p) => p.drilling.some((d) => d.purpose === 'shelfPin'))) {
    add('shelf-pin-5', shelves * 4)
  }
  /*
   * Көтергіш механизм: оның присадкасы ЖОҚ (шаблон бойынша бұрғыланады),
   * сондықтан ол тесіктен емес, ФАСАДТЫҢ ӨЗІНЕН саналады.
   */
  const flaps = panels.reduce((sum, p) => sum + (p.opening?.kind === 'flap' ? p.qty : 0), 0)
  if (flaps > 0) add('lift-flap', flaps)
  // Бір ящикте екі бүйір, ал направляющая ЖҰП болып сатылады: сондықтан
  // жиынтық саны = ящик саны, бүйір саны емес.
  //
  // Артикулы тесіктен алынады: жүйе таңдалса, ол сол жердегі `hardwareId`-де
  // жазулы тұр. Таңдалмаса — ескі әдепкі, себебі бұрынғы жобаның сметасы
  // өзгермеуі керек.
  if (drawerSides > 0) {
    const runnerId = panels
      .flatMap((p) => p.drilling)
      .find((d) => d.purpose === 'runner' && d.hardwareId)?.hardwareId
    add(runnerId ?? 'runner-roller-400', drawerSides / 2)
  }

  return counts
}

/** Барлық бұрғылау тесігі — жұмыс ақысы осыған да байланады. */
export function countHoles(panels: Panel[]): number {
  return panels.reduce((sum, p) => sum + p.drilling.length * p.qty, 0)
}

/** Детальдардың ГОТОВЫЙ ауданы, м². */
export function panelAreaSquareMetres(panels: Panel[]): number {
  const mm2 = panels.reduce((sum, p) => sum +
    (p.contour ? polygonArea(p.contour.points) : p.finishedLength * p.finishedWidth) * p.qty, 0)
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
  /** Монтаж үшін: корпустардың ені, мм. Бос болса монтаж есептелмейді. */
  moduleWidths: number[] = [],
  /**
   * Жобаның баға түзетулері (qdesign паритеті): коэффициент пен сату
   * бағасын осы жобаға ғана ауыстыру. Ешбірі берілмесе — цехтың
   * әдепкісімен, бұрынғыдай.
   */
  overrides?: PriceOverrides,
): PriceBreakdown {
  if (nesting.unplaced.length > 0) {
    throw new ConfigValidationError(
      'nesting.unplaced',
      `раскройға сыймаған деталь: ${nesting.unplaced.map((part) => part.panelId).join(', ')}`,
      'барлық деталь параққа сыйсын',
    )
  }
  const missingPrices: string[] = []

  const materialById = new Map(shop.materials.map((m) => [m.id, m]))
  const bandById = new Map(shop.edgeBands.map((b) => [b.id, b]))

  // ── Материал бойынша статистика ───────────────────────────────────────────
  // Әр материалдың ауданы, детальдары, тесіктері мен кромкасы. Қызметтің
  // қайсысы неге қарап саналатыны цех баптауында, сондықтан бәрін жинаймыз.
  type Stats = {
    area: number
    panels: number
    holes: number
    /** bandId → метр */
    edges: Map<string, number>
    /** Детальдердің ұзындығының қосындысы, м — ТАҚТА (постформинг) метрмен сатылады. */
    lengthMetres: number
  }
  const stats = new Map<string, Stats>()
  const statFor = (id: string): Stats => {
    let v = stats.get(id)
    if (!v) {
      v = { area: 0, panels: 0, holes: 0, edges: new Map(), lengthMetres: 0 }
      stats.set(id, v)
    }
    return v
  }

  for (const p of panels) {
    const st = statFor(p.materialId)
    st.area += (p.contour ? polygonArea(p.contour.points) : p.finishedLength * p.finishedWidth) * p.qty / 1_000_000
    st.lengthMetres += Math.max(p.finishedLength, p.finishedWidth) * p.qty / 1000
    st.panels += p.qty
    st.holes += p.drilling.length * p.qty
    if (p.contour) {
      for (const [i, start] of p.contour.points.entries()) {
        const spec = p.contour.bands[i]
        if (!spec) continue
        const end = p.contour.points[(i + 1) % p.contour.points.length]!
        const metres = Math.hypot(end.x - start.x, end.y - start.y) * p.qty / 1000
        st.edges.set(spec.bandId, (st.edges.get(spec.bandId) ?? 0) + metres)
      }
      continue
    }
    const sides: [keyof Panel['edges'], number][] = [
      ['L1', edgeLength(p, 'L1')], ['L2', edgeLength(p, 'L2')],
      ['W1', edgeLength(p, 'W1')], ['W2', edgeLength(p, 'W2')],
    ]
    for (const [side, length] of sides) {
      const spec = p.edges[side]
      if (!spec) continue
      st.edges.set(spec.bandId, (st.edges.get(spec.bandId) ?? 0) + length * p.qty / 1000)
    }
  }

  const sheetsByMaterial = new Map(nesting.byMaterial.map((g) => [g.materialId, g.sheets.length]))
  const nameByMaterial = new Map(nesting.byMaterial.map((g) => [g.materialId, g.materialName]))

  /** Қызметтің осы материалдағы саны — негізіне қарай. */
  const serviceQty = (rate: ServiceRate, id: string, st: Stats): number => {
    switch (rate.basis) {
      case 'sheet': return sheetsByMaterial.get(id) ?? 0
      case 'squareMetre': return st.area
      case 'hole': return st.holes
      case 'panel': return st.panels
      case 'edgeMetre': return [...st.edges.values()].reduce((sum, m) => sum + m, 0)
    }
  }

  // ── Ұяшықтар: дөңгелектеу ТЕК осы жерде ───────────────────────────────────
  /** materialId → bandId → тиын */
  const edgeCells = new Map<string, Map<string, number>>()
  const materialRows: MaterialRow[] = []

  const materialIds = [...new Set([...stats.keys(), ...sheetsByMaterial.keys()])]
  for (const id of materialIds) {
    const st = statFor(id)
    const material = materialById.get(id)
    const name = material?.name ?? nameByMaterial.get(id) ?? id
    const sheets = sheetsByMaterial.get(id) ?? 0

    /*
     * ТАҚТА (постформинг столешница) парақпен емес, МЕТРМЕН сатылады: ол
     * раскройға кірмейді (`sheets` = 0), ал құны — детальдердің ұзындығы ×
     * метрдің бағасы (пайдаланушы, 09-13).
     */
    const slab = material?.slab
    const sheetPrice = material?.pricePerSheet ?? 0
    if (!slab && sheets > 0 && sheetPrice <= 0) missingPrices.push(`${name}: цена листа`)
    if (slab && st.lengthMetres > 0 && slab.pricePerMeter <= 0) missingPrices.push(`${name}: цена за метр`)
    const materialCost = slab
      ? roundMinor(st.lengthMetres * slab.pricePerMeter)
      : roundMinor(sheets * sheetPrice)

    const cells = new Map<string, number>()
    let edgeCost = 0
    for (const [bandId, metres] of st.edges) {
      const band = bandById.get(bandId)
      const price = band?.pricePerMeter ?? 0
      if (price <= 0) missingPrices.push(`${band?.name ?? bandId}: цена за метр`)
      const cell = roundMinor(metres * price)
      cells.set(bandId, cell)
      edgeCost += cell
    }
    edgeCells.set(id, cells)

    const services = {} as Record<ServiceId, number>
    for (const sid of SERVICE_IDS) {
      const rate = shop.services[sid]
      services[sid] = roundMinor(serviceQty(rate, id, st) * rate.rate)
    }

    const servicesSum = SERVICE_IDS.reduce((sum, sid) => sum + services[sid], 0)
    materialRows.push({
      materialId: id,
      materialName: name,
      areaSquareMetres: Math.round(st.area * 100) / 100,
      sheets,
      panels: st.panels,
      holes: st.holes,
      edgeMetres: Math.round([...st.edges.values()].reduce((s2, m) => s2 + m, 0) * 100) / 100,
      materialCost,
      edgeCost,
      services,
      total: materialCost + edgeCost + servicesSum,
    })
  }
  materialRows.sort((a, b) => b.total - a.total)

  // ── Жолдар: ұяшықтардың ҚОСЫНДЫСЫ ─────────────────────────────────────────
  const materials: PriceLine[] = materialRows
    .filter((r) => r.sheets > 0)
    .map((r): PriceLine => ({
      id: r.materialId,
      name: r.materialName,
      qty: r.sheets,
      unit: 'лист' as const,
      unitPrice: materialById.get(r.materialId)?.pricePerSheet ?? 0,
      cost: r.materialCost,
    }))
    // Тақта (постформинг) — метрмен: раскройда парағы жоқ, сондықтан бөлек жол.
    .concat(materialRows
      .filter((r) => materialById.get(r.materialId)?.slab && statFor(r.materialId).lengthMetres > 0)
      .map((r) => ({
        id: r.materialId,
        name: r.materialName,
        qty: Math.round(statFor(r.materialId).lengthMetres * 100) / 100,
        unit: 'м' as const,
        unitPrice: materialById.get(r.materialId)?.slab?.pricePerMeter ?? 0,
        cost: r.materialCost,
      })))

  const edgeMetresTotal = new Map<string, number>()
  const edgeCostTotal = new Map<string, number>()
  for (const [materialId, cells] of edgeCells) {
    const st = statFor(materialId)
    for (const [bandId, cost] of cells) {
      edgeCostTotal.set(bandId, (edgeCostTotal.get(bandId) ?? 0) + cost)
      edgeMetresTotal.set(bandId, (edgeMetresTotal.get(bandId) ?? 0) + (st.edges.get(bandId) ?? 0))
    }
  }
  const edges: PriceLine[] = [...edgeCostTotal]
    .map(([bandId, cost]) => ({
      id: bandId,
      name: bandById.get(bandId)?.name ?? bandId,
      qty: Math.round((edgeMetresTotal.get(bandId) ?? 0) * 100) / 100,
      unit: 'м' as const,
      unitPrice: bandById.get(bandId)?.pricePerMeter ?? 0,
      cost,
    }))
    .sort((a, b) => b.cost - a.cost)

  const services: PriceLine[] = SERVICE_IDS
    .map((sid) => {
      const rate = shop.services[sid]
      const qty = materialIds.reduce((sum, id) => sum + serviceQty(rate, id, statFor(id)), 0)
      const cost = materialRows.reduce((sum, r) => sum + r.services[sid], 0)
      return {
        id: `service-${sid}`,
        name: SERVICE_NAMES[sid],
        qty: Math.round(qty * 100) / 100,
        unit: SERVICE_UNITS[rate.basis],
        unitPrice: rate.rate,
        cost,
      }
    })
    .filter((line) => line.qty > 0 && line.unitPrice > 0)

  // ── Фурнитура ─────────────────────────────────────────────────────────────
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
      const unit: PriceLine['unit'] = id === 'rod-25' || id === 'sliding-track' ? 'м' : 'шт'
      if (unitPrice <= 0) missingPrices.push(`${item?.name ?? id}: цена за штуку`)
      return {
        id,
        name: item?.name ?? id,
        // Ұзындық бүтін миллиметрмен жиналады: метрде 3 таңбаны сақтау
        // жолдың көрсетілген саны мен дәл есептелген сомасын сәйкестендіреді.
        qty: unit === 'м' ? Math.round(qty * 1000) / 1000 : Math.round(qty * 100) / 100,
        unit,
        unitPrice,
        cost: roundMinor(qty * unitPrice),
      }
    })
    .sort((a, b) => b.cost - a.cost)

  // ── Қорытынды ─────────────────────────────────────────────────────────────
  //
  // РЕТІ МАҢЫЗДЫ, ол ақшаны өзгертеді:
  //   goods + services            — цехтың өз шығыны
  //   × coefficient               — цехтың өз түзетуі (тек шығынға),
  //                                  ЖОБА деңгейінде overrides.coefficient
  //                                  алмастыра алады (qdesign паритеті)
  //   + монтаж                    — БӨЛЕК қызмет, коэффициентке кірмейді
  //   + үстеме %                  — бәрінің үстінен
  //   → calculatedTotal           — коэффициенттен шыққан СОҢҒЫ сома
  //   overrides.salePrice бар ма  — болса, жеңілдікке дейінгі grossTotal;
  //                                  calculatedTotal бұзылмайды
  //   жолдық жеңілдіктер          — әр PriceLine.cost бойынша
  //   жалпы жеңілдік             — grossTotal − жолдық жеңілдік бойынша
  const goods =
    materials.reduce((sum, l) => sum + l.cost, 0)
    + edges.reduce((sum, l) => sum + l.cost, 0)
    + hardware.reduce((sum, l) => sum + l.cost, 0)
  const servicesTotal = services.reduce((sum, l) => sum + l.cost, 0)

  const base = goods + servicesTotal
  /*
   * Цех коэффициенті (ShopProfile.coefficient) жарамсыз болса — үнсіз 1-ге
   * теңеледі (ескі мінез, шебер профильді толтырмай қалдырса да жоба
   * бұзылмауы керек). Ал ЖОБА деңгейіндегі override басқаша: ол — қолмен
   * арнайы осы жобаға қойылған сан, сондықтан жарамсыз мән ҮНСІЗ түзетілмей,
   * `ConfigValidationError` лақтырады (§10, `validatePriceOverrides`).
   */
  validatePriceOverrides(overrides)
  const coefficient = overrides?.coefficient ?? (shop.coefficient > 0 ? shop.coefficient : 1)
  const coefficientAmount = roundMinor(base * (coefficient - 1))

  const metres = moduleWidths.reduce((sum, w) => sum + w, 0) / 1000
  const installationCost = roundMinor(metres * shop.installation.ratePerMetreWidth)

  const subtotal = base + coefficientAmount + installationCost
  const markup = roundMinor((subtotal * shop.markupPercent) / 100)
  /** Коэффициенттен шыққан сома — qdesign-дегі «Алдын ала сату бағасы». */
  const calculatedTotal = subtotal + markup
  /**
   * Қолмен қойылған сату бағасы (qdesign-дегі «Сату бағасы») коэффициенттен
   * шыққан жалпы бағаны БАСЫП ЖАЗАДЫ, бірақ `calculatedTotal` өзгеріссіз қалады —
   * шебер override-ты алып тастап, коэффициентке қайта орала алады.
   */
  const grossTotal = overrides?.salePrice ?? calculatedTotal
  const groups = { materials, edges, hardware, services }
  const lineLookup = new Map<string, PriceLine>()
  for (const [group, lines] of Object.entries(groups)) {
    for (const line of lines) lineLookup.set(`${group}:${line.id}`, line)
  }
  const lineDiscountAmounts = new Map<string, number>()
  for (const [key, discount] of Object.entries(overrides?.lineDiscounts ?? {})) {
    const line = lineLookup.get(key)
    const field = `priceOverrides.lineDiscounts.${key}`
    if (!line) throw new ConfigValidationError(field, 'позиция табылмады', 'бар позиция кілті')
    lineDiscountAmounts.set(key, discountAmount(discount, line.cost, field))
  }
  const withDiscounts = (group: keyof typeof groups): PriceLine[] => groups[group].map((line) => ({
    ...line,
    discountAmount: lineDiscountAmounts.get(`${group}:${line.id}`) ?? 0,
  }))
  const lineDiscountTotal = [...lineDiscountAmounts.values()].reduce((sum, amount) => sum + amount, 0)
  const remaining = grossTotal - lineDiscountTotal
  if (remaining < 0) {
    throw new ConfigValidationError(
      'priceOverrides.lineDiscounts', 'жиынтық жеңілдік сату бағасынан көп', `0..${grossTotal} тиын`,
    )
  }
  const overallDiscountAmount = overrides?.overallDiscount
    ? discountAmount(overrides.overallDiscount, remaining, 'priceOverrides.overallDiscount')
    : 0
  const discountTotal = lineDiscountTotal + overallDiscountAmount
  const total = grossTotal - discountTotal

  return {
    materials: withDiscounts('materials'),
    edges: withDiscounts('edges'),
    hardware: withDiscounts('hardware'),
    services: withDiscounts('services'),
    byMaterial: materialRows,
    goods,
    servicesTotal,
    coefficient,
    coefficientAmount,
    installation: {
      metres: Math.round(metres * 100) / 100,
      rate: shop.installation.ratePerMetreWidth,
      cost: installationCost,
    },
    subtotal,
    markupPercent: shop.markupPercent,
    markup,
    calculatedTotal,
    salePriceOverride: overrides?.salePrice,
    grossTotal,
    lineDiscountTotal,
    overallDiscountAmount,
    discountTotal,
    total,
    missingPrices,
  }
}

/**
 * DISCOUNT_ROUNDING_RULE: әр пайыздық жеңілдікті оның өз позициясында ең жақын
 * БҮТІН ТИЫНҒА дөңгелектейміз; дәл жарты тиын жоғары дөңгелектенеді.
 * Жалпы пайыз жолдық жеңілдіктерден кейін қалған сомаға бір рет қолданылады.
 * Сомалық жеңілдік ешқашан дөңгелектелмейді.
 */
export const DISCOUNT_ROUNDING_RULE = 'nearestMinorUnitHalfUp' as const

export function discountAmount(discount: Discount, base: number, field: string): number {
  if (!Number.isSafeInteger(base) || base < 0) {
    throw new ConfigValidationError(field, `${base} — есептеу негізі жарамсыз`, '0..MAX_SAFE_INTEGER тиын')
  }
  if (discount.kind === 'percent') {
    if (!Number.isFinite(discount.value) || discount.value < 0 || discount.value > 100) {
      throw new ConfigValidationError(field, `${discount.value} — жарамсыз пайыз`, '0..100 %')
    }
    // Number көбейтуі 28.5-ті 28.499999... қыла алады (5000 × 0.57%).
    // Коэффициенттің ондық жазбасын дәл бөлшекке айналдырамыз; ақшаға
    // қатысты аралық есеп те бүтін BigInt күйінде қалады.
    const [mantissa, exponentText = '0'] = discount.value.toString().split('e')
    const [whole, fraction = ''] = mantissa!.split('.')
    const numerator = BigInt(`${whole}${fraction}`)
    const decimalPlaces = fraction.length - Number(exponentText)
    const scale = 10n ** BigInt(Math.abs(decimalPlaces))
    const product = BigInt(base) * numerator * (decimalPlaces < 0 ? scale : 1n)
    const denominator = 100n * (decimalPlaces > 0 ? scale : 1n)
    return Number((2n * product + denominator) / (2n * denominator))
  }
  if (!Number.isSafeInteger(discount.value) || discount.value < 0 || discount.value > base) {
    throw new ConfigValidationError(field, `${discount.value} — жарамсыз сома`, `≥ 0, бүтін тиын, ≤ ${base} тиын`)
  }
  return discount.value
}

/**
 * Баға түзетулерін тексереді: теріс не нөл коэффициент, теріс не бүтін
 * тиын емес сату бағасы — бәрі ойдан жазылған баға сияқты қате, cоны
 * бүркемей лақтырамыз (CLAUDE.md §10: silent catch жоқ).
 *
 * Коэффициент БҮТІН болуға міндетті ЕМЕС (2, 2.5, 3 — цехтың өз еселігі,
 * ақша емес, қатынас), тек 0-ден үлкен болуы керек. Сату бағасы — АҚША,
 * сондықтан бүтін тиын (§0.2).
 */
function validatePriceOverrides(overrides: PriceOverrides | undefined): void {
  if (!overrides) return
  if (overrides.coefficient !== undefined) {
    const { coefficient } = overrides
    if (!Number.isFinite(coefficient) || coefficient <= 0) {
      throw new ConfigValidationError(
        'priceOverrides.coefficient', `${coefficient} — нөл немесе теріс`, '> 0',
      )
    }
  }
  if (overrides.salePrice !== undefined) {
    const { salePrice } = overrides
    if (!Number.isSafeInteger(salePrice) || salePrice < 0) {
      throw new ConfigValidationError(
        'priceOverrides.salePrice', `${salePrice} — теріс немесе бүтін тиын емес`, '≥ 0, бүтін тиын',
      )
    }
  }
}

/**
 * КП-дағы қорытынды блогының қалай шығатынын анықтайды (§6: «клиентке
 * қорытынды, цехқа жіктеме»).
 *
 * `salePriceOverride` берілген жобада өзіндік құн мен коэффициент КЛИЕНТКЕ
 * КӨРІНБЕУІ керек (qdesign-дың «Предложение клиенту» нұсқасында олар жоқ,
 * тек келісілген ВСЕГО/СКИДКА/К ОПЛАТЕ бар) — себестоимость/наценка енді `total`-мен сәйкес
 * келмейді (қолмен басып жазылған сан коэффициенттен өзгеше болуы мүмкін),
 * ал цехтың ӨЗ есебінде (`QuoteView.tsx`-тегі «Стоимость» қойындысы) бұл
 * жіктеме әрдайым толық көрінеді — тек КЛИЕНТКЕ шығатын құжатта жасырылады.
 */
export function quoteTotalsView(price: PriceBreakdown):
  | { kind: 'breakdown'; subtotal: number; markupPercent: number; markup: number; grossTotal: number; discount: number; total: number }
  | { kind: 'finalOnly'; grossTotal: number; discount: number; total: number } {
  if (price.salePriceOverride !== undefined) return {
    kind: 'finalOnly', grossTotal: price.grossTotal, discount: price.discountTotal, total: price.total,
  }
  return {
    kind: 'breakdown',
    subtotal: price.subtotal,
    markupPercent: price.markupPercent,
    markup: price.markup,
    grossTotal: price.grossTotal,
    discount: price.discountTotal,
    total: price.total,
  }
}

/**
 * Клиент КП-сының позициялары. Қолмен сату бағасы қойылса, жолдардағы
 * материал/қызмет сомалары цехтың шығынын ашады және түпкі бағамен
 * келіспейді; сондықтан клиентке тек келісілген қорытынды шығады.
 */
export function quoteLineGroups(price: PriceBreakdown): { title: string; lines: PriceLine[] }[] {
  if (price.salePriceOverride !== undefined) return []
  return [
    { title: 'Материалы', lines: price.materials },
    { title: 'Кромка', lines: price.edges },
    { title: 'Фурнитура', lines: price.hardware },
    { title: 'Услуги цеха', lines: price.services },
  ]
}

/** Қызметтің негізіне сай өлшем бірлігі. */
const SERVICE_UNITS: Record<ServiceRate['basis'], PriceLine['unit']> = {
  sheet: 'лист',
  squareMetre: 'м²',
  hole: 'отв',
  edgeMetre: 'м',
  panel: 'шт',
}

/**
 * Жол сомасын БҮТІН ТИЫНҒА дөңгелектеу.
 *
 * КП — клиент оқитын құжат, ал цех бағанды қолмен қосады. Егер әр жол
 * Есептеу ұяшықтары тиынға дейін сақталады; көрсету де осы дәлдікте болады.
 */
const roundMinor = (minor: number) => Math.round(minor)

/**
 * Тиынды теңгеге келтіріп, көрсетуге дайын жол қайтарады.
 *
 * `currency` неге параметр: PDF-тегі қаріп жиынтығында **₸ таңбасы жоқ** —
 * ол үнсіз түсіп қалады да, клиентке валютасы жоқ КП кетеді. Сондықтан
 * экранда «₸», ал PDF-те «тг» жазылады.
 */
export function formatTenge(minor: number, currency = '₸'): string {
  return formatTengeExact(minor, currency)
}

/** Жеңілдік тиынмен аяқталғанда құжатта сол тиынды жоғалтпай көрсетеді. */
export function formatTengeExact(minor: number, currency = '₸'): string {
  const sign = minor < 0 ? '−' : ''
  const absolute = Math.abs(minor)
  const tenge = Math.floor(absolute / 100).toLocaleString('ru-RU')
  const tiyn = absolute % 100
  return `${sign}${tenge}${tiyn ? `,${String(tiyn).padStart(2, '0')}` : ''} ${currency}`
}
