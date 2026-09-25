/**
 * Базис фурнитурасының атау бойынша каталогу.
 *
 * `docs/basis/fittings.json` — 2023 архивіндегі `.fr3d` файлдарының 3 645
 * бірегей атауы ғана. Жабық файл, 3D геометрия және сурет репоға салынбайды.
 * Төмендегі parser тек атаудан дәл көрінетін түр/өндіруші/артикулды алады;
 * бағасы мен присадкасы бұл деректе жоқ болса null күйінде қалады.
 */
import fittingNamesRaw from '../../../docs/basis/fittings.json'

export type BasisFittingKind =
  | 'handle'
  | 'runner'
  | 'drawer-box'
  | 'profile'
  | 'lighting'
  | 'support'
  | 'lock'
  | 'latch'
  | 'shelf-support'
  | 'accessory'

export type BasisFittingHandleModel = 'bar' | 'knob' | 'rail' | 'profile'
export type BasisFittingManufacturer = 'Boyard' | 'FGV' | 'MODUS' | null

export type BasisFitting = {
  /** `.fr3d` жұрнағынсыз атау. */
  raw: string
  manufacturer: BasisFittingManufacturer
  article: string | null
  kind: BasisFittingKind
  model?: BasisFittingHandleModel | undefined
  series: string | null
  /** Атауда H120/128мм секілді анық көрсетілген өлшемдер ғана. */
  dimensionsMm: number[]
  /** Бар core handle моделіне қауіпсіз сәйкестік, геометрия/баға емес. */
  existingModelId?: string | undefined
}

const ARTICLE_RE = /^(?=.*\d)[A-Za-zА-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі0-9]+(?:[./_-][A-Za-zА-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі0-9]+)+$/u
const SIMPLE_ARTICLE_RE = /^(?=.*\d)(?=.*[A-Za-zА-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі])[A-Za-zА-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі0-9]+$/u
const DIMENSION_TOKEN_RE = /^(?:[HН]\s*)?\d{2,4}$/iu
const MANUFACTURER_PREFIXES: Array<[BasisFittingManufacturer, RegExp]> = [
  ['Boyard', /^(?:BOYARD|СТАРТ|B-SLIDE)(?:\s|$)/iu],
  ['FGV', /^FGV(?:\s|$)/iu],
  ['MODUS', /^MODUS(?:\s|$)/iu],
]

function withoutExtension(name: string): string {
  return name.trim().replace(/\.fr3d$/iu, '')
}

function manufacturerOf(raw: string): BasisFittingManufacturer {
  return MANUFACTURER_PREFIXES.find(([, pattern]) => pattern.test(raw))?.[0] ?? null
}

function articleOf(raw: string): string | null {
  const tokens = raw.split(/\s+/).map((token) => token.replace(/^[,;(]+|[,;.)]+$/g, ''))
  for (const token of tokens) {
    if (DIMENSION_TOKEN_RE.test(token)) continue
    if (ARTICLE_RE.test(token) || SIMPLE_ARTICLE_RE.test(token)) {
      // B-Slide/MB атауында соңғы сан — номинал ұзындық (`DB7772Zn-500`),
      // артикулдың өзіне кірмейді. Басқа кодтардағы дефис (мыс. T16-02)
      // сақталады, өйткені ол артикулдың бөлігі ретінде жазылған.
      if (/^(?:DB|MB)\d/i.test(token)) return token.replace(/-\d{2,4}$/, '')
      return token
    }
  }
  return null
}

function seriesOf(raw: string): string | null {
  if (/B-Slide/iu.test(raw)) return 'B-Slide'
  if (/СТАРТ/iu.test(raw)) return 'СТАРТ'
  if (/\bExcel\b/iu.test(raw)) return 'Excel'
  return null
}

function dimensionsOf(raw: string): number[] {
  const values = [
    ...raw.matchAll(/(?:^|[\s,])(?:H|Н)\s*(\d{2,4})(?=\s|$)/giu),
    ...raw.matchAll(/(\d{2,4})\s*мм/giu),
  ].map((match) => Number(match[1]))
  return [...new Set(values)]
}

function handleInfo(raw: string): Pick<BasisFitting, 'kind' | 'model' | 'existingModelId'> | null {
  if (/ручка-кнопка/iu.test(raw)) return { kind: 'handle', model: 'knob', existingModelId: 'handle-knob' }
  if (/ручка-(?:скоба|рейлинг)/iu.test(raw)) {
    const rail = /ручка-рейлинг/iu.test(raw)
    return { kind: 'handle', model: rail ? 'rail' : 'bar', existingModelId: rail ? 'handle-rail' : 'handle-bar' }
  }
  return null
}

function kindOf(raw: string): BasisFittingKind {
  if (/направляющ|B-Slide|СТАРТ/iu.test(raw)) return 'runner'
  if (/короб ящика|мультисекц|мультиящик|ящик/iu.test(raw)) return 'drawer-box'
  if (/профил|профиль|фасадный/iu.test(raw)) return 'profile'
  if (/подсвет|свет|рассеиватель/iu.test(raw)) return 'lighting'
  if (/полкодержатель/iu.test(raw)) return 'shelf-support'
  if (/опора|ножка/iu.test(raw)) return 'support'
  if (/замок/iu.test(raw)) return 'lock'
  if (/защел/iu.test(raw)) return 'latch'
  return 'accessory'
}

/** Бір `.fr3d` атауын жабық мазмұнсыз талдайды. */
export function parseBasisFittingName(name: string): BasisFitting {
  const raw = withoutExtension(name)
  const handle = handleInfo(raw)
  const kind: BasisFittingKind = handle?.kind ?? kindOf(raw)
  // Жалпы «профиль фасадный» — тұтқа емес. Бар core моделіне тек атауында
  // нақты «Ручка-...» болған позицияны сәйкестендіреміз.
  const model = handle?.model
  const existingModelId = handle?.existingModelId
  return {
    raw,
    manufacturer: manufacturerOf(raw),
    article: articleOf(raw),
    kind,
    ...(model === undefined ? {} : { model }),
    series: seriesOf(raw),
    dimensionsMm: dimensionsOf(raw),
    ...(existingModelId === undefined ? {} : { existingModelId }),
  }
}

export const BASIS_FITTINGS: BasisFitting[] = (fittingNamesRaw as string[]).map(parseBasisFittingName)

export function basisFittingStats() {
  const countBy = <T extends string | number>(values: T[]) => Object.fromEntries(
    [...new Set(values)].sort().map((value) => [value, values.filter((item) => item === value).length]),
  ) as Record<string, number>
  return {
    total: BASIS_FITTINGS.length,
    withArticle: BASIS_FITTINGS.filter((item) => item.article !== null).length,
    byManufacturer: countBy(BASIS_FITTINGS.map((item) => item.manufacturer ?? 'unknown')),
    byKind: countBy(BASIS_FITTINGS.map((item) => item.kind)),
  }
}
