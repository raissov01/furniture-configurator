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
import type {
  BackMode,
  CabinetConfig,
  Catalog,
  ConstructionMethod,
  Section,
  SectionContent,
  ShelfKind,
} from './types'

export type TemplateCategory = 'kitchen' | 'wardrobe' | 'living' | 'storage'

/** UI-да көрсетілетін ұсынылған аралық. Қатты шектеу емес. */
export type SizeRange = { min: number; max: number }

export type CabinetTemplate = {
  id: string
  name: string
  category: TemplateCategory
  /** Бір жолдық сипаттама — галереяда карточка астында тұрады */
  description: string

  /** Үнсіз габарит, мм. Рет ӘРҚАШАН H × W × D. */
  height: number
  width: number
  depth: number
  range: { height: SizeRange; width: SizeRange; depth: SizeRange }

  construction: ConstructionMethod
  back: BackMode
  carcassMaterialId: string
  frontMaterialId: string
  backMaterialId: string
  sections: Section[]
}

export const TEMPLATE_CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: 'kitchen', label: 'Кухня' },
  { value: 'wardrobe', label: 'Шкафы' },
  { value: 'living', label: 'Гостиная' },
  { value: 'storage', label: 'Хранение' },
]

const shelves = (count: number, kind: ShelfKind = 'adjustable'): SectionContent[] =>
  count > 0 ? [{ kind: 'shelves', count, shelfKind: kind }] : [{ kind: 'empty' }]

/** Барлық секция 'flex' — қалған ен оларға тең бөлінеді (CLAUDE.md §4.6a). */
const section = (index: number, shelfCount: number, frontCount: number): Section => ({
  id: `s${index}`,
  widthMode: 'flex',
  contents: shelves(shelfCount),
  fronts: frontCount > 0 ? { count: frontCount, mount: 'overlay' } : null,
})

const LDSP_WHITE = 'ldsp16-w980'
const LDSP_OAK = 'ldsp16-h1145'
const HDF_WHITE = 'hdf3-white'

export const SEED_TEMPLATES: CabinetTemplate[] = [
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

  // ── Хранение ─────────────────────────────────────────────────────────────
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
    category: 'storage',
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

export function findTemplate(id: string): CabinetTemplate | undefined {
  return SEED_TEMPLATES.find((t) => t.id === id)
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
    back: { mode: template.back },
    // Секциялар терең көшіріледі: шаблон объектісі ортақ, оны UI өзгертпеуі керек.
    sections: template.sections.map((s) => ({
      ...s,
      contents: s.contents.map((c) => ({ ...c })),
      fronts: s.fronts ? { ...s.fronts } : null,
    })),
    edging: { ...carcass.defaultEdging },
  }
}
