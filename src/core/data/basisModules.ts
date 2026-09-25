/**
 * Базис-Мебельщик ас үй модульдерінің атау каталогы.
 *
 * Бастапқы атау реті — H × D × W (`ШВ720х300х600`). Жоба конвенциясы H × W × D
 * болғандықтан, таза талдағыш екінші және үшінші сандарды әдейі ауыстырып
 * `depth`/`width` өрістеріне жазады. `.b3d` файлдары, геометриясы мен суреті
 * бұл модульге кірмейді: тек атаудан көрінетін дерек сақталады.
 */
import basisModulesRaw from '../../../docs/basis/modules.json'

export type BasisModuleKind = 'wall' | 'base' | 'tall'
export type BasisModuleSystem = 'standard' | 'gola'
export type BasisModuleHand = 'left' | 'right'

export type BasisModule = {
  raw: string
  kind: BasisModuleKind | null
  /** Габариттің бірінші саны, мм. */
  height: number | null
  /** Базис атауындағы екінші сан, H×D×W ішіндегі D, мм. */
  depth: number | null
  /** Базис атауындағы үшінші сан, H×D×W ішіндегі W, мм. */
  width: number | null
  doors: number | null
  drawers: number | null
  /** Өлшемнен кейінгі шикі белгілер, мағынасы анықталмаса да жоғалмайды. */
  tokens: string[]
  hand: BasisModuleHand | null
  count: number | null
  system: BasisModuleSystem
}

export type BasisModuleParseOptions = { system?: BasisModuleSystem | undefined }
type BasisModuleOptions = BasisModuleParseOptions | BasisModuleSystem

const EMPTY_UNMATCHED: Omit<BasisModule, 'raw' | 'system'> = {
  kind: null,
  height: null,
  depth: null,
  width: null,
  doors: null,
  drawers: null,
  tokens: [],
  hand: null,
  count: null,
}

const MODULE_RE = /^(ШВ|ШН|ШП)\s*(\d+)\s*[xх×](\d+)\s*[xх×](\d+)(?:-(.*))?$/iu
const DOOR_RE = /(\d+)\s*[ДD](?:[ФFНN])?/giu
const DRAWER_RE = /(\d+)\s*(?:БГ|BG|ящ(?:ик)?)/giu
const KIND_BY_PREFIX: Record<string, BasisModuleKind> = { ШВ: 'wall', ШН: 'base', ШП: 'tall' }

function integerSum(value: string, pattern: RegExp): number {
  let total = 0
  for (const match of value.matchAll(pattern)) total += Number(match[1])
  return total
}

function cleanRawName(name: string): string {
  return name.trim().replace(/\.b3d$/iu, '')
}

function handOf(token: string | undefined): BasisModuleHand | null {
  if (!token) return null
  if (/^(?:лв|лев|left)$/iu.test(token)) return 'left'
  if (/^(?:пр|прав|right)$/iu.test(token)) return 'right'
  return null
}

/**
 * Бір Базис атауын талдайды. Қате/аксессуар атауы exception лақтырмайды:
 * `kind` пен өлшемдер null болып, импорт есебі оны «сәйкессіз» деп көрсете
 * алады. Бұл 6 948 атаудың бәрін UI-ды құлатпай тексеруге қажет.
 */
export function parseBasisModule(name: string, options: BasisModuleOptions = {}): BasisModule {
  const raw = cleanRawName(name)
  const system = typeof options === 'string' ? options : options.system ?? 'standard'
  const match = MODULE_RE.exec(raw)
  if (!match) return { raw, ...EMPTY_UNMATCHED, system }

  const prefix = match[1]!.toUpperCase()
  const suffix = match[5] ?? ''
  const rawTokens = suffix.split('-').map((token) => token.trim()).filter(Boolean)
  const last = rawTokens.at(-1)
  const hand = handOf(last)
  const tokens = hand === null ? rawTokens : rawTokens.slice(0, -1)

  return {
    raw,
    kind: KIND_BY_PREFIX[prefix] ?? null,
    height: Number(match[2]),
    depth: Number(match[3]),
    width: Number(match[4]),
    doors: integerSum(tokens.join('+'), DOOR_RE),
    drawers: integerSum(tokens.join('+'), DRAWER_RE),
    tokens,
    hand,
    count: 1,
    system,
  }
}

/**
 * `modules.json` — 4 593 standard + 2 355 Gola атаудың атрибуттары. JSON-да
 * жүйе өрісі архивтің екі атау тізімінен шыққан, атаудың өзінен ойдан
 * қалпына келтірілмейді.
 */
export const BASIS_MODULES: BasisModule[] = basisModulesRaw as BasisModule[]

export function basisModuleStats() {
  const parsed = BASIS_MODULES.filter((item) => item.kind !== null).length
  return {
    total: BASIS_MODULES.length,
    parsed,
    unmatched: BASIS_MODULES.length - parsed,
    standard: BASIS_MODULES.filter((item) => item.system === 'standard').length,
    gola: BASIS_MODULES.filter((item) => item.system === 'gola').length,
  }
}

/** Реттеуші үшін қажет жалғыз категория тізімі: UI бұл файлға тәуелді емес. */
export const BASIS_MODULE_KINDS: readonly BasisModuleKind[] = ['wall', 'base', 'tall']
