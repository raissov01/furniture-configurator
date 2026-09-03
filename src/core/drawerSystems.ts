/**
 * НАПРАВЛЯЮЩАЛАРДЫҢ жүйелері.
 *
 * Ящиктің қорабы «жалпы ереже» бойынша жасалмайды: оның ені де, тереңдігі де,
 * бүйіріндегі тесіктері де НАПРАВЛЯЮЩАНЫҢ маркасына тікелей байланысты.
 * Бұрын бұл екіге бөлініп жүрген еді: саңылау `settings.drawerRunnerGap`-тан
 * (роликтінің 13 мм-і), ал тесіктер Blum Tandem-нің схемасынан алынатын.
 * Екеуі бір фурнитураға тиесілі болуы керек, сондықтан олар енді МІНДЕТТІ
 * түрде бір жерден — осы кестеден — шығады.
 *
 * ⚠ ДЕРЕККӨЗ ӘРҚАЙСЫСЫНДА ЖАЗЫЛҒАН. Цехтың фурнитурасы басқа болса, сандар
 * профильде түзетілуі керек: мұндағы шама — «әмбебап шындық» емес, ең жиі
 * кездесетін жүйенің паспорттық мәні.
 *
 * МЕТАЛЛ ЖӘШІКТЕР (LEGRABOX / TANDEMBOX / MERIVOBOX) — `METAL_BOX_SYSTEMS`.
 * Оларда қорап ЛДСП-дан жиналмайды: бүйірі — дайын металл, ал парақтан тек
 * ТҮБІ мен АРТ ҚАБЫРҒАСЫ кесіледі. Олардың өлшемі өндірушінің кестесінен
 * шығады, сондықтан ойдан жазылмады — qdesign-нің раскройынан ӨЛШЕНДІ
 * (2026-09-04, әр жүйе бойынша төменде жазулы).
 */

import { ConfigValidationError } from './errors'
import type { DrawerSystemId, MetalBoxSystemId } from './types'

export type { DrawerSystemId, MetalBoxSystemId }


/**
 * МЕТАЛЛ ЖӘШІК: парақтан тек түбі мен арт қабырғасы кесіледі.
 *
 * Барлық шама — АЛЫНАТЫН шегерім (мм):
 *   bottomWidthSub — түбінің ені   = ішкі ен NB − осы
 *   bottomDepthSub — түбінің тереңдігі = номиналды ұзындық NL − осы
 *   backWidthSub   — арт қабырғаның ені = NB − осы
 *   backHeight     — арт қабырғаның биіктігі, мм
 *
 * ⚠ ДЕРЕККӨЗІ мен ШЕГІ. Сандар qdesign-нің раскройынан бір ғана өлшемде
 * (NB = 868, NL = 450) алынды. Ені бойынша тәуелділік СЫЗЫҚТЫҚ деп
 * қабылданды — оны TANDEMBOX-тың мәні қуаттайды: NB − 75 мен NB − 87
 * Blum-ның жарияланған кестесімен дәлме-дәл сәйкес келеді.
 *
 * `backHeight` — БІР нүктеден алынған сан: биіктік класы өзгергенде ол да
 * өзгереді. Сондықтан цех оны `metalBoxBackHeight` арқылы өз кестесінен
 * қоя алады, ал әдепкісі — өлшенгені.
 */
export type MetalBoxSystem = {
  id: MetalBoxSystemId
  name: string
  nominalLengths: number[]
  bottomWidthSub: number
  bottomDepthSub: number
  backWidthSub: number
  backHeight: number
  /** Сметадағы артикул: бір ЖИЫНТЫҚ (бүйірлері + направляющасы). */
  hardwareId: string
  source: string
}

const MEASURED = 'qdesign раскройы, 2026-09-04, NB = 868 / NL = 450'

export const METAL_BOX_SYSTEMS: Record<MetalBoxSystemId, MetalBoxSystem> = {
  // түбі 440 × 833, арт қабырға 63 × 830
  legrabox: {
    id: 'legrabox',
    name: 'Blum LEGRABOX',
    nominalLengths: [250, 300, 350, 400, 450, 500, 550],
    bottomWidthSub: 35,
    bottomDepthSub: 10,
    backWidthSub: 38,
    backHeight: 63,
    hardwareId: 'box-legrabox',
    source: MEASURED,
  },
  // түбі 426 × 793, арт қабырға 84 × 781 (биіктік класы M — 90.5 мм)
  tandembox: {
    id: 'tandembox',
    name: 'Blum TANDEMBOX',
    nominalLengths: [250, 300, 350, 400, 450, 500, 550],
    bottomWidthSub: 75,
    bottomDepthSub: 24,
    backWidthSub: 87,
    backHeight: 84,
    hardwareId: 'box-tandembox',
    source: `${MEASURED}; биіктік класы M — 90.5 мм`,
  },
  // түбі 424 × 817, арт қабырға 83 × 817 (биіктік класы M — 83.6 мм)
  merivobox: {
    id: 'merivobox',
    name: 'Blum MERIVOBOX',
    nominalLengths: [250, 300, 350, 400, 450, 500, 550],
    bottomWidthSub: 51,
    bottomDepthSub: 26,
    backWidthSub: 51,
    backHeight: 83,
    hardwareId: 'box-merivobox',
    source: `${MEASURED}; биіктік класы M — 83.6 мм`,
  },
}

export function isMetalBoxSystem(id: string): id is MetalBoxSystemId {
  return id in METAL_BOX_SYSTEMS
}

export type DrawerSystem = {
  id: DrawerSystemId
  /** Экранда да, сметада да көрінетін атау. */
  name: string
  /**
   * Направляющая ӘР ЖАҚТАН алатын орын, мм. Қораптың ені = саңылау − 2 × осы.
   */
  sideClearance: number
  /**
   * Қораптың тереңдігі номиналды ұзындықтан осынша КЕМ, мм.
   *
   * Роликті мен шариктіде 0: направляющая қораптың бүйіріне бүкіл бойымен
   * бұралады, сондықтан қорап та сол ұзындықта. Ал ТАНДЕМ қораптың АСТЫНДА
   * жатады да, қорап одан сәл қысқа болады.
   */
  boxDepthSub: number
  /**
   * Номиналды ұзындықтар, мм. Направляющаны «қалаған ұзындықта» сатып алуға
   * болмайды: ол осы қатардан ғана болады, ал қораптың тереңдігі оған ДӘЛ
   * тең болуы керек.
   */
  nominalLengths: number[]
  /** Бүйірдегі бекіту нүктелері: қораптың алдыңғы жиегінен, мм. */
  holeOffsets: number[]
  holeDiameter: number
  holeDepth: number
  /** Сметадағы артикул: бір ЖҰП направляющая. */
  hardwareId: string
  /** Сан қайдан алынған — цех тексере алуы үшін. */
  source: string
}

export const DRAWER_SYSTEMS: Record<DrawerSystemId, DrawerSystem> = {
  /**
   * Роликті (телескопиялық) направляющая — ең арзаны әрі ең жиі кездесетіні.
   * Әр жақтан ДӘЛ 12.5 мм алады: бұл жүйенің өзгермейтін шамасы, сондықтан
   * қораптың ені саңылаудан әрқашан 25 мм кем.
   */
  roller: {
    id: 'roller',
    name: 'Роликовые (телескопические)',
    sideClearance: 12.5,
    boxDepthSub: 0,
    nominalLengths: [250, 300, 350, 400, 450, 500],
    // Роликтінің құлағы алдыңғы және артқы ұшында: пилот Ø5, бұранда 4×16.
    holeOffsets: [37],
    holeDiameter: 5,
    holeDepth: 12,
    hardwareId: 'runner-roller',
    source: 'Жүйенің стандарты: әр жақтан 12.5 мм, ұзындығы 50 мм қадаммен',
  },

  /**
   * Шарикті, ТОЛЫҚ шығатын. Ені 45 мм, әр жақтан сол 12.5 мм алады, бірақ
   * ұзындықтары 600 мм-ге дейін барады.
   */
  ball: {
    id: 'ball',
    name: 'Шариковые полного выдвижения',
    sideClearance: 12.5,
    boxDepthSub: 0,
    nominalLengths: [250, 300, 350, 400, 450, 500, 550, 600],
    holeOffsets: [37, 101],
    holeDiameter: 5,
    holeDepth: 12,
    hardwareId: 'runner-ball',
    source: 'Жүйенің стандарты: әр жақтан 12.5 мм',
  },

  /**
   * Blum TANDEM — қораптың АСТЫНА жасырылатын направляющая.
   *
   * Тесіктердің схемасы qdesign-нің CNC экспортынан ӨЛШЕНІП алынды
   * (2026-09-02, модуль 517 × 1540 × 298): алдыңғы жиектен 83 мм, сосын
   * 32 мм жүйесімен 64 + 64 + 32. Тесік — пилот Ø3 × 3.
   */
  tandem: {
    id: 'tandem',
    name: 'Blum TANDEM (скрытые)',
    /*
     * ⚠ ӨЛШЕНДІ (qdesign раскройы, 2026-09-04): ішкі ені 868 болғанда
     * қораптың қабырғалары 826, яғни сыртқы ені 826 + 2 × 16 = 858 —
     * саңылаудан бар болғаны 10 мм кем, әр жақтан 5.
     *
     * Бұрын мұнда 21 тұрған (Blum-ның «ішкі ен − 42» кестесінен алынған
     * болатын), ал ол ҚАТЕ еді: −42 деген қораптың ҚАБЫРҒАСЫНЫҢ ені, ал
     * ол екі бүйірдің АРАСЫНА кіреді. Тандем қораптың астында жатқандықтан,
     * қорап саңылауды толық дерлік алады.
     */
    sideClearance: 5,
    // Бүйірінің тереңдігі: NL 550 → 540 (өлшенді).
    boxDepthSub: 10,
    nominalLengths: [270, 300, 350, 400, 450, 500, 550, 600],
    holeOffsets: [83, 147, 211, 243],
    holeDiameter: 3,
    holeDepth: 3,
    hardwareId: 'runner-tandem',
    source: 'присадка: qdesign CNC экспорты 2026-09-02; өлшемдері: qdesign раскройы 2026-09-04',
  },
}

export function findDrawerSystem(id: string): DrawerSystem {
  if (isMetalBoxSystem(id)) {
    throw new ConfigValidationError(
      'drawerSystem', id,
      'металл жәшік — бөлек жол: findMetalBoxSystem() қара',
    )
  }
  const system = DRAWER_SYSTEMS[id as DrawerSystemId]
  if (!system) {
    throw new ConfigValidationError(
      'drawerSystem', id, Object.keys(DRAWER_SYSTEMS).join(' | '),
    )
  }
  return system
}

/**
 * Берілген орынға сыятын ЕҢ ҰЗЫН номиналды направляющая.
 *
 * ⚠ ТЕКСЕРІЛДІ (qdesign, 2026-09-03): оларда да солай — ящиктің «Глубина»
 * өрісі еркін сан емес, НОМИНАЛДЫ ұзындықтардың тізімі. Айырмасы: оларда
 * ұзындықты адам таңдайды, ал мұнда ол корпустың тереңдігінен өзі шығады.
 *
 * Сыятыны болмаса `null` — шақырушы жағы түсінікті қате береді.
 */
export function nominalRunnerLength(
  system: { nominalLengths: number[] },
  available: number,
): number | null {
  const fitting = system.nominalLengths.filter((length) => length <= available)
  return fitting.length > 0 ? Math.max(...fitting) : null
}

/**
 * Металл жәшіктің ЛДСП детальдері.
 *
 * `backHeight` берілсе, ол цехтың кестесінен алынған сан деп саналады да,
 * өлшенген әдепкіні басады.
 */
export function metalBoxParts(
  system: MetalBoxSystem,
  innerWidth: number,
  nominalLength: number,
  backHeight?: number,
): {
  bottom: { width: number; depth: number }
  back: { width: number; height: number }
} {
  return {
    bottom: {
      width: innerWidth - system.bottomWidthSub,
      depth: nominalLength - system.bottomDepthSub,
    },
    back: {
      width: innerWidth - system.backWidthSub,
      height: backHeight ?? system.backHeight,
    },
  }
}

export function findMetalBoxSystem(id: string): MetalBoxSystem {
  const system = METAL_BOX_SYSTEMS[id as MetalBoxSystemId]
  if (!system) {
    throw new ConfigValidationError(
      'drawerSystem', id, Object.keys(METAL_BOX_SYSTEMS).join(' | '),
    )
  }
  return system
}
