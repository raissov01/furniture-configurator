/**
 * Наполнение — шкафтың ішіне қойылатын, бірақ параққа түспейтін нәрселер.
 *
 * ЕКІ БӨЛЕК ТҮР, оларды шатастыруға болмайды:
 *
 * 1. ФУРНИТУРА (брючница, пантограф, выдвижная вешалка, поворотная полка,
 *    голопрофиль). Мұны ЦЕХ сатып алады, сондықтан ол сметаға түседі.
 *
 * 2. ТЕХНИКА (духовка, микроволновка, холодильник, посудомойка). Мұны
 *    КЛИЕНТ өзі алады. Цехтың міндеті — дұрыс өлшемді ҰЯ қалдыру. Сондықтан
 *    техниканың сметада БАҒАСЫ ЖОҚ: ойдан жазылған баға клиентке кеткен
 *    КП-ға түсер еді, ал ол цехтың ақшасы емес.
 *
 * ӨЛШЕМ ТУРАЛЫ ЕСКЕРТУ (§10). Мұндағы биіктіктер — ең кең тараған ұя
 * өлшемдері, ДӘЛЕЛ ЕМЕС: нақты сан клиент алатын модельдің паспортында
 * тұрады. Сол себепті олар тек ӘДЕПКІ мән: жолақтың `height` өрісі оларды
 * әрқашан басып озады, ал UI-да сан көрініп тұрады.
 */

import { z } from 'zod'

// ── Фурнитура ────────────────────────────────────────────────────────────────

export type FillingKind =
  | 'pullOutHanger'
  | 'trousers'
  | 'pantograph'
  | 'rotaryShelf'
  | 'railProfile'

export type FillingModel = {
  id: FillingKind
  name: string
  /** Сметадағы позиция (`ShopProfile.hardware[].id`). */
  hardwareId: string
  /** Жолақтың әдепкі биіктігі, мм. */
  defaultHeight: number
  /**
   * Секцияның ЕҢ КІШІ ені, мм — механизм одан тарға сыймайды.
   * Пантографқа кең, брючницаға тар секция керек.
   */
  minWidth: number
}

export const FILLINGS: FillingModel[] = [
  {
    id: 'pullOutHanger', name: 'Вешалка выдвижная',
    hardwareId: 'filling-pullout-hanger', defaultHeight: 120, minWidth: 400,
  },
  {
    id: 'trousers', name: 'Брючница',
    hardwareId: 'filling-trousers', defaultHeight: 180, minWidth: 350,
  },
  {
    id: 'pantograph', name: 'Пантограф',
    hardwareId: 'filling-pantograph', defaultHeight: 200, minWidth: 550,
  },
  {
    id: 'rotaryShelf', name: 'Поворотная полка',
    hardwareId: 'filling-rotary-shelf', defaultHeight: 700, minWidth: 500,
  },
  {
    id: 'railProfile', name: 'Голопрофиль (рейлинг)',
    hardwareId: 'filling-rail-profile', defaultHeight: 80, minWidth: 200,
  },
]

export function findFilling(id: FillingKind): FillingModel {
  const found = FILLINGS.find((f) => f.id === id)
  if (!found) throw new Error(`наполнение табылмады: ${id}`)
  return found
}

// ── Техника ──────────────────────────────────────────────────────────────────

export type ApplianceKind = 'oven' | 'microwave' | 'fridge' | 'dishwasher'

export type ApplianceModel = {
  id: ApplianceKind
  name: string
  /**
   * Ұяның әдепкі БИІКТІГІ, мм.
   *
   * ⚠ Нақты сан клиенттің моделіне байланысты — мұндағысы ең жиі
   * кездесетіні ғана. Жолақтың `height` өрісі оны басып озады.
   */
  defaultNicheHeight: number
  /** Ұяның ең кіші ені, мм. */
  minWidth: number
  /** 3D-де көрсетілетін реңк — техника плитадан ажырап тұруы керек. */
  color: string
}

export const APPLIANCES: ApplianceModel[] = [
  { id: 'oven', name: 'Духовка', defaultNicheHeight: 595, minWidth: 560, color: '#2f3336' },
  { id: 'microwave', name: 'Микроволновка', defaultNicheHeight: 380, minWidth: 560, color: '#3a3f43' },
  { id: 'dishwasher', name: 'Посудомоечная машина', defaultNicheHeight: 820, minWidth: 450, color: '#454b50' },
  { id: 'fridge', name: 'Холодильник', defaultNicheHeight: 1780, minWidth: 560, color: '#50575d' },
]

export function findAppliance(id: ApplianceKind): ApplianceModel {
  const found = APPLIANCES.find((a) => a.id === id)
  if (!found) throw new Error(`техника табылмады: ${id}`)
  return found
}

// ── Столешница мен қабырғадағы техника ───────────────────────────────────────

/**
 * Корпустың ҰЯСЫНА кірмейтін техника: мойка мен варочная панель
 * столешницаға отырады, сорғыш қабырғаға ілінеді. Бәрі КЛИЕНТТІКІ.
 *
 * ⚠ Өлшемдер — ТЕК 3D үшін, ең жиі кездесетін модельдікі. Модульге
 * сыймаса, ені тарылады. Столешницадағы ойма бұл сандардан ЕСЕПТЕЛМЕЙДІ.
 */
export type FixtureVisual = 'sink' | 'hobGas' | 'hobElectric' | 'hood'

export type FixtureModel = {
  id: FixtureVisual
  name: string
  /**
   * Модульдің ең кіші ені, мм. Варочная панельдің ең тар стандарты — 45 см,
   * мойканың — 40 см: одан тар тумбаға олар физикалық сыймайды.
   */
  minWidth: number
  /** Әдепкі ені мен тереңдігі, мм. */
  width: number
  depth: number
  /** Беттен (столешницадан) жоғары биіктігі, мм. Сорғышта — өз биіктігі. */
  height: number
}

export const FIXTURES: FixtureModel[] = [
  { id: 'sink', name: 'Мойка', minWidth: 400, width: 760, depth: 480, height: 300 },
  { id: 'hobGas', name: 'Варочная панель (газ)', minWidth: 450, width: 590, depth: 510, height: 40 },
  { id: 'hobElectric', name: 'Варочная панель (электро)', minWidth: 450, width: 590, depth: 510, height: 6 },
  { id: 'hood', name: 'Вытяжка', minWidth: 450, width: 600, depth: 480, height: 800 },
]

export function findFixture(id: FixtureVisual): FixtureModel {
  const found = FIXTURES.find((f) => f.id === id)
  if (!found) throw new Error(`техника табылмады: ${id}`)
  return found
}

/**
 * Сорғыштың астыңғы жиегі варочная панельден қанша жоғары, мм.
 *
 * Газда 750, электрде 650 — сорғыш өндірушілерінің орнату нұсқаулығындағы
 * ең кіші қашықтық. Тек 3D-дегі орны: нақты модельдің нұсқаулығымен
 * тексеру керек.
 */
export const HOOD_CLEARANCE = { gas: 750, electric: 650 } as const

/** Жолақтың биіктігі: нақты берілсе — сол, әйтпесе әдепкі ұя/механизм биіктігі. */
export function fillingBandHeight(content: {
  // Кез келген жолақ келе алады — механизм мен техникадан басқасы 0 береді.
  kind: string
  filling?: FillingKind
  appliance?: ApplianceKind
  height?: number | undefined
}): number {
  if (content.height && content.height > 0) return content.height
  if (content.kind === 'filling' && content.filling) return findFilling(content.filling).defaultHeight
  if (content.kind === 'appliance' && content.appliance) return findAppliance(content.appliance).defaultNicheHeight
  return 0
}

/** Сметаға түсетін позициялар — техника КІРМЕЙДІ (оны клиент өзі алады). */
export function fillingHardware(): { id: string; name: string }[] {
  return FILLINGS.map((f) => ({ id: f.hardwareId, name: f.name }))
}

// ── Zod ──────────────────────────────────────────────────────────────────────

export const FillingKindSchema = z.enum([
  'pullOutHanger', 'trousers', 'pantograph', 'rotaryShelf', 'railProfile',
])

export const ApplianceKindSchema = z.enum(['oven', 'microwave', 'fridge', 'dishwasher'])
