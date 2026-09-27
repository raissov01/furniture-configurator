/** MCP adapters: existing core calculations and shop-scoped persistence only. */
import { z } from 'zod'
import type { Account } from '../lib/server/auth'
import { can } from '../lib/permissions'
import { projectProduction } from '../lib/projectProduction'
import { listProjects, readProject, readShopProfile, writeProject } from '../lib/server/store'
import { canAddProject } from '../lib/plans'
import { readPlan, usageOf } from '../lib/server/plan'
import {
  CabinetBriefSchema, ConfigValidationError, briefToCabinet, catalogOf,
  flattenTree, formatCutList, formatTengeExact, generateCabinet, generateFurniture,
  generateKitchen, kitchenLayout, nestPanels, nestingOptionsOf, parseBriefRequest,
  parseProjectV4, parseShopProfile, priceProject, ruleVariants, starterShopProfile,
} from '../src/core/index'
import type { KitchenOptions, ProjectFileV4, ShopProfile } from '../src/core/index'

const projectId = z.string().min(1).max(128)
const projectArg = z.strictObject({ projectId })
const emptyArg = z.strictObject({})

export const MCP_TOOL_SCHEMAS = {
  create_project_from_text: z.strictObject({ text: z.string().trim().min(3).max(4000) }),
  get_quote: projectArg,
  get_cut_list: projectArg,
  compute_nesting: projectArg,
  search_materials: z.strictObject({ query: z.string().trim().min(1).max(100) }),
  get_drilling: projectArg,
  validate_config: z.strictObject({ projectId: projectId.optional(), brief: CabinetBriefSchema.optional() })
    .refine((value) => Boolean(value.projectId) !== Boolean(value.brief), 'projectId не brief біреуін беріңіз'),
  list_projects: emptyArg,
  get_project: projectArg,
} as const

export const MCP_TOOL_NAMES = Object.keys(MCP_TOOL_SCHEMAS) as (keyof typeof MCP_TOOL_SCHEMAS)[]
export type McpToolName = keyof typeof MCP_TOOL_SCHEMAS
export type ToolResult = { ok: true; data: Record<string, unknown> } | { ok: false; error: string; field?: string; allowed?: string }

function shopOf(account: Account): ShopProfile {
  const stored = readShopProfile(account.shopId)
  return stored ? parseShopProfile(stored) : starterShopProfile(account.shopId)
}

function ownProject(account: Account, id: string): ProjectFileV4 {
  const raw = readProject(account.shopId, id)
  if (!raw) throw new Error('Жоба табылмады')
  return parseProjectV4(raw)
}

function production(project: ProjectFileV4, shop: ShopProfile) {
  const catalog = { ...catalogOf(shop), materials: project.materials, edgeBands: project.edgeBands }
  const scene = flattenTree(project.root, catalog, project.settings, project.layers, project.autoJoints)
  return { ...projectProduction(project.root, scene), catalog }
}

/** Converts a human brief into existing generator options; geometry remains in core. */
function fromText(text: string, shop: ShopProfile) {
  const lower = text.toLowerCase()
  const catalog = catalogOf(shop)
  if (/ас\s*үй|кухн/.test(lower)) {
    const metre = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:метр(?:а|ов)?|м\b)/)
    const millimetre = lower.match(/(\d{3,5})\s*мм/)
    const lengthA = millimetre ? Number(millimetre[1]) : metre ? Math.round(Number(metre[1]!.replace(',', '.')) * 1000) : NaN
    if (!Number.isInteger(lengthA) || lengthA < 600 || lengthA > 8000) {
      throw new ConfigValidationError('lengthA', 'қабырға ұзындығы көрсетілмеген не жарамсыз', '600..8000 мм')
    }
    const options: KitchenOptions = {
      layout: 'straight', lengthA,
      sink: /мойк|раковин|жуғыш/.test(lower),
      appliances: /духов|пеш|встраиваем|кірістір/.test(lower),
      upper: !/без верх|үстіңгісіз/.test(lower),
    }
    const layout = kitchenLayout(options)
    if (/мойк.{0,15}(сол|слева|лев)|(?:сол|слева|лев).{0,15}мойк/.test(lower)) {
      const index = layout.runA.findIndex((module) => module.kind === 'sink')
      if (index >= 0) {
        const [sink] = layout.runA.splice(index, 1)
        layout.runA.unshift(sink!)
      }
    }
    const result = generateKitchen({ ...options, modules: layout }, catalog)
    return { name: `Ас үй ${lengthA} (W) мм`, result }
  }
  const request = parseBriefRequest(text)
  const variant = ruleVariants(request, catalog, 1)[0]
  if (!variant) throw new ConfigValidationError('text', 'жиналатын нұсқа табылмады', 'модель мен өлшемдерді нақтылаңыз')
  const cabinet = variant.cabinet
  return {
    name: cabinet.name,
    result: {
      cabinets: [cabinet],
      placements: [{ cabinetId: cabinet.id, wall: 'north' as const, offset: 0 }],
      room: { width: Math.max(3000, cabinet.width + 400), depth: 3000, height: Math.max(2700, cabinet.height + 200) },
    },
  }
}

function makeProject(name: string, result: ReturnType<typeof fromText>['result'], shop: ShopProfile): ProjectFileV4 {
  return parseProjectV4({
    schemaVersion: 3, name, cabinets: result.cabinets, placements: result.placements,
    room: result.room, materials: shop.materials, edgeBands: shop.edgeBands,
    settings: shop.settings,
  })
}

export async function runMcpTool(account: Account, name: McpToolName, raw: unknown): Promise<ToolResult> {
  const schema = MCP_TOOL_SCHEMAS[name]
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { ok: false, error: `Параметр жарамсыз: ${issue?.path.join('.') || 'input'}: ${issue?.message}` }
  }
  // MCP is an internal shop assistant. Only roles with internal prices may use it.
  if (!can(account.role, 'readInternalPrice')) return { ok: false, error: 'Құқық жоқ' }
  try {
    switch (name) {
      case 'create_project_from_text': {
        if (!can(account.role, 'editProject')) return { ok: false, error: 'Құқық жоқ' }
        const { plan } = readPlan(account.shopId)
        const allowed = canAddProject(plan, usageOf(account.shopId))
        if (!allowed.ok) return { ok: false, error: allowed.reason }
        const brief = fromText((parsed.data as { text: string }).text, shopOf(account))
        const project = makeProject(brief.name, brief.result, shopOf(account))
        // Confirm all generated cabinets can actually be manufactured before saving.
        production(project, shopOf(account))
        const id = writeProject(account.shopId, project.name, project, undefined, account.userId)
        return { ok: true, data: { id, name: project.name, cabinets: brief.result.cabinets.length } }
      }
      case 'list_projects': return { ok: true, data: { projects: listProjects(account.shopId) } }
      case 'get_project': {
        const project = ownProject(account, (parsed.data as { projectId: string }).projectId)
        return { ok: true, data: { projectId: (parsed.data as { projectId: string }).projectId, project } }
      }
      case 'search_materials': {
        const query = (parsed.data as { query: string }).query.toLocaleLowerCase()
        const materials = shopOf(account).materials.filter((item) => item.name.toLocaleLowerCase().includes(query) || item.id.toLocaleLowerCase().includes(query))
          .slice(0, 50).map((item) => ({ id: item.id, name: item.name, thicknessMm: item.thickness,
            sheet: { widthMm: item.sheetWidth, heightMm: item.sheetHeight },
            pricePerSheet: formatTengeExact(item.pricePerSheet) }))
        return { ok: true, data: { materials } }
      }
      case 'validate_config': {
        const args = parsed.data as { projectId?: string; brief?: z.infer<typeof CabinetBriefSchema> }
        if (args.projectId) {
          const project = ownProject(account, args.projectId)
          const built = production(project, shopOf(account))
          return { ok: true, data: { valid: true, panels: built.panels.length } }
        }
        const shop = shopOf(account)
        const cabinet = briefToCabinet(args.brief!, catalogOf(shop))
        const panels = generateCabinet(cabinet, catalogOf(shop), shop.settings)
        return { ok: true, data: { valid: true, panels: panels.length,
          dimensions: `${cabinet.height} (H) × ${cabinet.width} (W) × ${cabinet.depth} (D) мм` } }
      }
      case 'get_cut_list':
      case 'compute_nesting':
      case 'get_quote':
      case 'get_drilling': {
        const project = ownProject(account, (parsed.data as { projectId: string }).projectId)
        const shop = shopOf(account)
        const built = production(project, shop)
        if (name === 'get_cut_list') return { ok: true, data: { rows: formatCutList(built.panels, built.catalog) } }
        if (name === 'get_drilling') return { ok: true, data: { panels: built.panels.map((panel) => ({
          panelId: panel.id, name: panel.label, cutLengthMm: panel.cutLength, cutWidthMm: panel.cutWidth,
          holes: panel.drilling,
        })).filter((panel) => panel.holes.length > 0) } }
        const nesting = nestPanels(built.panels, built.catalog, nestingOptionsOf(shop))
        if (name === 'compute_nesting') return { ok: true, data: {
          sheetCount: nesting.sheetCount, byMaterial: nesting.byMaterial.map((m) => ({
            materialId: m.materialId, materialName: m.materialName, sheets: m.sheets.length,
            wastePercent: m.wastePercent, offcuts: m.sheets.flatMap((sheet) => sheet.offcuts),
          })), unplaced: nesting.unplaced,
        } }
        const quote = priceProject(built.panels, nesting, shop, built.hardware, built.moduleWidths, project.priceOverrides)
        return { ok: true, data: {
          materials: quote.materials.map((line) => ({ ...line, formatted: formatTengeExact(line.cost) })),
          edges: quote.edges.map((line) => ({ ...line, formatted: formatTengeExact(line.cost) })),
          hardware: quote.hardware.map((line) => ({ ...line, formatted: formatTengeExact(line.cost) })),
          labour: quote.services.map((line) => ({ ...line, formatted: formatTengeExact(line.cost) })),
          installation: { ...quote.installation, formatted: formatTengeExact(quote.installation.cost) },
          total: formatTengeExact(quote.total), totalMinor: quote.total, missingPrices: quote.missingPrices,
        } }
      }
    }
  } catch (error) {
    if (error instanceof ConfigValidationError) return { ok: false, error: error.message, field: error.field,
      ...(error.allowed ? { allowed: error.allowed } : {}) }
    return { ok: false, error: error instanceof Error ? error.message : 'Белгісіз қате' }
  }
}
