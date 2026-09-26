/** OBJ/GLB метадерегі → ағаштағы сәндік solid қорап. Mesh файлдары мұнда сақталмайды. */
import { ConfigValidationError } from '../errors'
import type { SolidNode } from '../tree'
import { z } from 'zod'

export type SolidImportOptions = { id: string; name: string; mmPerUnit?: number }
export type SolidImportResult = { node: SolidNode; materialNames: string[] }
type Vec = [number, number, number]
type Bounds = { min: Vec; max: Vec }
type GlbNode = { mesh?: number | undefined; children?: number[] | undefined;
  translation?: number[] | undefined; rotation?: number[] | undefined;
  scale?: number[] | undefined; matrix?: number[] | undefined }

const index = z.number().int().nonnegative()
const numbers = z.array(z.number().finite())
const glbJsonSchema = z.object({
  asset: z.object({ version: z.string() }),
  scene: index.optional(),
  scenes: z.array(z.object({ nodes: z.array(index).optional() })).optional(),
  nodes: z.array(z.object({ mesh: index.optional(), children: z.array(index).optional(),
    translation: numbers.optional(), rotation: numbers.optional(), scale: numbers.optional(), matrix: numbers.optional() })).optional(),
  meshes: z.array(z.object({ primitives: z.array(z.object({
    attributes: z.object({ POSITION: index.optional() }).optional(), material: index.optional(),
  })).optional() })).optional(),
  accessors: z.array(z.object({ min: numbers.optional(), max: numbers.optional() })).optional(),
  materials: z.array(z.object({ name: z.string().optional() })).optional(),
})

function fail(field: string, message: string, allowed?: string): never {
  throw new ConfigValidationError(field, message, allowed)
}
function finite(n: unknown): n is number { return typeof n === 'number' && Number.isFinite(n) }
function vector(value: unknown, length: number, field: string): number[] {
  if (!Array.isArray(value) || value.length !== length || !value.every(finite)) fail(field, 'вектор жарамсыз', `${length} finite сан`)
  return value as number[]
}
function validateOptions(options: SolidImportOptions, defaultScale?: number): number {
  if (!options.id?.trim()) fail('solid.id', 'мән бос', 'бос емес мәтін')
  if (!options.name?.trim()) fail('solid.name', 'мән бос', 'бос емес мәтін')
  const scale = options.mmPerUnit ?? defaultScale
  if (!finite(scale) || scale <= 0) fail('solid.mmPerUnit', 'бірлік масштабы берілмеген не жарамсыз', 'оң мм/бірлік')
  return scale
}
function addPoint(bounds: Bounds | null, point: Vec): Bounds {
  if (!bounds) return { min: [...point], max: [...point] }
  for (let i = 0; i < 3; i += 1) {
    bounds.min[i] = Math.min(bounds.min[i]!, point[i]!)
    bounds.max[i] = Math.max(bounds.max[i]!, point[i]!)
  }
  return bounds
}
function result(bounds: Bounds | null, materials: string[], options: SolidImportOptions, scale: number): SolidImportResult {
  if (!bounds) fail('solid.geometry', 'төбелер табылмады')
  const millimetres = (n: number): number => {
    const rounded = Math.round(n * scale)
    return rounded === 0 ? 0 : rounded
  }
  const min = bounds.min.map(millimetres)
  const max = bounds.max.map(millimetres)
  const size = max.map((n, i) => n - min[i]!)
  if ([...min, ...max, ...size].some((n) => !Number.isSafeInteger(n)) || size.some((n) => n <= 0)) {
    fail('solid.size', 'габарит бүтін мм-де барлық үш осьте оң болуы керек', 'x/y/z > 0 бүтін мм')
  }
  return { node: { kind: 'solid', id: options.id, name: options.name,
    transform: { pos: { x: min[0]!, y: min[1]!, z: min[2]! }, rot: { x: 0, y: 0, z: 0 } },
    solid: { size: { x: size[0]!, y: size[1]!, z: size[2]! } } },
    materialNames: materials }
}

/** OBJ-де бірлік стандарты жоқ: mmPerUnit міндетті. Файлдағы vertex пен usemtl ғана оқылады. */
export function importObjSolid(text: string, options: SolidImportOptions): SolidImportResult {
  const scale = validateOptions(options)
  let bounds: Bounds | null = null
  const materials = new Set<string>()
  for (const [index, line] of text.split(/\r\n|\n|\r/).entries()) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const [tag, ...values] = trimmed.split(/\s+/)
    if (tag === 'v') {
      if (values.length < 3) fail(`obj.line[${index + 1}]`, 'vertex координатасы жетіспейді')
      const nums = values.slice(0, 3).map(Number)
      if (!nums.every(finite)) fail(`obj.line[${index + 1}]`, 'vertex координатасы сан емес')
      bounds = addPoint(bounds, nums as Vec)
    } else if (tag === 'usemtl') {
      const name = trimmed.slice(6).trim()
      if (name) materials.add(name)
    }
  }
  return result(bounds, [...materials], options, scale)
}

type Matrix = number[]
const IDENTITY: Matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
function multiply(a: Matrix, b: Matrix): Matrix {
  const out = new Array<number>(16).fill(0)
  for (let col = 0; col < 4; col += 1) for (let row = 0; row < 4; row += 1) {
    for (let k = 0; k < 4; k += 1) out[col * 4 + row]! += a[k * 4 + row]! * b[col * 4 + k]!
  }
  return out
}
function nodeMatrix(node: GlbNode): Matrix {
  if (node.matrix !== undefined) return vector(node.matrix, 16, 'glb.node.matrix')
  const [x, y, z, w] = vector(node.rotation ?? [0, 0, 0, 1], 4, 'glb.node.rotation')
  const [sx, sy, sz] = vector(node.scale ?? [1, 1, 1], 3, 'glb.node.scale')
  const [tx, ty, tz] = vector(node.translation ?? [0, 0, 0], 3, 'glb.node.translation')
  return [
    (1 - 2 * (y! * y! + z! * z!)) * sx!, (2 * (x! * y! + z! * w!)) * sx!, (2 * (x! * z! - y! * w!)) * sx!, 0,
    (2 * (x! * y! - z! * w!)) * sy!, (1 - 2 * (x! * x! + z! * z!)) * sy!, (2 * (y! * z! + x! * w!)) * sy!, 0,
    (2 * (x! * z! + y! * w!)) * sz!, (2 * (y! * z! - x! * w!)) * sz!, (1 - 2 * (x! * x! + y! * y!)) * sz!, 0,
    tx!, ty!, tz!, 1,
  ]
}
function transform(m: Matrix, p: Vec): Vec {
  return [m[0]! * p[0] + m[4]! * p[1] + m[8]! * p[2] + m[12]!,
    m[1]! * p[0] + m[5]! * p[1] + m[9]! * p[2] + m[13]!,
    m[2]! * p[0] + m[6]! * p[1] + m[10]! * p[2] + m[14]!]
}

/** GLB 2.0 JSON chunk-тағы POSITION min/max және scene matrix-тері ғана оқылады. */
export function importGlbSolid(bytes: Uint8Array, options: SolidImportOptions): SolidImportResult {
  const scale = validateOptions(options, 1000) // glTF 2.0 scene units: metres.
  if (bytes.byteLength < 20) fail('glb.header', 'файл тым қысқа', 'GLB 2.0 binary')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.byteLength) {
    fail('glb.header', 'GLB 2.0 тақырыбы немесе ұзындығы жарамсыз')
  }
  const chunkLength = view.getUint32(12, true)
  if (view.getUint32(16, true) !== 0x4e4f534a || chunkLength > bytes.byteLength - 20 || chunkLength % 4 !== 0) {
    fail('glb.json', 'бірінші JSON chunk жарамсыз')
  }
  const binStart = 20 + chunkLength
  if (binStart !== bytes.byteLength) {
    if (bytes.byteLength - binStart < 8 || view.getUint32(binStart + 4, true) !== 0x004e4942 ||
      view.getUint32(binStart, true) % 4 !== 0 || view.getUint32(binStart, true) !== bytes.byteLength - binStart - 8) {
      fail('glb.BIN', 'BIN chunk ұзындығы не түрі жарамсыз')
    }
  }
  let raw: unknown
  try { raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(20, 20 + chunkLength))) as unknown }
  catch { fail('glb.json', 'JSON оқылмады') }
  const parsed = glbJsonSchema.safeParse(raw)
  if (!parsed.success) fail('glb.json', `JSON құрылымы жарамсыз: ${parsed.error.issues[0]?.path.join('.') ?? 'root'}`)
  const json = parsed.data
  if (json.asset?.version !== '2.0') fail('glb.asset.version', 'glTF 2.0 қажет')
  const nodes = json.nodes ?? []
  const roots = json.scenes?.[json.scene ?? 0]?.nodes
  if (!roots?.length) fail('glb.scene', 'белсенді сахнада түйін жоқ')
  let bounds: Bounds | null = null
  const materials = new Set<string>()
  const visited = new Set<number>()
  const visit = (index: number, parent: Matrix, ancestors: Set<number>): void => {
    const node = nodes[index]
    if (!node) fail('glb.node', `түйін ${index} табылмады`)
    if (ancestors.has(index)) fail('glb.node', 'циклді түйіндер ағашы')
    if (visited.has(index)) fail('glb.node', 'ортақ немесе қайталанған түйін')
    visited.add(index)
    const matrix = multiply(parent, nodeMatrix(node))
    if (node.mesh !== undefined) {
      const mesh = json.meshes?.[node.mesh]
      if (!mesh?.primitives?.length) fail('glb.mesh', `mesh ${node.mesh} бос не жоқ`)
      for (const primitive of mesh.primitives) {
        const accessor = json.accessors?.[primitive.attributes?.POSITION ?? -1]
        if (!accessor) fail('glb.POSITION', 'POSITION accessor жоқ')
        const min = vector(accessor.min, 3, 'glb.POSITION.min') as Vec
        const max = vector(accessor.max, 3, 'glb.POSITION.max') as Vec
        if (min.some((v, i) => v > max[i]!)) fail('glb.POSITION', 'min/max реті теріс')
        for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
          bounds = addPoint(bounds, transform(matrix, [x, y, z]))
        }
        if (primitive.material !== undefined) {
          const material = json.materials?.[primitive.material]
          if (!material) fail('glb.material', `material ${primitive.material} табылмады`)
          if (material.name) materials.add(material.name)
        }
      }
    }
    const next = new Set(ancestors); next.add(index)
    for (const child of node.children ?? []) visit(child, matrix, next)
  }
  for (const root of roots) visit(root, IDENTITY, new Set())
  return result(bounds, [...materials], options, scale)
}
