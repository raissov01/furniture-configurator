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
 * НЕЛІКТЕН МЕТАЛЛ ЖӘШІКТЕР (LEGRABOX / TANDEMBOX / MERIVOBOX) МҰНДА ЖОҚ.
 * Оларда қорап ЛДСП-дан жиналмайды: бүйірі — дайын металл, ал парақтан тек
 * түбі мен арт қабырғасы кесіледі, әрі олардың өлшемі өндірушінің кестесінен
 * алынады. Ол кестені ойдан жазуға болмайды — қате сан цехта ғана байқалады
 * әрі дайын жиһазды бүлдіреді. Сондықтан таңдалғанда АЙҚЫН қате беріледі.
 */

import { ConfigValidationError } from './errors'
import type { DrawerSystemId } from './types'

export type { DrawerSystemId }

/** Әзірге жасалмаған металл жәшік жүйелері (айқын қате беру үшін). */
export const METAL_BOX_SYSTEMS = ['tandembox', 'legrabox', 'merivobox'] as const
export type MetalBoxSystemId = (typeof METAL_BOX_SYSTEMS)[number]

export type DrawerSystem = {
  id: DrawerSystemId
  /** Экранда да, сметада да көрінетін атау. */
  name: string
  /**
   * Направляющая ӘР ЖАҚТАН алатын орын, мм. Қораптың ені = саңылау − 2 × осы.
   */
  sideClearance: number
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
    sideClearance: 21,
    nominalLengths: [270, 300, 350, 400, 450, 500, 550, 600],
    holeOffsets: [83, 147, 211, 243],
    holeDiameter: 3,
    holeDepth: 3,
    hardwareId: 'runner-tandem',
    source: 'qdesign CNC экспорты, 2026-09-02; ені: Blum кестесі (ішкі ен − 42)',
  },
}

export function findDrawerSystem(id: string): DrawerSystem {
  if ((METAL_BOX_SYSTEMS as readonly string[]).includes(id)) {
    throw new ConfigValidationError(
      'drawerSystem', id,
      'металл жәшік жүйелері әзірге жасалмаған: қорап ЛДСП-дан жиналмайды, '
      + 'ал түбі мен арт қабырғасының өлшемі өндірушінің кестесінен алынады',
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
export function nominalRunnerLength(system: DrawerSystem, available: number): number | null {
  const fitting = system.nominalLengths.filter((length) => length <= available)
  return fitting.length > 0 ? Math.max(...fitting) : null
}
