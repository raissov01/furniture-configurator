/**
 * «Замена» — жобадағы материалды ЖАППАЙ ауыстыру
 * (PRO100 `TTEXTURESUBSTITUTEFORM`, `docs/pro100/parity.md` §2.2: бізде
 * бұрын мүлде жоқ еді — DecorPicker бір панельге/корпусқа ғана қолданылатын).
 *
 * Таза функция: React/three.js/Next.js импорты ЖОҚ (CLAUDE.md §3). Панельді
 * ӨЗІ есептемейді, генерацияны `generateCabinet`/`mergeProjectPanels`/
 * `nestPanels`/`priceProject`-ке жүктейді — олар да таза, сондықтан бұл
 * жерде логика ҚАЙТАЛАНБАЙДЫ (тек шақыру мен салыстыру).
 *
 * ⚠ Материал ауыстыру КРОМКАНЫ ДА қозғауы мүмкін (§4.3). Себебі: жаңа
 * материалдың қалыңдығы (`Material.thickness`) басқа болса, ол корпустың
 * ІШКІ формулаларына (мыс. `top.finishedLength = W − 2·t`, §4.4) тікелей
 * кіреді де, көрші панельдердің ГОТОВЫЙ өлшемін өзгертеді — сосын СОЛ
 * жаңа готовый өлшем кромка қалыңдығынан кемиді де, РЕЗ өлшемі басқа шығады.
 * Бұл ЭФФЕКТ — ЕКІ РЕТ есептелмейді, ол `generateCabinet`-тің өз ішінде
 * болады: бізге тек АЛДЫН/КЕЙІН панельдерін салыстыру жетеді.
 */

import { ConfigValidationError } from './errors'
import { generateCabinet, mergeProjectPanels } from './generateCabinet'
import { generateHardware } from './hardware'
import type { HardwarePlacement } from './hardware'
import { nestPanels } from './nesting'
import { catalogOf, nestingOptionsOf } from './shop'
import type { ShopProfile } from './shop'
import { priceProject } from './pricing'
import { projectUsage } from './materialUsage'
import type { ProjectUsage } from './materialUsage'
import type {
  CabinetConfig, Catalog, Material, Panel, SettingsOverride,
} from './types'

// ── Ауқым: барлық корпус па, әлде таңдалғандары ма ────────────────────────────

export type ReplaceMaterialScope =
  | { kind: 'all' }
  | { kind: 'cabinets'; cabinetIds: string[] }

function inScope(scope: ReplaceMaterialScope, cabinetId: string): boolean {
  return scope.kind === 'all' || scope.cabinetIds.includes(cabinetId)
}

// ── Ауыстыру, конфиг деңгейінде ────────────────────────────────────────────────

/**
 * `materialId` сақтайтын БЕЛГІЛІ өріс атаулары. `CabinetConfig` ағашының
 * бірнеше тереңдігінде кездеседі: `carcassMaterialId`/`frontMaterialId`/
 * `backMaterialId` (кабинет деңгейі), `base.plinthMaterialId`,
 * `sections[].fronts.materialId`, `worktop.materialId`,
 * `backsplash.materialId`, `rails[].materialId`, `frontPanel.materialId`,
 * `customParts[].materialId` (types.ts).
 *
 * Атау бойынша жалпылама аралау таңдалды (әр жолды қолмен тізбелеу емес):
 * жаңа өріс осы атаулардың бірімен қосылса (мыс. басқа агент), бұл жер
 * оны АВТОМАТТЫ қамтиды — ал панель id-і секілді басқа өрістер (`id`,
 * панель id-мен кілттелген `Record`-тар: `panelGrain`, `panelCorners`,
 * `panelCutouts`, `drillEdits`) осы атаулардың бірімен СӘЙКЕС КЕЛМЕЙДІ,
 * сондықтан қателесіп өзгертілмейді.
 */
const MATERIAL_ID_KEYS = new Set([
  'materialId', 'carcassMaterialId', 'frontMaterialId', 'backMaterialId', 'plinthMaterialId',
])

/** Объект ағашын аралап, `MATERIAL_ID_KEYS`-тегі кілттің мәні `oldId`-ге тең болса, `newId`-ге ауыстырады. */
function replaceMaterialIds(value: unknown, oldId: string, newId: string): unknown {
  if (Array.isArray(value)) return value.map((item) => replaceMaterialIds(item, oldId, newId))
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      out[key] = MATERIAL_ID_KEYS.has(key) && val === oldId ? newId : replaceMaterialIds(val, oldId, newId)
    }
    return out
  }
  return value
}

/**
 * Бір материалды екіншісіне ауыстырады, тек `scope`-та көрсетілген
 * корпустарда. Таза функция: жаңа `CabinetConfig[]` қайтарады, ештеңе
 * мутацияламайды (тарихқа undo-снапшот ретінде жазуға дайын).
 */
export function applyMaterialReplace(
  cabinets: CabinetConfig[],
  oldMaterialId: string,
  newMaterialId: string,
  scope: ReplaceMaterialScope,
): CabinetConfig[] {
  return cabinets.map((cabinet) => (
    inScope(scope, cabinet.id)
      ? (replaceMaterialIds(cabinet, oldMaterialId, newMaterialId) as CabinetConfig)
      : cabinet
  ))
}

// ── Валидация (§10: параметр аты + рұқсат етілген мән) ─────────────────────────

/** `id` каталогта жоқ болса — параметр атымен әрі рұқсат етілген тізіммен лақтырады. */
function validateMaterialId(field: 'oldMaterialId' | 'newMaterialId', id: string, materials: Material[]): void {
  if (materials.some((m) => m.id === id)) return
  const allowed = materials.length > 0
    ? materials.map((m) => m.id).join(', ')
    : '(каталогта материал жоқ)'
  throw new ConfigValidationError(field, `материал табылмады: "${id}"`, allowed)
}

// ── Жоба бойынша есептеу (диагностика/алдын ала көрсету) ───────────────────────

/** Барлық корпустың панельдері, бір жобаға біріктірілген (Workspace.tsx-тегі `projectPanels`-пен бірдей тәсіл). */
export function projectPanelsOf(
  cabinets: CabinetConfig[],
  catalog: Catalog,
  settings?: SettingsOverride,
): Panel[] {
  return mergeProjectPanels(
    cabinets.map((cabinet) => ({ cabinetId: cabinet.id, panels: generateCabinet(cabinet, catalog, settings) })),
  )
}

/** Панель емес фурнитура (штанга, ұстағыш), бүкіл жоба бойынша. */
export function projectHardwareOf(
  cabinets: CabinetConfig[],
  catalog: Catalog,
  settings?: SettingsOverride,
): HardwarePlacement[] {
  return cabinets.flatMap((cabinet) => generateHardware(cabinet, catalog, settings))
}

/**
 * Жобада қолданылып тұрған материалдар: атауы + нешеу детальде қолданылған.
 * Логиканы қайталамайды — `materialUsage.ts`-тегі `projectUsage`-ті шақырады,
 * тек панельдерді жинап береді.
 */
export function projectMaterialUsage(
  cabinets: CabinetConfig[],
  catalog: Catalog,
  settings?: SettingsOverride,
): ProjectUsage {
  return projectUsage(projectPanelsOf(cabinets, catalog, settings), catalog)
}

// ── Алдын ала көрсету: нешеу деталь өзгереді, баға қанша өзгереді ──────────────

export type MaterialReplacePreview = {
  /** `scope`-қа кірген корпустар id-і. */
  affectedCabinetIds: string[]
  /** Осы корпустардағы панельдердің жалпы саны (тексеру үшін). */
  totalPanels: number
  /** Материалы НЕМЕСЕ рез өлшемі өзгерген панель саны. */
  changedPanels: number
  /**
   * Кемінде бір панельдің РЕЗ өлшемі өзгерді ме (§4.3 — жаңа материалдың
   * қалыңдығы басқа болғандықтан, көрші панельдердің готовый өлшемі
   * ауысып, содан кромка шегерімі басқа сан берді).
   */
  cutSizeChanged: boolean
  /** Ауыстыруға дейінгі/кейінгі жобаның толық сомасы (§6 `PriceBreakdown.total`), тиын. */
  priceBefore: number
  priceAfter: number
  /** `priceAfter − priceBefore`, тиын. Теріс болса — арзандады. */
  priceDiff: number
}

/**
 * Ауыстырудың алдын ала нәтижесі: нешеу деталь өзгереді, баға қанша
 * өзгереді. Ештеңені мутацияламайды — тек есептейді, `applyMaterialReplace`
 * бөлек шақырылады (пайдаланушы «Ауыстыру» батырмасын басқанда).
 *
 * Баға БҮКІЛ ЖОБА бойынша есептеледі (Workspace.tsx-тегі `liveTotal`-мен
 * бірдей тәсіл: `scope` бір-екі корпусты қамтыса да, парақты цех бәрібір
 * жобаға БІРГЕ сатып алады, сондықтан раскрой да, баға да толық жоба
 * панельдерімен есептелуі керек).
 */
export function previewMaterialReplace(
  cabinets: CabinetConfig[],
  shop: ShopProfile,
  oldMaterialId: string,
  newMaterialId: string,
  scope: ReplaceMaterialScope,
  settings?: SettingsOverride,
): MaterialReplacePreview {
  validateMaterialId('oldMaterialId', oldMaterialId, shop.materials)
  validateMaterialId('newMaterialId', newMaterialId, shop.materials)

  const catalog = catalogOf(shop)
  const nextCabinets = applyMaterialReplace(cabinets, oldMaterialId, newMaterialId, scope)
  const affectedCabinetIds = cabinets.filter((c) => inScope(scope, c.id)).map((c) => c.id)

  // ── Панель бойынша салыстыру: ТЕК қамтылған корпустар ─────────────────────
  let totalPanels = 0
  let changedPanels = 0
  let cutSizeChanged = false
  for (const cabinetId of affectedCabinetIds) {
    const before = generateCabinet(cabinets.find((c) => c.id === cabinetId)!, catalog, settings)
    const after = generateCabinet(nextCabinets.find((c) => c.id === cabinetId)!, catalog, settings)
    const afterById = new Map(after.map((p) => [p.id, p]))
    totalPanels += before.length
    for (const panel of before) {
      const updated = afterById.get(panel.id)
      // Материал ауыстыру құрылымды (секция/сөре санын) өзгертпеуі керек,
      // бірақ сақтық үшін: жұп табылмаса — салыстыруға жатпайды.
      if (!updated) continue
      const dimsChanged = updated.cutLength !== panel.cutLength || updated.cutWidth !== panel.cutWidth
      if (updated.materialId !== panel.materialId || dimsChanged) changedPanels += 1
      if (dimsChanged) cutSizeChanged = true
    }
  }

  // ── Баға: бүкіл жоба ────────────────────────────────────────────────────
  const nestingOptions = nestingOptionsOf(shop)
  const moduleWidths = cabinets.map((c) => c.width)

  const panelsBefore = projectPanelsOf(cabinets, catalog, settings)
  const hardwareBefore = projectHardwareOf(cabinets, catalog, settings)
  const priceBefore = priceProject(
    panelsBefore, nestPanels(panelsBefore, catalog, nestingOptions), shop, hardwareBefore, moduleWidths,
  ).total

  const panelsAfter = projectPanelsOf(nextCabinets, catalog, settings)
  const hardwareAfter = projectHardwareOf(nextCabinets, catalog, settings)
  const priceAfter = priceProject(
    panelsAfter, nestPanels(panelsAfter, catalog, nestingOptions), shop, hardwareAfter, moduleWidths,
  ).total

  return {
    affectedCabinetIds,
    totalPanels,
    changedPanels,
    cutSizeChanged,
    priceBefore,
    priceAfter,
    priceDiff: priceAfter - priceBefore,
  }
}
