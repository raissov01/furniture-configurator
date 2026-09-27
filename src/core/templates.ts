/**
 * Дайын шкаф шаблондарының кітапханасы (PHASE-2 A6).
 *
 * Шаблон — бұл ЖАЙ ҒАНА бастапқы `CabinetConfig`. Ол ядроға жаңа геометрия
 * қоспайды: `templateToCabinet()` қайтарған конфиг әдеттегі `generateCabinet()`
 * арқылы өтеді. Сондықтан шаблон қате өлшем бере алмайды — валидация сол
 * қалпында жұмыс істейді.
 *
 * Мұндағы габариттер — Қазақстан цехтарында нақты қолданылатын стандарт
 * өлшемдер (кухня корпусы 720 мм биіктік, төменгі қатар 500 мм тереңдік,
 * жоғарғы қатар 300 мм). Олар КОНСТАНТА емес, ҮНСІЗ МӘН: пайдаланушы
 * әрқайсысын өзгерте алады, `range` тек UI-дағы ұсынылған аралық.
 *
 * ЕСКЕРТПЕ. Сөренің майысуы (прогиб) бойынша ең үлкен пролёт мұнда әдейі
 * тексерілмейді — ол цехқа қарай өзгеретін нақты өндірістік ереже, оны
 * шаблон деңгейінде ойдан жазуға болмайды. Кең корпустарда перегородка
 * саны шаблонда ҚОЛМЕН қойылған.
 */

import { ConfigValidationError } from './errors'
import { makeNomenclatureTemplates } from './nomenclature'
import nomenclatureRaw from './data/generated/standardNomenclature.json'
import type { NomenclatureMatch } from './nomenclature'
import { KITCHEN_EXPANSION_TEMPLATES } from './templatesKitchenExpansion'
import { WARDROBE_EXPANSION_TEMPLATES } from './templatesWardrobeExpansion'
import type {
  BackMode,
  CabinetConfig,
  Catalog,
  ConstructionMethod,
  Section,
  SectionContent,
  SettingsOverride,
  ShelfKind,
  DrawerSystemId,
} from './types'

export type TemplateCategory = 'kitchen' | 'wardrobe' | 'living' | 'desk' | 'bed' | 'storage' | 'entry' | 'bathroom'

/** UI-да көрсетілетін ұсынылған аралық. Қатты шектеу емес. */
export type SizeRange = { min: number; max: number }

export type CabinetTemplate = {
  id: string
  name: string
  category: TemplateCategory
  /** Галереядағы ішкі санат; өндірістік конфигурацияға әсер етпейді. */
  subcategory?: string | undefined
  /** Дереккөзден расталған дискрет ендер; range үздіксіз редакциялауды шектемейді. */
  recommendedWidths?: number[] | undefined
  /** PRO100 атаулары — іздеу мен дәлел үшін; өндірістік геометрия емес. */
  sourceNames?: string[] | undefined
  /** Бір жолдық сипаттама — галереяда карточка астында тұрады */
  description: string

  /** Үнсіз габарит, мм. Рет ӘРҚАШАН H × W × D. */
  height: number
  width: number
  depth: number
  range: { height: SizeRange; width: SizeRange; depth: SizeRange }

  construction: ConstructionMethod
  back: BackMode
  /** Крышкасыз корпус: үстіне матрас не жұмсақ отырғыш тұрады */
  openTop?: boolean | undefined
  /** Қиғаш төбе (мансарда): `height` — биік жағы */
  slope?: { towards: 'back' | 'front'; lowHeight: number } | undefined
  /** Осы шаблонға ғана қатысты цех константалары */
  settings?: SettingsOverride | undefined
  carcassMaterialId: string
  frontMaterialId: string
  backMaterialId: string
  /** Шаблон таңдаған нақты бағыттағыш; ескі шаблондарда берілмейді. */
  drawerSystem?: DrawerSystemId | undefined
  sections: Section[]
  /** Купе есіктері (болса, ілмелі фасад болмайды) */
  sliding?: { count: number } | undefined
  base?: { kind: 'plinth' | 'legs'; height: number } | undefined
  worktop?: { overhangFront: number; overhangSides: number } | undefined
  /** Корпустағы техника (мойка, плита, сорғыш) — тек 3D, сметаға кірмейді */
  fixtures?: import('./types').CabinetFixture[] | undefined
}

export const TEMPLATE_CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: 'kitchen', label: 'Кухня' },
  { value: 'wardrobe', label: 'Шкафы' },
  { value: 'living', label: 'Гостиная' },
  { value: 'desk', label: 'Столы' },
  { value: 'bed', label: 'Кровати' },
  { value: 'storage', label: 'Хранение' },
  { value: 'entry', label: 'Прихожая' },
  { value: 'bathroom', label: 'Ванная' },
]

function defaultSubcategory(template: CabinetTemplate): string {
  const { id, category } = template
  if (category === 'kitchen') return id.includes('-wall-') ? 'Верхние' : id.includes('-tall-') ? 'Пеналы' : 'Нижние'
  if (category === 'wardrobe') return id.includes('sliding') ? 'Купе' : id.includes('pantograph') ? 'Гардеробные' : id.includes('antresol') ? 'Антресоли' : id.includes('rod') ? 'Со штангой' : 'Распашные'
  if (category === 'living') return id.includes('tv-') ? 'ТВ-тумбы' : 'Стеллажи'
  if (category === 'desk') return 'Письменные столы'
  if (category === 'bed') return id.includes('bench') ? 'Банкетки' : 'Кровати'
  if (category === 'entry') return id.includes('shoe') ? 'Обувницы' : id.includes('hallway') ? 'Открытые' : 'Банкетки'
  if (category === 'bathroom') return 'Шкафы для ванной'
  return id.includes('shelving') ? 'Стеллажи' : id.includes('antresol') ? 'Антресоли' : 'Тумбы'
}

const shelves = (count: number, kind: ShelfKind = 'adjustable'): SectionContent[] =>
  count > 0 ? [{ kind: 'shelves', count, shelfKind: kind }] : [{ kind: 'empty' }]

/** Барлық секция 'flex' — қалған ен оларға тең бөлінеді (CLAUDE.md §4.6a). */
const section = (index: number, shelfCount: number, frontCount: number): Section => ({
  id: `s${index}`,
  widthMode: 'flex',
  contents: shelves(shelfCount),
  fronts: frontCount > 0 ? { count: frontCount, mount: 'overlay' } : null,
})

/**
 * Ящикті секция. Толтырылым АСТЫҢҒЫДАН жоғары: ящиктер төменде, сөре үстінде —
 * нақты жиһаз дәл солай жиналады.
 */
const drawerSection = (
  index: number,
  drawerCount: number,
  options: { shelfCount?: number; drawerHeight?: number; frontCount?: number } = {},
): Section => {
  const contents: SectionContent[] = [
    {
      kind: 'drawers',
      count: drawerCount,
      ...(options.drawerHeight === undefined ? {} : { height: options.drawerHeight }),
    },
  ]
  // Сөре сұралмаса, БОС жолақ қосылмайды: әйтпесе биіктік екіге бөлініп,
  // ящиктер жарты орынға қысылып қалады.
  const shelfCount = options.shelfCount ?? 0
  if (shelfCount > 0) {
    contents.push({ kind: 'shelves', count: shelfCount, shelfKind: 'adjustable' })
  }
  return {
    id: `s${index}`,
    widthMode: 'flex',
    contents,
    fronts: options.frontCount ? { count: options.frontCount, mount: 'overlay' } : null,
  }
}

const LDSP_WHITE = 'ldsp16-w980'
const LDSP_OAK = 'ldsp16-h1145'
const HDF_WHITE = 'hdf3-white'

const EXISTING_TEMPLATES: CabinetTemplate[] = [
  // ── Кухня ────────────────────────────────────────────────────────────────
  // Кухня корпусының биіктігі 720 мм — үстіне 100 мм цоколь мен 38 мм
  // столешница қосылғанда стандарт 858 мм жұмыс биіктігі шығады. Цоколь әлі
  // жасалмаған (M8), сондықтан шаблон тек корпусты береді.
  {
    id: 'kitchen-base-600',
    name: 'Кухня: нижний 600',
    category: 'kitchen',
    description: '2 фасада, 1 полка. Стандартный нижний модуль под столешницу.',
    height: 720, width: 600, depth: 500,
    range: { height: { min: 600, max: 900 }, width: { min: 300, max: 900 }, depth: { min: 300, max: 600 } },
    construction: 'sidesOverlay',
    back: 'overlay',
    carcassMaterialId: LDSP_WHITE, frontMaterialId: LDSP_WHITE, backMaterialId: HDF_WHITE,
    sections: [section(1, 1, 2)],
  },
  {
    id: 'kitchen-base-400',
    name: 'Кухня: нижний 400',
    category: 'kitchen',
    description: '1 фасад, 1 полка. Узкий добор в ряд нижних модулей.',
    height: 720, width: 400, depth: 500,
    range: { height: { min: 600, max: 900 }, width: { min: 250, max: 600 }, depth: { min: 300, max: 600 } },
    construction: 'sidesOverlay',
    back: 'overlay',
    carcassMaterialId: LDSP_WHITE, frontMaterialId: LDSP_WHITE, backMaterialId: HDF_WHITE,
    sections: [section(1, 1, 1)],
  },
  {
    id: 'kitchen-wall-600',
    name: 'Кухня: верхний 600',
    category: 'kitchen',
    description: '2 фасада, 2 полки. Навесной модуль глубиной 300 мм.',
    height: 720, width: 600, depth: 300,
    range: { height: { min: 350, max: 920 }, width: { min: 300, max: 900 }, depth: { min: 250, max: 400 } },
    construction: 'sidesOverlay',
    back: 'overlay',
    carcassMaterialId: LDSP_WHITE, frontMaterialId: LDSP_WHITE, backMaterialId: HDF_WHITE,
    sections: [section(1, 2, 2)],
  },
  {
    id: 'kitchen-wall-open-800',
    name: 'Кухня: верхний открытый 800',
    category: 'kitchen',
    description: 'Без фасадов, 2 полки, перегородка посередине.',
    height: 720, width: 800, depth: 300,
    range: { height: { min: 350, max: 920 }, width: { min: 400, max: 1200 }, depth: { min: 250, max: 400 } },
    construction: 'sidesOverlay',
    back: 'overlay',
    carcassMaterialId: LDSP_WHITE, frontMaterialId: LDSP_WHITE, backMaterialId: HDF_WHITE,
    sections: [section(1, 2, 0), section(2, 2, 0)],
  },

  // ── Шкафы ────────────────────────────────────────────────────────────────
  {
    id: 'kitchen-base-full-600',
    name: 'Кухня: нижний с цоколем и столешницей',
    category: 'kitchen',
    description: 'Готовый модуль: цоколь 100 мм, столешница со свесом 20 мм, 2 фасада.',
    height: 720, width: 600, depth: 500,
    range: { height: { min: 600, max: 900 }, width: { min: 300, max: 900 }, depth: { min: 350, max: 600 } },
    construction: 'sidesOverlay',
    back: 'overlay',
    carcassMaterialId: LDSP_WHITE, frontMaterialId: LDSP_WHITE, backMaterialId: HDF_WHITE,
    base: { kind: 'plinth', height: 100 },
    worktop: { overhangFront: 20, overhangSides: 0 },
    sections: [section(1, 1, 2)],
  },
  {
    id: 'kitchen-base-drawers-600',
    name: 'Кухня: нижний с ящиками',
    category: 'kitchen',
    description: '3 ящика на роликовых направляющих. Самый ходовой нижний модуль.',
    height: 720, width: 600, depth: 500,
    range: { height: { min: 600, max: 900 }, width: { min: 300, max: 900 }, depth: { min: 350, max: 600 } },
    construction: 'sidesOverlay',
    back: 'overlay',
    carcassMaterialId: LDSP_WHITE, frontMaterialId: LDSP_WHITE, backMaterialId: HDF_WHITE,
    sections: [drawerSection(1, 3)],
    drawerSystem: 'roller',
  },
  {
    id: 'kitchen-sink-800',
    name: 'Кухня: под мойку 800',
    category: 'kitchen',
    description: 'Без полок — внутри сифон. 2 фасада.',
    fixtures: [{ kind: 'sink' }],
    height: 720, width: 800, depth: 500,
    range: { height: { min: 600, max: 900 }, width: { min: 500, max: 1000 }, depth: { min: 400, max: 600 } },
    construction: 'sidesOverlay',
    back: 'overlay',
    carcassMaterialId: LDSP_WHITE, frontMaterialId: LDSP_WHITE, backMaterialId: HDF_WHITE,
    sections: [section(1, 0, 2)],
  },
  {
    id: 'kitchen-tall-600',
    name: 'Кухня: пенал 600',
    category: 'kitchen',
    description: 'Высокий модуль под встройку или продукты, 5 полок.',
    height: 2100, width: 600, depth: 560,
    range: { height: { min: 1600, max: 2600 }, width: { min: 400, max: 900 }, depth: { min: 400, max: 700 } },
    construction: 'sidesOverlay',
    back: 'overlay',
    carcassMaterialId: LDSP_WHITE, frontMaterialId: LDSP_WHITE, backMaterialId: HDF_WHITE,
    sections: [section(1, 5, 2)],
  },

  {
    id: 'wardrobe-penal-600',
    name: 'Шкаф-пенал 600',
    category: 'wardrobe',
    description: '4 полки, 2 фасада. Эталонный корпус проекта.',
    height: 2000, width: 600, depth: 450,
    range: { height: { min: 1200, max: 2700 }, width: { min: 300, max: 1000 }, depth: { min: 300, max: 700 } },
    construction: 'sidesOverlay',
    back: 'overlay',
    carcassMaterialId: LDSP_OAK, frontMaterialId: LDSP_OAK, backMaterialId: HDF_WHITE,
    sections: [section(1, 4, 2)],
  },
  {
    id: 'wardrobe-2sec-1200',
    name: 'Шкаф 2 секции 1200',
    category: 'wardrobe',
    description: 'Одна перегородка, по 4 полки и по 1 фасаду в секции.',
    height: 2200, width: 1200, depth: 450,
    range: { height: { min: 1400, max: 2700 }, width: { min: 800, max: 1600 }, depth: { min: 300, max: 700 } },
    construction: 'sidesOverlay',
    back: 'overlay',
    carcassMaterialId: LDSP_OAK, frontMaterialId: LDSP_OAK, backMaterialId: HDF_WHITE,
    sections: [section(1, 4, 1), section(2, 4, 1)],
  },
  {
    id: 'wardrobe-3sec-1800',
    name: 'Шкаф 3 секции 1800',
    category: 'wardrobe',
    description: 'Две перегородки. Боковые секции с фасадом, средняя открытая.',
    height: 2200, width: 1800, depth: 450,
    range: { height: { min: 1400, max: 2700 }, width: { min: 1200, max: 2400 }, depth: { min: 300, max: 700 } },
    construction: 'sidesOverlay',
    back: 'overlay',
    carcassMaterialId: LDSP_OAK, frontMaterialId: LDSP_OAK, backMaterialId: HDF_WHITE,
    sections: [section(1, 5, 1), section(2, 5, 0), section(3, 5, 1)],
  },

  {
    id: 'wardrobe-rod-1000',
    name: 'Шкаф со штангой 1000',
    category: 'wardrobe',
    description: 'Штанга под верхнюю одежду, антресольная полка сверху корпуса.',
    height: 2200, width: 1000, depth: 600,
    range: { height: { min: 1600, max: 2700 }, width: { min: 500, max: 1400 }, depth: { min: 450, max: 700 } },
    construction: 'sidesOverlay',
    back: 'overlay',
    carcassMaterialId: LDSP_OAK, frontMaterialId: LDSP_OAK, backMaterialId: HDF_WHITE,
    sections: [{
      id: 's1',
      widthMode: 'flex',
      // Астында сөре, үстінде штанга — киім ілетін бөлік жоғарыда.
      contents: [{ kind: 'shelves', count: 1, shelfKind: 'fixed', height: 400 }, { kind: 'rod' }],
      fronts: { count: 2, mount: 'overlay' },
    }],
  },
  {
    id: 'wardrobe-rod-drawers-1600',
    name: 'Шкаф со штангой и ящиками 1600',
    category: 'wardrobe',
    description: 'Слева штанга и ящики снизу, справа полки. Ходовой набор в спальню.',
    height: 2200, width: 1600, depth: 600,
    range: { height: { min: 1700, max: 2700 }, width: { min: 1000, max: 2000 }, depth: { min: 450, max: 700 } },
    construction: 'sidesOverlay',
    back: 'overlay',
    carcassMaterialId: LDSP_OAK, frontMaterialId: LDSP_OAK, backMaterialId: HDF_WHITE,
    sections: [
      {
        id: 's1',
        widthMode: 'flex',
        contents: [{ kind: 'drawers', count: 2, height: 500 }, { kind: 'rod' }],
        fronts: { count: 1, mount: 'overlay' },
      },
      section(2, 5, 1),
    ],
  },
  {
    id: 'wardrobe-sliding-1800',
    name: 'Шкаф-купе 1800',
    category: 'wardrobe',
    description: 'Две двери-купе, слева штанга, справа полки. В деталировку идёт вставка ЛДСП.',
    height: 2400, width: 1800, depth: 600,
    range: { height: { min: 1800, max: 2700 }, width: { min: 1200, max: 2600 }, depth: { min: 500, max: 750 } },
    construction: 'sidesOverlay',
    back: 'overlay',
    carcassMaterialId: LDSP_OAK, frontMaterialId: LDSP_OAK, backMaterialId: HDF_WHITE,
    sliding: { count: 2 },
    sections: [
      {
        id: 's1', widthMode: 'flex',
        contents: [{ kind: 'shelves', count: 1, shelfKind: 'fixed', height: 500 }, { kind: 'rod' }],
        fronts: null,
      },
      { id: 's2', widthMode: 'flex', contents: shelves(6), fronts: null },
    ],
  },
  {
    id: 'wardrobe-sliding-3-2400',
    name: 'Шкаф-купе 2400, три двери',
    category: 'wardrobe',
    description: 'Три двери, три секции: штанга, полки, ящики снизу.',
    height: 2400, width: 2400, depth: 600,
    range: { height: { min: 1800, max: 2700 }, width: { min: 1800, max: 3200 }, depth: { min: 500, max: 750 } },
    construction: 'sidesOverlay',
    back: 'overlay',
    carcassMaterialId: LDSP_OAK, frontMaterialId: LDSP_OAK, backMaterialId: HDF_WHITE,
    sliding: { count: 3 },
    sections: [
      {
        id: 's1', widthMode: 'flex',
        contents: [{ kind: 'shelves', count: 1, shelfKind: 'fixed', height: 500 }, { kind: 'rod' }],
        fronts: null,
      },
      { id: 's2', widthMode: 'flex', contents: shelves(6), fronts: null },
      {
        id: 's3', widthMode: 'flex',
        contents: [{ kind: 'drawers', count: 3, height: 700 }, { kind: 'shelves', count: 3, shelfKind: 'adjustable' }],
        fronts: null,
      },
    ],
  },
  {
    id: 'wardrobe-mansard-1200',
    name: 'Шкаф под скос 1200',
    category: 'wardrobe',
    description: 'Мансардный: боковины трапеции, крышка наклонная. Фасады — до низкой стороны.',
    height: 2400, width: 1200, depth: 600,
    range: { height: { min: 1600, max: 2800 }, width: { min: 600, max: 1800 }, depth: { min: 400, max: 800 } },
    construction: 'sidesOverlay',
    back: 'overlay',
    slope: { towards: 'back', lowHeight: 1400 },
    carcassMaterialId: LDSP_OAK, frontMaterialId: LDSP_OAK, backMaterialId: HDF_WHITE,
    sections: [section(1, 3, 0)],
  },
  {
    id: 'wardrobe-drawers-1200',
    name: 'Шкаф с ящиками 1200',
    category: 'wardrobe',
    description: 'Слева 3 ящика снизу и полки сверху, справа полки под фасадом.',
    height: 2200, width: 1200, depth: 500,
    range: { height: { min: 1400, max: 2700 }, width: { min: 800, max: 1600 }, depth: { min: 400, max: 700 } },
    construction: 'sidesOverlay',
    back: 'overlay',
    carcassMaterialId: LDSP_OAK, frontMaterialId: LDSP_OAK, backMaterialId: HDF_WHITE,
    sections: [drawerSection(1, 3, { drawerHeight: 700, shelfCount: 3 }), section(2, 5, 1)],
  },

  // ── Гостиная ─────────────────────────────────────────────────────────────
  {
    id: 'tv-stand-1200',
    name: 'Тумба под ТВ 1200',
    category: 'living',
    description: 'Две открытые секции, по одной полке.',
    height: 500, width: 1200, depth: 400,
    range: { height: { min: 350, max: 700 }, width: { min: 800, max: 2000 }, depth: { min: 300, max: 550 } },
    construction: 'sidesOverlay',
    back: 'overlay',
    carcassMaterialId: LDSP_OAK, frontMaterialId: LDSP_OAK, backMaterialId: HDF_WHITE,
    sections: [section(1, 1, 0), section(2, 1, 0)],
  },
  {
    id: 'bookcase-2sec-1200',
    name: 'Стеллаж книжный 1200',
    category: 'living',
    description: 'Две секции по 5 полок, без фасадов, глубина 300 мм.',
    height: 2000, width: 1200, depth: 300,
    range: { height: { min: 900, max: 2600 }, width: { min: 600, max: 1800 }, depth: { min: 200, max: 450 } },
    construction: 'sidesOverlay',
    back: 'overlay',
    carcassMaterialId: LDSP_OAK, frontMaterialId: LDSP_OAK, backMaterialId: HDF_WHITE,
    sections: [section(1, 5, 0), section(2, 5, 0)],
  },

  {
    id: 'tv-stand-drawers-1600',
    name: 'Тумба под ТВ с ящиками',
    category: 'living',
    description: 'По центру 2 ящика, по краям открытые секции.',
    height: 500, width: 1600, depth: 400,
    range: { height: { min: 350, max: 700 }, width: { min: 1000, max: 2400 }, depth: { min: 300, max: 550 } },
    construction: 'sidesOverlay',
    back: 'overlay',
    carcassMaterialId: LDSP_OAK, frontMaterialId: LDSP_OAK, backMaterialId: HDF_WHITE,
    sections: [section(1, 1, 0), drawerSection(2, 2), section(3, 1, 0)],
  },

  // ── Столы ────────────────────────────────────────────────────────────────
  // Стол-тумба: боковины стоят на полу, сверху крышка. Отдельных ножек и
  // столешницы конструктор пока не делает — это честная граница.
  {
    id: 'desk-1200',
    name: 'Стол письменный 1200',
    category: 'desk',
    description: 'Стол-тумба со столешницей: боковины, крышка и свес вперёд.',
    height: 750, width: 1200, depth: 600,
    range: { height: { min: 700, max: 800 }, width: { min: 800, max: 1800 }, depth: { min: 450, max: 800 } },
    construction: 'topBottomOverlay',
    back: 'overlay',
    carcassMaterialId: LDSP_OAK, frontMaterialId: LDSP_OAK, backMaterialId: HDF_WHITE,
    worktop: { overhangFront: 30, overhangSides: 20 },
    sections: [section(1, 0, 0)],
  },
  {
    id: 'desk-drawers-1400',
    name: 'Стол с тумбой 1400',
    category: 'desk',
    description: 'Слева ноги-открыто, справа тумба с 3 ящиками.',
    height: 750, width: 1400, depth: 600,
    range: { height: { min: 700, max: 800 }, width: { min: 1000, max: 2000 }, depth: { min: 450, max: 800 } },
    construction: 'topBottomOverlay',
    back: 'overlay',
    carcassMaterialId: LDSP_OAK, frontMaterialId: LDSP_OAK, backMaterialId: HDF_WHITE,
    sections: [
      { id: 's1', widthMode: 'flex', contents: [{ kind: 'empty' }], fronts: null },
      { ...drawerSection(2, 3), widthMode: 'fixed' as const, width: 400 },
    ],
  },
  {
    id: 'desk-computer-1000',
    name: 'Стол компьютерный 1000',
    category: 'desk',
    description: 'Узкий стол с одной полкой в правой секции.',
    height: 750, width: 1000, depth: 550,
    range: { height: { min: 700, max: 800 }, width: { min: 700, max: 1600 }, depth: { min: 450, max: 700 } },
    construction: 'topBottomOverlay',
    back: 'overlay',
    carcassMaterialId: LDSP_OAK, frontMaterialId: LDSP_OAK, backMaterialId: HDF_WHITE,
    sections: [
      { id: 's1', widthMode: 'flex', contents: [{ kind: 'empty' }], fronts: null },
      { id: 's2', widthMode: 'fixed', width: 350, contents: shelves(1), fronts: null },
    ],
  },

  // ── Кровати ──────────────────────────────────────────────────────────────
  // ЛДСП каркас: царги, изножье и основание. Матрас, поролон и ткань —
  // ПОКУПНЫЕ, из листа не выкраиваются и в деталировку не входят.
  {
    id: 'bed-frame-1600',
    name: 'Кровать: каркас 1600×2000',
    category: 'bed',
    description: 'Царги, изножье и сплошное основание. Матрас и мягкая обивка — покупные.',
    height: 350, width: 1600, depth: 2000,
    range: { height: { min: 250, max: 500 }, width: { min: 800, max: 2000 }, depth: { min: 1800, max: 2200 } },
    construction: 'sidesOverlay',
    // Изножье из ЛДСП, а не из ХДФ: на него опирается основание.
    back: 'overlay',
    openTop: true,
    // Изножье ЛДСП-дан: оған негіз тіреледі, ХДФ көтермейді. Сондықтан
    // арт қабырғаның қалыңдығы да сол материалға теңестіріледі.
    settings: { backThickness: 16 },
    carcassMaterialId: LDSP_OAK, frontMaterialId: LDSP_OAK, backMaterialId: LDSP_OAK,
    sections: [section(1, 0, 0)],
  },
  {
    id: 'bed-frame-900',
    name: 'Кровать: каркас 900×2000',
    category: 'bed',
    description: 'Односпальная. Царги, изножье, основание. Матрас покупной.',
    height: 350, width: 900, depth: 2000,
    range: { height: { min: 250, max: 500 }, width: { min: 700, max: 1200 }, depth: { min: 1600, max: 2200 } },
    construction: 'sidesOverlay',
    back: 'overlay',
    openTop: true,
    // Изножье ЛДСП-дан: оған негіз тіреледі, ХДФ көтермейді. Сондықтан
    // арт қабырғаның қалыңдығы да сол материалға теңестіріледі.
    settings: { backThickness: 16 },
    carcassMaterialId: LDSP_OAK, frontMaterialId: LDSP_OAK, backMaterialId: LDSP_OAK,
    sections: [section(1, 0, 0)],
  },
  {
    id: 'bench-1200',
    name: 'Банкетка 1200',
    category: 'bed',
    description: 'Открытый короб под мягкое сиденье. Поролон и ткань — покупные.',
    height: 400, width: 1200, depth: 400,
    range: { height: { min: 300, max: 550 }, width: { min: 600, max: 1800 }, depth: { min: 300, max: 500 } },
    construction: 'sidesOverlay',
    back: 'overlay',
    openTop: true,
    carcassMaterialId: LDSP_OAK, frontMaterialId: LDSP_OAK, backMaterialId: HDF_WHITE,
    sections: [section(1, 0, 0)],
  },

  // ── Хранение ─────────────────────────────────────────────────────────────
  {
    id: 'shelving-no-back-800',
    name: 'Стеллаж без задней стенки 800',
    category: 'storage',
    description: 'Сквозной стеллаж: задней стенки нет, видно обе стороны.',
    height: 1800, width: 800, depth: 300,
    range: { height: { min: 600, max: 2400 }, width: { min: 300, max: 1000 }, depth: { min: 200, max: 500 } },
    construction: 'sidesOverlay',
    back: 'none',
    carcassMaterialId: LDSP_OAK, frontMaterialId: LDSP_OAK, backMaterialId: HDF_WHITE,
    sections: [section(1, 4, 0)],
  },
  {
    id: 'chest-800',
    name: 'Комод 800',
    category: 'storage',
    description: '4 ящика во всю ширину.',
    height: 850, width: 800, depth: 450,
    range: { height: { min: 500, max: 1300 }, width: { min: 400, max: 1200 }, depth: { min: 350, max: 600 } },
    construction: 'sidesOverlay',
    back: 'overlay',
    carcassMaterialId: LDSP_OAK, frontMaterialId: LDSP_OAK, backMaterialId: HDF_WHITE,
    sections: [drawerSection(1, 4)],
  },
  {
    id: 'chest-wide-1200',
    name: 'Комод широкий 1200',
    category: 'storage',
    description: 'Две секции по 3 ящика — фасады уже, ящики ходят легче.',
    height: 850, width: 1200, depth: 450,
    range: { height: { min: 500, max: 1300 }, width: { min: 800, max: 1800 }, depth: { min: 350, max: 600 } },
    construction: 'sidesOverlay',
    back: 'overlay',
    carcassMaterialId: LDSP_OAK, frontMaterialId: LDSP_OAK, backMaterialId: HDF_WHITE,
    sections: [drawerSection(1, 3), drawerSection(2, 3)],
  },
  {
    id: 'bedside-drawers-450',
    name: 'Тумба прикроватная с ящиками',
    category: 'storage',
    description: '2 ящика вместо фасада.',
    height: 500, width: 450, depth: 400,
    range: { height: { min: 350, max: 800 }, width: { min: 300, max: 700 }, depth: { min: 300, max: 550 } },
    construction: 'sidesOverlay',
    back: 'overlay',
    carcassMaterialId: LDSP_OAK, frontMaterialId: LDSP_OAK, backMaterialId: HDF_WHITE,
    sections: [drawerSection(1, 2)],
  },
  {
    id: 'bathroom-600',
    name: 'Шкаф в ванную 600',
    category: 'bathroom',
    description: 'Неглубокий белый корпус, 2 полки, 2 фасада.',
    height: 800, width: 600, depth: 250,
    range: { height: { min: 400, max: 1600 }, width: { min: 300, max: 900 }, depth: { min: 200, max: 400 } },
    construction: 'sidesOverlay',
    back: 'overlay',
    carcassMaterialId: LDSP_WHITE, frontMaterialId: LDSP_WHITE, backMaterialId: HDF_WHITE,
    sections: [section(1, 2, 2)],
  },
  {
    id: 'shelving-open-800',
    name: 'Стеллаж открытый 800',
    category: 'storage',
    description: '4 полки, без фасадов и перегородок.',
    height: 1800, width: 800, depth: 300,
    range: { height: { min: 600, max: 2400 }, width: { min: 300, max: 1000 }, depth: { min: 200, max: 500 } },
    construction: 'sidesOverlay',
    back: 'overlay',
    carcassMaterialId: LDSP_OAK, frontMaterialId: LDSP_OAK, backMaterialId: HDF_WHITE,
    sections: [section(1, 4, 0)],
  },
  {
    id: 'bedside-450',
    name: 'Тумба прикроватная 450',
    category: 'storage',
    description: '1 фасад, 1 полка.',
    height: 500, width: 450, depth: 400,
    range: { height: { min: 300, max: 800 }, width: { min: 300, max: 700 }, depth: { min: 250, max: 550 } },
    construction: 'sidesOverlay',
    back: 'overlay',
    carcassMaterialId: LDSP_OAK, frontMaterialId: LDSP_OAK, backMaterialId: HDF_WHITE,
    sections: [section(1, 1, 1)],
  },
  {
    id: 'shoe-rack-800',
    name: 'Обувница 800',
    category: 'entry',
    description: '3 полки, 2 фасада, глубина 300 мм.',
    height: 900, width: 800, depth: 300,
    range: { height: { min: 500, max: 1400 }, width: { min: 400, max: 1200 }, depth: { min: 250, max: 450 } },
    construction: 'sidesOverlay',
    back: 'overlay',
    carcassMaterialId: LDSP_WHITE, frontMaterialId: LDSP_WHITE, backMaterialId: HDF_WHITE,
    sections: [section(1, 3, 2)],
  },
  {
    id: 'antresol-600',
    name: 'Антресоль 600',
    category: 'storage',
    description: 'Без полок, 2 фасада. Ставится над шкафом.',
    height: 400, width: 600, depth: 450,
    range: { height: { min: 250, max: 700 }, width: { min: 300, max: 1000 }, depth: { min: 300, max: 700 } },
    construction: 'sidesOverlay',
    back: 'overlay',
    carcassMaterialId: LDSP_OAK, frontMaterialId: LDSP_OAK, backMaterialId: HDF_WHITE,
    sections: [section(1, 0, 2)],
  },
]

const BASE_TEMPLATES: CabinetTemplate[] = [
  ...EXISTING_TEMPLATES,
  ...KITCHEN_EXPANSION_TEMPLATES,
  ...WARDROBE_EXPANSION_TEMPLATES,
].map((template) => ({
  ...template,
  subcategory: template.subcategory ?? defaultSubcategory(template),
}))

export const SEED_TEMPLATES: CabinetTemplate[] = BASE_TEMPLATES

/** Бөлек сөре: қолданыстағы seed эталоны мен присадка snapshot-тарын қозғамайды. */
export const STANDARD_NOMENCLATURE_TEMPLATES: CabinetTemplate[] =
  makeNomenclatureTemplates(BASE_TEMPLATES, nomenclatureRaw as NomenclatureMatch[])

export function findTemplate(id: string): CabinetTemplate | undefined {
  return SEED_TEMPLATES.find((t) => t.id === id)
    ?? STANDARD_NOMENCLATURE_TEMPLATES.find((t) => t.id === id)
}

/** Шаблонда өзгертуге рұқсат етілген габарит. Барлығы міндетті емес. */
export type TemplateSize = {
  height?: number | undefined
  width?: number | undefined
  depth?: number | undefined
}

/**
 * Шаблон → конфиг. Кромка жиынтығы корпус материалынан алынады: декоры
 * сәйкес келмеген кромка — брак (§4.1), сондықтан оны шаблон өзі таңдамайды.
 */
export function templateToCabinet(
  template: CabinetTemplate,
  catalog: Catalog,
  size?: TemplateSize,
): CabinetConfig {
  const carcass = catalog.materials.find((m) => m.id === template.carcassMaterialId)
  if (!carcass) {
    throw new ConfigValidationError(
      'carcassMaterialId',
      `шаблон "${template.id}" материалы каталогта жоқ: ${template.carcassMaterialId}`,
    )
  }
  if (!carcass.defaultEdging) {
    throw new ConfigValidationError(
      'edging',
      `материалда defaultEdging жоқ: ${carcass.id}`,
    )
  }

  return {
    id: `cabinet-${template.id}`,
    name: template.name,
    construction: template.construction,
    height: size?.height ?? template.height,
    width: size?.width ?? template.width,
    depth: size?.depth ?? template.depth,
    carcassMaterialId: template.carcassMaterialId,
    frontMaterialId: template.frontMaterialId,
    backMaterialId: template.backMaterialId,
    ...(template.drawerSystem ? { drawerSystem: template.drawerSystem } : {}),
    back: { mode: template.back },
    ...(template.openTop ? { openTop: true } : {}),
    ...(template.slope ? { slope: { ...template.slope } } : {}),
    ...(template.settings ? { settings: { ...template.settings } } : {}),
    // Секциялар терең көшіріледі: шаблон объектісі ортақ, оны UI өзгертпеуі керек.
    ...(template.sliding ? { sliding: { ...template.sliding } } : {}),
    ...(template.base ? { base: { ...template.base } } : {}),
    ...(template.worktop ? { worktop: { ...template.worktop } } : {}),
    ...(template.fixtures ? { fixtures: template.fixtures.map((f) => ({ ...f })) } : {}),
    sections: template.sections.map((s) => ({
      ...s,
      contents: s.contents.map((c) => ({ ...c })),
      fronts: s.fronts ? { ...s.fronts } : null,
    })),
    edging: { ...carcass.defaultEdging },
  }
}
